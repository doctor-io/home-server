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

export {
  CONNECT_RATE_LIMIT_PER_MINUTE,
  DBUS_ACCESS_POINT_IFACE,
  DBUS_DEVICE_IFACE,
  DBUS_IFACE,
  DBUS_METHOD_TIMEOUT_MS,
  DBUS_PATH,
  DBUS_PROPS_IFACE,
  DBUS_SERVICE,
  DBUS_SETTINGS_CONNECTION_IFACE,
  DBUS_SETTINGS_IFACE,
  DBUS_SETTINGS_PATH,
  DBUS_WIRELESS_IFACE,
  DEVICE_STATE_ACTIVATED,
  DEVICE_TYPE_WIFI,
  SOCKET_GROUP,
  SOCKET_PATH,
};
