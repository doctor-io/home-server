#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { chmod, chown, mkdir, unlink } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import { dirname } from "node:path";
import process from "node:process";
import net from "node:net";
import dbus from "dbus-next";
import {
  parseRpcRequest,
  toErrorPayload,
} from "./protocol.mjs";

const { Variant } = dbus;

const DBUS_SERVICE = "org.freedesktop.NetworkManager";
const DBUS_PATH = "/org/freedesktop/NetworkManager";
const DBUS_IFACE = "org.freedesktop.NetworkManager";
const DBUS_PROPS_IFACE = "org.freedesktop.DBus.Properties";
const DBUS_DEVICE_IFACE = "org.freedesktop.NetworkManager.Device";
const DBUS_WIRELESS_IFACE = "org.freedesktop.NetworkManager.Device.Wireless";
const DBUS_ACCESS_POINT_IFACE = "org.freedesktop.NetworkManager.AccessPoint";
const DBUS_SETTINGS_PATH = "/org/freedesktop/NetworkManager/Settings";
const DBUS_SETTINGS_IFACE = "org.freedesktop.NetworkManager.Settings";
const DBUS_SETTINGS_CONNECTION_IFACE =
  "org.freedesktop.NetworkManager.Settings.Connection";

const DEVICE_TYPE_WIFI = 2;
const DEVICE_STATE_ACTIVATED = 100;

const SOCKET_PATH =
  process.env.DBUS_HELPER_SOCKET_PATH ?? "/run/home-server/dbus-helper.sock";
const SOCKET_GROUP = process.env.HOMEIO_GROUP ?? "homeio";
const DBUS_METHOD_TIMEOUT_MS = Number(process.env.DBUS_HELPER_TIMEOUT_MS ?? "10000");
const CONNECT_RATE_LIMIT_PER_MINUTE = Number(
  process.env.DBUS_HELPER_CONNECT_RATE_LIMIT ?? "3",
);

const activeSockets = new Set();
const connectAttempts = new Map();

let bus = null;
let helperServer = null;

class HelperServiceError extends Error {
  constructor(message, options = {}) {
    super(message, {
      cause: options.cause,
    });
    this.name = "HelperServiceError";
    this.code = options.code ?? "internal_error";
    this.statusCode = options.statusCode ?? 500;
  }
}

function log(payload) {
  const entry = {
    timestamp: new Date().toISOString(),
    runtime: "server",
    level: payload.level ?? "info",
    layer: "system",
    action: payload.action,
    status: payload.status ?? "info",
    durationMs: payload.durationMs,
    requestId: payload.requestId,
    message: payload.message,
    meta: payload.meta,
    error:
      payload.error instanceof Error
        ? {
            name: payload.error.name,
            message: payload.error.message,
            stack: payload.error.stack,
          }
        : undefined,
  };

  if (entry.level === "error") {
    console.error(JSON.stringify(entry));
    return;
  }

  if (entry.level === "warn") {
    console.warn(JSON.stringify(entry));
    return;
  }

  console.log(JSON.stringify(entry));
}

function toCodeFromError(error) {
  if (error instanceof HelperServiceError) return error;

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (
      message.includes("org.freedesktop.networkmanager") ||
      message.includes("networkmanager") ||
      message.includes("serviceunknown")
    ) {
      return new HelperServiceError("NetworkManager is unavailable", {
        code: "network_manager_unavailable",
        statusCode: 503,
        cause: error,
      });
    }

    if (
      message.includes("secrets") ||
      message.includes("invalid password") ||
      message.includes("authentication") ||
      message.includes("802-11-wireless-security")
    ) {
      return new HelperServiceError("Wi-Fi authentication failed", {
        code: "auth_failed",
        statusCode: 401,
        cause: error,
      });
    }
  }

  return new HelperServiceError(
    error instanceof Error ? error.message : "Unknown helper error",
    {
      code: "internal_error",
      statusCode: 500,
      cause: error,
    },
  );
}

function withTimeout(promise, timeoutMs = DBUS_METHOD_TIMEOUT_MS) {
  let timeoutHandle;
  return Promise.race([
    promise.finally(() => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }),
    new Promise((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(
          new HelperServiceError("DBus operation timeout", {
            code: "timeout",
            statusCode: 504,
          }),
        );
      }, timeoutMs);
    }),
  ]);
}

function decodeSsid(raw) {
  if (!raw) return "";
  if (Buffer.isBuffer(raw)) return raw.toString("utf8").replace(/\0/g, "").trim();
  if (Array.isArray(raw)) {
    return Buffer.from(raw).toString("utf8").replace(/\0/g, "").trim();
  }

  return typeof raw === "string" ? raw.trim() : "";
}

function toOptionalNumber(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return value;
}

function frequencyToChannel(frequencyMhz) {
  if (typeof frequencyMhz !== "number" || frequencyMhz <= 0) return null;
  if (frequencyMhz >= 2412 && frequencyMhz <= 2484) {
    if (frequencyMhz === 2484) return 14;
    return Math.round((frequencyMhz - 2407) / 5);
  }

  if (frequencyMhz >= 5000 && frequencyMhz <= 5900) {
    return Math.round((frequencyMhz - 5000) / 5);
  }

  return null;
}

function resolveInterfaceIpv4(iface) {
  if (!iface) return null;
  const interfaces = networkInterfaces();
  const records = interfaces[iface];
  if (!records || records.length === 0) return null;

  const ipv4 = records.find(
    (entry) => entry.family === "IPv4" || entry.family === 4,
  );
  return ipv4?.address ?? null;
}

function resolveGroupId(groupName) {
  try {
    const raw = execFileSync("getent", ["group", groupName], {
      encoding: "utf8",
    }).trim();
    const parts = raw.split(":");
    const gid = Number.parseInt(parts[2] ?? "", 10);
    return Number.isFinite(gid) ? gid : null;
  } catch {
    return null;
  }
}

async function ensureSocketDirectory(socketPath, groupName) {
  const directory = dirname(socketPath);
  await mkdir(directory, {
    recursive: true,
  });

  const gid = resolveGroupId(groupName);
  if (gid !== null) {
    await chown(directory, 0, gid).catch(() => {});
  }
  await chmod(directory, 0o770).catch(() => {});
}

async function ensureSocketPermissions(socketPath, groupName) {
  const gid = resolveGroupId(groupName);
  if (gid !== null) {
    await chown(socketPath, 0, gid).catch(() => {});
  }
  await chmod(socketPath, 0o660).catch(() => {});
}

async function safeUnlink(socketPath) {
  await unlink(socketPath).catch(() => {});
}

function dbusVariantValue(value) {
  if (value && typeof value === "object" && "value" in value) {
    return value.value;
  }

  return value;
}

async function getBus() {
  if (!bus) {
    bus = dbus.systemBus();
    bus.connection.on("error", (error) => {
      log({
        level: "warn",
        action: "dbus.network.bus.error",
        status: "error",
        message: "System DBus connection error",
        error,
      });
    });
  }

  return bus;
}

async function getProxyObject(path) {
  const systemBus = await getBus();
  return systemBus.getProxyObject(DBUS_SERVICE, path);
}

async function getNmRoot() {
  try {
    const object = await getProxyObject(DBUS_PATH);
    return {
      object,
      nm: object.getInterface(DBUS_IFACE),
      props: object.getInterface(DBUS_PROPS_IFACE),
    };
  } catch (error) {
    throw new HelperServiceError("NetworkManager is unavailable", {
      code: "network_manager_unavailable",
      statusCode: 503,
      cause: error,
    });
  }
}

async function getProperty(propsInterface, iface, property) {
  const variant = await propsInterface.Get(iface, property);
  return dbusVariantValue(variant);
}

async function getWifiDevices() {
  const { nm } = await getNmRoot();
  const devicePaths = await withTimeout(nm.GetDevices());

  const devices = [];

  for (const path of devicePaths) {
    const deviceObject = await getProxyObject(path);
    const props = deviceObject.getInterface(DBUS_PROPS_IFACE);
    const deviceType = Number(await getProperty(props, DBUS_DEVICE_IFACE, "DeviceType"));
    if (deviceType !== DEVICE_TYPE_WIFI) continue;

    const iface = String(await getProperty(props, DBUS_DEVICE_IFACE, "Interface"));
    const state = Number(await getProperty(props, DBUS_DEVICE_IFACE, "State"));

    devices.push({
      path,
      iface,
      state,
      object: deviceObject,
      props,
      device: deviceObject.getInterface(DBUS_DEVICE_IFACE),
      wireless: deviceObject.getInterface(DBUS_WIRELESS_IFACE),
    });
  }

  return devices;
}

async function getAccessPointSnapshot(apPath) {
  if (!apPath || apPath === "/") return null;

  const apObject = await getProxyObject(apPath);
  const props = apObject.getInterface(DBUS_PROPS_IFACE);
  const ssid = decodeSsid(await getProperty(props, DBUS_ACCESS_POINT_IFACE, "Ssid"));
  const bssid = String(await getProperty(props, DBUS_ACCESS_POINT_IFACE, "HwAddress") ?? "");
  const strength = toOptionalNumber(
    Number(await getProperty(props, DBUS_ACCESS_POINT_IFACE, "Strength")),
  );
  const frequency = toOptionalNumber(
    Number(await getProperty(props, DBUS_ACCESS_POINT_IFACE, "Frequency")),
  );
  const wpaFlags = Number(await getProperty(props, DBUS_ACCESS_POINT_IFACE, "WpaFlags"));
  const rsnFlags = Number(await getProperty(props, DBUS_ACCESS_POINT_IFACE, "RsnFlags"));

  return {
    ssid,
    bssid: bssid.trim().length > 0 ? bssid : null,
    signalPercent: strength,
    channel: frequencyToChannel(frequency),
    frequencyMhz: frequency,
    security: wpaFlags > 0 || rsnFlags > 0 ? "WPA/WPA2" : null,
    path: apPath,
  };
}

async function getNetworkStatus() {
  const wifiDevices = await getWifiDevices();
  const connectedDevice =
    wifiDevices.find((device) => device.state === DEVICE_STATE_ACTIVATED) ??
    wifiDevices[0] ??
    null;

  if (!connectedDevice) {
    return {
      connected: false,
      iface: null,
      ssid: null,
      ipv4: null,
      signalPercent: null,
    };
  }

  const activeAccessPointPath = await getProperty(
    connectedDevice.props,
    DBUS_WIRELESS_IFACE,
    "ActiveAccessPoint",
  );
  const activeAccessPoint = await getAccessPointSnapshot(activeAccessPointPath);

  return {
    connected: connectedDevice.state === DEVICE_STATE_ACTIVATED,
    iface: connectedDevice.iface,
    ssid: activeAccessPoint?.ssid ?? null,
    ipv4: resolveInterfaceIpv4(connectedDevice.iface),
    signalPercent: activeAccessPoint?.signalPercent ?? null,
  };
}

async function scanNetworks() {
  const wifiDevices = await getWifiDevices();

  if (wifiDevices.length === 0) return [];

  await Promise.all(
    wifiDevices.map(async (device) => {
      try {
        await withTimeout(device.wireless.RequestScan({}), 4_000);
      } catch {
        return;
      }
    }),
  );

  await new Promise((resolve) => {
    setTimeout(resolve, 1_000);
  });

  const bySsid = new Map();

  for (const device of wifiDevices) {
    const apPaths = await withTimeout(device.wireless.GetAllAccessPoints(), 6_000);
    for (const apPath of apPaths) {
      const snapshot = await getAccessPointSnapshot(apPath);
      if (!snapshot?.ssid) continue;

      const existing = bySsid.get(snapshot.ssid);
      if (!existing || (snapshot.signalPercent ?? 0) > (existing.signalPercent ?? 0)) {
        bySsid.set(snapshot.ssid, {
          ssid: snapshot.ssid,
          bssid: snapshot.bssid,
          signalPercent: snapshot.signalPercent,
          channel: snapshot.channel,
          frequencyMhz: snapshot.frequencyMhz,
          security: snapshot.security,
          path: snapshot.path,
          devicePath: device.path,
        });
      }
    }
  }

  return [...bySsid.values()]
    .sort((left, right) => (right.signalPercent ?? 0) - (left.signalPercent ?? 0))
    .map((network) => ({
      ssid: network.ssid,
      bssid: network.bssid,
      signalPercent: network.signalPercent,
      channel: network.channel,
      frequencyMhz: network.frequencyMhz,
      security: network.security,
    }));
}

async function listSavedConnections() {
  const settingsObject = await getProxyObject(DBUS_SETTINGS_PATH);
  const settingsInterface = settingsObject.getInterface(DBUS_SETTINGS_IFACE);
  const paths = await withTimeout(settingsInterface.ListConnections(), 5_000);

  const connections = [];

  for (const path of paths) {
    const connectionObject = await getProxyObject(path);
    const settingsConnection = connectionObject.getInterface(
      DBUS_SETTINGS_CONNECTION_IFACE,
    );
    const settings = await withTimeout(settingsConnection.GetSettings(), 5_000);
    const connectionSettings = settings.connection ?? {};
    const wirelessSettings = settings["802-11-wireless"] ?? {};

    const type = dbusVariantValue(connectionSettings.type);
    const id = dbusVariantValue(connectionSettings.id);
    const ssid = decodeSsid(dbusVariantValue(wirelessSettings.ssid));

    connections.push({
      path,
      type: typeof type === "string" ? type : "",
      id: typeof id === "string" ? id : "",
      ssid,
    });
  }

  return connections;
}

async function findDeviceForSsid(ssid) {
  const wifiDevices = await getWifiDevices();
  if (wifiDevices.length === 0) {
    throw new HelperServiceError("No Wi-Fi device found", {
      code: "network_manager_unavailable",
      statusCode: 503,
    });
  }

  for (const device of wifiDevices) {
    const apPaths = await withTimeout(device.wireless.GetAllAccessPoints(), 6_000);
    for (const apPath of apPaths) {
      const accessPoint = await getAccessPointSnapshot(apPath);
      if (accessPoint?.ssid === ssid) {
        return {
          device,
          accessPoint,
        };
      }
    }
  }

  return {
    device: wifiDevices[0],
    accessPoint: null,
  };
}

function enforceConnectRateLimit(requestId) {
  const key = requestId && requestId.length > 0 ? requestId : "anonymous";
  const now = Date.now();
  const oneMinuteAgo = now - 60_000;
  const history = connectAttempts.get(key) ?? [];
  const activeHistory = history.filter((timestamp) => timestamp > oneMinuteAgo);

  if (activeHistory.length >= CONNECT_RATE_LIMIT_PER_MINUTE) {
    throw new HelperServiceError("Too many network connect attempts", {
      code: "invalid_request",
      statusCode: 429,
    });
  }

  activeHistory.push(now);
  connectAttempts.set(key, activeHistory);
}

async function connectNetwork({ ssid, password }, requestId) {
  enforceConnectRateLimit(requestId);

  const { nm } = await getNmRoot();
  const { device, accessPoint } = await findDeviceForSsid(ssid);

  const savedConnections = await listSavedConnections();
  const existingConnection =
    savedConnections.find(
      (connection) =>
        connection.type === "802-11-wireless" &&
        (connection.ssid === ssid || connection.id === ssid),
    ) ?? null;

  if (existingConnection) {
    await withTimeout(
      nm.ActivateConnection(
        existingConnection.path,
        device.path,
        accessPoint?.path ?? "/",
      ),
      10_000,
    );

    return getNetworkStatus();
  }

  const settings = {
    connection: {
      id: new Variant("s", ssid),
      type: new Variant("s", "802-11-wireless"),
      uuid: new Variant("s", randomUUID()),
      autoconnect: new Variant("b", true),
    },
    "802-11-wireless": {
      ssid: new Variant("ay", [...Buffer.from(ssid, "utf8")]),
      mode: new Variant("s", "infrastructure"),
    },
    ipv4: {
      method: new Variant("s", "auto"),
    },
    ipv6: {
      method: new Variant("s", "auto"),
    },
  };

  if (typeof password === "string") {
    settings["802-11-wireless-security"] = {
      "key-mgmt": new Variant("s", "wpa-psk"),
      psk: new Variant("s", password),
    };
  }

  await withTimeout(
    nm.AddAndActivateConnection(
      settings,
      device.path,
      accessPoint?.path ?? "/",
    ),
    15_000,
  );

  return getNetworkStatus();
}

async function disconnectNetwork({ iface }) {
  const wifiDevices = await getWifiDevices();
  const selectedDevice =
    (iface
      ? wifiDevices.find((device) => device.iface === iface)
      : wifiDevices.find((device) => device.state === DEVICE_STATE_ACTIVATED)) ??
    null;

  if (!selectedDevice) {
    return getNetworkStatus();
  }

  await withTimeout(selectedDevice.device.Disconnect(), 8_000);
  return getNetworkStatus();
}

function broadcastEvent(event) {
  const payload = `${JSON.stringify({
    type: "event",
    event,
  })}\n`;

  for (const socket of activeSockets) {
    if (!socket.writable) continue;
    socket.write(payload);
  }
}

async function emitConnectionChangedEvent() {
  try {
    const status = await getNetworkStatus();
    broadcastEvent({
      type: "network.connection.changed",
      timestamp: new Date().toISOString(),
      iface: status.iface,
      ssid: status.ssid,
      connected: status.connected,
    });
  } catch (error) {
    log({
      level: "warn",
      action: "dbus.network.event.connection",
      status: "error",
      message: "Failed to emit connection change event",
      error,
    });
  }
}

async function attachDbusEventBridge() {
  const { nm, props } = await getNmRoot();
  const wifiDevices = await getWifiDevices();

  props.on("PropertiesChanged", async (iface, changed) => {
    if (iface !== DBUS_IFACE) return;
    const changedRecord = changed ?? {};

    if ("ActiveConnections" in changedRecord || "PrimaryConnection" in changedRecord) {
      await emitConnectionChangedEvent();
    }
  });

  for (const device of wifiDevices) {
    device.device.on("StateChanged", async (newState, _oldState, reason) => {
      let status = {
        connected: false,
        iface: device.iface,
        ssid: null,
      };

      try {
        const current = await getNetworkStatus();
        status = {
          connected: current.connected,
          iface: current.iface,
          ssid: current.ssid,
        };
      } catch {
        // ignore and emit best effort event
      }

      broadcastEvent({
        type: "network.device.state.changed",
        timestamp: new Date().toISOString(),
        iface: status.iface,
        ssid: status.ssid,
        connected: status.connected,
        state: String(newState),
        reason: String(reason),
      });
    });
  }

  nm.on("DeviceAdded", async () => {
    await emitConnectionChangedEvent();
  });
  nm.on("DeviceRemoved", async () => {
    await emitConnectionChangedEvent();
  });
}

async function handleRpcRequest(request) {
  if (request.method === "network.getStatus") {
    return withTimeout(getNetworkStatus());
  }

  if (request.method === "network.scan") {
    return withTimeout(scanNetworks(), 15_000);
  }

  if (request.method === "network.connect") {
    return withTimeout(connectNetwork(request.params, request.requestId), 20_000);
  }

  if (request.method === "network.disconnect") {
    return withTimeout(disconnectNetwork(request.params), 10_000);
  }

  throw new HelperServiceError("Method not allowed", {
    code: "invalid_request",
    statusCode: 400,
  });
}

async function start() {
  await ensureSocketDirectory(SOCKET_PATH, SOCKET_GROUP);
  await safeUnlink(SOCKET_PATH);

  helperServer = net.createServer((socket) => {
    activeSockets.add(socket);
    let buffer = "";

    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      let newline = buffer.indexOf("\n");

      while (newline >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf("\n");

        if (!line) continue;

        let parsedRequest = null;
        try {
          parsedRequest = parseRpcRequest(line);
        } catch (error) {
          const helperError = toCodeFromError(error);
          socket.write(
            `${JSON.stringify({
              id: null,
              ok: false,
              error: {
                code: helperError.code,
                message: helperError.message,
              },
            })}\n`,
          );
          continue;
        }

        const startedAt = performance.now();
        log({
          action: "dbus.network.rpc",
          status: "start",
          requestId: parsedRequest.requestId ?? parsedRequest.id,
          meta: {
            method: parsedRequest.method,
          },
        });

        void handleRpcRequest(parsedRequest)
          .then((result) => {
            socket.write(
              `${JSON.stringify({
                id: parsedRequest.id,
                ok: true,
                result,
              })}\n`,
            );

            log({
              action: "dbus.network.rpc",
              status: "success",
              requestId: parsedRequest.requestId ?? parsedRequest.id,
              durationMs: Number((performance.now() - startedAt).toFixed(2)),
              meta: {
                method: parsedRequest.method,
              },
            });
          })
          .catch((error) => {
            const helperError = toCodeFromError(error);
            socket.write(
              `${JSON.stringify({
                id: parsedRequest.id,
                ok: false,
                error: toErrorPayload(helperError),
              })}\n`,
            );

            log({
              level: helperError.statusCode >= 500 ? "error" : "warn",
              action: "dbus.network.rpc",
              status: "error",
              requestId: parsedRequest.requestId ?? parsedRequest.id,
              durationMs: Number((performance.now() - startedAt).toFixed(2)),
              meta: {
                method: parsedRequest.method,
              },
              error: helperError,
            });
          });
      }
    });

    socket.on("error", (error) => {
      log({
        level: "warn",
        action: "dbus.network.socket",
        status: "error",
        message: "Client socket error",
        error,
      });
    });

    socket.on("close", () => {
      activeSockets.delete(socket);
    });
  });

  await new Promise((resolve, reject) => {
    helperServer.once("error", reject);
    helperServer.listen(SOCKET_PATH, resolve);
  });

  await ensureSocketPermissions(SOCKET_PATH, SOCKET_GROUP);

  log({
    action: "dbus.network.helper.start",
    status: "success",
    meta: {
      socketPath: SOCKET_PATH,
      socketGroup: SOCKET_GROUP,
    },
  });

  attachDbusEventBridge().catch((error) => {
    const mapped = toCodeFromError(error);
    log({
      level: "warn",
      action: "dbus.network.events.start",
      status: "error",
      message: "DBus event bridge failed to start; helper will continue without events",
      error: mapped,
    });
  });
}

async function shutdown(signal) {
  log({
    action: "dbus.network.helper.stop",
    status: "start",
    message: `Received ${signal}, shutting down helper`,
  });

  if (helperServer) {
    await new Promise((resolve) => {
      helperServer.close(() => resolve(undefined));
    });
  }

  await safeUnlink(SOCKET_PATH);
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

start().catch((error) => {
  const mapped = toCodeFromError(error);
  log({
    level: "error",
    action: "dbus.network.helper.start",
    status: "error",
    message: "Failed to start DBus helper",
    error: mapped,
  });
  process.exit(1);
});

export {
  HelperServiceError,
  connectNetwork,
  decodeSsid,
  disconnectNetwork,
  getNetworkStatus,
  scanNetworks,
  toCodeFromError,
};
