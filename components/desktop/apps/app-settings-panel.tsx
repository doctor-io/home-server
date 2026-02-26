"use client";

import type { AppActionTarget } from "@/components/desktop/app-grid";
import { useAppCompose } from "@/hooks/useAppCompose";
import { useStoreActions } from "@/hooks/useStoreActions";
import { useStoreApp } from "@/hooks/useStoreApp";
import type { StoreAppDetail } from "@/lib/shared/contracts/apps";
import { Check, Info, Loader2, TerminalSquare, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const CPU_SHARES_OPTIONS = ["Low", "Medium", "High"] as const;
const RESTART_POLICY_OPTIONS = [
  "on-failure",
  "always",
  "unless-stopped",
] as const;
const PROTOCOL_OPTIONS = ["http", "https"] as const;
const NETWORK_OPTIONS = ["bridge", "host"] as const;
const PORT_PROTOCOL_OPTIONS = ["TCP", "UDP", "TCP + UDP"] as const;

type AppSettingsPanelMode = "install" | "edit" | "custom";

type AppSettingsPanelProps = {
  // For edit mode (from app grid)
  target?: AppActionTarget;

  // For install mode (from app store)
  template?: StoreAppDetail;

  // For custom mode (manual app creation)
  customDefaults?: {
    name?: string;
    iconUrl?: string;
  };

  // Optional close handler
  onClose?: () => void;
};

type PortProtocol = (typeof PORT_PROTOCOL_OPTIONS)[number];

type PortRow = {
  id: string;
  host: string;
  container: string;
  protocol: PortProtocol;
};

type VolumeRow = {
  id: string;
  host: string;
  container: string;
};

type EnvRow = {
  id: string;
  key: string;
  value: string;
};

type WebUiState = {
  protocol: (typeof PROTOCOL_OPTIONS)[number];
  host: string;
  port: string;
  path: string;
};

type AppSettingsState = {
  dockerImage: string;
  title: string;
  iconUrl: string;
  webUi: WebUiState;
  network: string;
  ports: PortRow[];
  volumes: VolumeRow[];
  envVars: EnvRow[];
  devices: string[];
  containerCommands: string[];
  privileged: boolean;
  memoryLimit: number;
  cpuShares: (typeof CPU_SHARES_OPTIONS)[number];
  restartPolicy: (typeof RESTART_POLICY_OPTIONS)[number];
  capabilities: string;
  hostname: string;
};

function toAppId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toHostname(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized.length > 0 ? normalized : "app";
}

function toBoolean(value: string | undefined, fallback = false) {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes")
    return true;
  if (normalized === "0" || normalized === "false" || normalized === "no")
    return false;
  return fallback;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function parseMemoryLimit(raw: string | undefined, fallback = 4096) {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw.replace(/[^0-9]/g, ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return clampNumber(parsed, 0, 8192);
}

function parseCpuShares(raw: string | undefined) {
  if (!raw) return "High" as const;

  const normalized = raw.trim().toLowerCase();
  if (normalized === "low") return "Low" as const;
  if (normalized === "medium") return "Medium" as const;
  if (normalized === "high") return "High" as const;
  return "High" as const;
}

function parseRestartPolicy(raw: string | undefined) {
  if (!raw) return "always" as const;

  const normalized = raw.trim().toLowerCase();
  if (normalized === "on-failure") return "on-failure" as const;
  if (normalized === "always") return "always" as const;
  if (normalized === "unless-stopped") return "unless-stopped" as const;
  return "always" as const;
}

function parseWebUi(
  value: string | undefined,
  fallbackUrl: string,
): WebUiState {
  const source = value && value.trim().length > 0 ? value : fallbackUrl;

  try {
    const parsed = new URL(source);
    return {
      protocol: parsed.protocol.replace(":", "") === "https" ? "https" : "http",
      host: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname === "/" ? "" : parsed.pathname,
    };
  } catch {
    return {
      protocol: "http",
      host: "localhost",
      port: "",
      path: "",
    };
  }
}

function toDefaultPortRows(port: string): PortRow[] {
  if (!port) return [];

  return [
    {
      id: "port-1",
      host: port,
      container: port,
      protocol: "TCP",
    },
  ];
}

function toEnvRows(env: Record<string, string>): EnvRow[] {
  return Object.entries(env)
    .filter(([key]) => key !== "APP_URL" && key !== "VOLUMES")
    .slice(0, 8)
    .map(([key, value], index) => ({
      id: `env-${index + 1}`,
      key,
      value,
    }));
}

function buildInitialState(input: {
  target?: AppActionTarget;
  template?: StoreAppDetail;
  customDefaults?: { name?: string; iconUrl?: string };
  composeData?: {
    image?: string;
    ports?: string[];
    environment?: Record<string, string>;
    volumes?: string[];
    networkMode?: string;
    restart?: string;
    privileged?: boolean;
    capAdd?: string[];
    hostname?: string;
  };
}): AppSettingsState {
  const { target, template, customDefaults, composeData } = input;

  // Priority: installed config > template > target > custom defaults > fallback
  const installed = template?.installedConfig;

  // Merge env from installed config and template defaults
  const templateDefaults = Object.fromEntries(
    (template?.env ?? []).map(envDef => [envDef.name, envDef.default ?? ""])
  );
  const env = { ...templateDefaults, ...(installed?.env ?? {}) };

  // Determine appId
  const appId =
    template?.id ?? (target ? toAppId(target.appName) : "custom-app");

  // Determine name
  const name =
    installed?.displayName ??
    template?.name ??
    target?.appName ??
    customDefaults?.name ??
    "";

  // Determine icon
  const iconUrl =
    installed?.iconUrl ?? template?.logoUrl ?? customDefaults?.iconUrl ?? "";

  // Determine dashboard URL for webUi parsing
  const dashboardUrl = target?.dashboardUrl ?? template?.repositoryUrl ?? "";
  const webUi = parseWebUi(env.APP_URL, dashboardUrl);
  const resolvedPort = template?.webUiPort
    ? String(template.webUiPort)
    : webUi.port;

  const hostname = installed?.stackName
    ? toHostname(installed.stackName)
    : toHostname(name || appId);

  // Parse volumes from compose data or VOLUMES env var
  let volumes: VolumeRow[] = [];
  if (composeData?.volumes && composeData.volumes.length > 0) {
    volumes = composeData.volumes.map((volume, index) => {
      // Parse "host:container" format
      const [host, container] = volume.split(":");
      return {
        id: nextId(`volume-${index}`),
        host: host || "",
        container: container || "",
      };
    });
  } else if (env.VOLUMES) {
    try {
      const parsed = JSON.parse(env.VOLUMES) as Array<{ host: string; container: string }>;
      volumes = parsed.map((v, index) => ({
        id: nextId(`volume-${index}`),
        host: v.host || "",
        container: v.container || "",
      }));
    } catch {
      // Invalid JSON, ignore
    }
  }

  // Parse ports from compose data
  let ports: PortRow[] = [];
  if (composeData?.ports && composeData.ports.length > 0) {
    ports = composeData.ports.map((port, index) => {
      // Parse "host:container" or "host:container/protocol" format
      const [hostPort, rest] = port.split(":");
      const containerPort = rest?.split("/")[0] || hostPort;
      return {
        id: nextId(`port-${index}`),
        host: hostPort || "",
        container: containerPort || "",
        protocol: "TCP" as const,
      };
    });
  } else {
    ports = toDefaultPortRows(resolvedPort);
  }

  // Merge environment from compose and template
  const composeEnv = composeData?.environment ?? {};
  const mergedEnv = { ...composeEnv, ...env };

  return {
    dockerImage: composeData?.image || env.DOCKER_IMAGE || env.IMAGE || `${appId}/${appId}:latest`,
    title: name,
    iconUrl,
    webUi: {
      ...webUi,
      port: resolvedPort,
    },
    network: NETWORK_OPTIONS.includes(
      (composeData?.networkMode?.toLowerCase() ?? env.NETWORK_MODE?.toLowerCase() ?? "bridge") as "bridge" | "host",
    )
      ? (composeData?.networkMode?.toLowerCase() ?? env.NETWORK_MODE?.toLowerCase() ?? "bridge")
      : "bridge",
    ports,
    volumes,
    envVars: toEnvRows(mergedEnv),
    devices: [],
    containerCommands: [],
    privileged: composeData?.privileged ?? toBoolean(env.PRIVILEGED, false),
    memoryLimit: parseMemoryLimit(env.MEMORY_LIMIT, 4096),
    cpuShares: parseCpuShares(env.CPU_SHARES),
    restartPolicy: parseRestartPolicy(env.RESTART_POLICY),
    capabilities: env.CAP_ADD?.trim() ?? "",
    hostname,
  };
}

function nextId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

export function AppSettingsPanel({
  target,
  template,
  customDefaults,
  onClose,
}: AppSettingsPanelProps) {
  // Determine app ID and mode
  const appId = useMemo(() => {
    if (target) return toAppId(target.appName);
    if (template) return template.id;
    return undefined;
  }, [target, template]);

  // Fetch installed config only if we have an appId
  const { data: detail } = useStoreApp(appId!);

  // Fetch docker-compose defaults when installing
  const { data: composeData } = useAppCompose(appId, !!appId && !detail?.installedConfig);

  // Determine mode based on available data
  const mode = useMemo<AppSettingsPanelMode>(() => {
    if (detail?.installedConfig) return "edit";
    if (template) return "install";
    return "custom";
  }, [detail, template]);

  const { saveAppSettings, installApp, installCustomApp } = useStoreActions();

  // Build initial state from appropriate source
  const initialState = useMemo(
    () =>
      buildInitialState({
        target,
        template: template ?? detail ?? undefined,
        customDefaults,
        composeData,
      }),
    [target, template, detail, customDefaults, composeData],
  );

  const [state, setState] = useState<AppSettingsState>(initialState);
  const [didSave, setDidSave] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setState(initialState);
    setDidSave(false);
    setSaveError(null);
  }, [initialState]);

  async function handleSave() {
    if (isSaving) return;

    setSaveError(null);
    setIsSaving(true);

    try {
      const currentEnv = Object.fromEntries(
        state.envVars
          .filter((row) => row.key.trim())
          .map((row) => [row.key, row.value]),
      );

      // Add volumes to env as JSON
      if (state.volumes.length > 0) {
        const volumesData = state.volumes
          .filter((v) => v.host.trim() && v.container.trim())
          .map((v) => ({ host: v.host, container: v.container }));
        if (volumesData.length > 0) {
          currentEnv.VOLUMES = JSON.stringify(volumesData);
        }
      }

      const currentPort = state.webUi.port
        ? Number.parseInt(state.webUi.port, 10)
        : undefined;

      if (mode === "edit") {
        // Edit mode: save metadata + redeploy if config changed
        if (!appId) throw new Error("App ID is required for edit mode");

        const payload: {
          appId: string;
          displayName: string;
          iconUrl: string | null;
          env?: Record<string, string>;
          webUiPort?: number;
        } = {
          appId,
          displayName: state.title,
          iconUrl: state.iconUrl || null,
        };

        // Only include env if changed
        const initialEnv = Object.fromEntries(
          initialState.envVars
            .filter((row) => row.key.trim())
            .map((row) => [row.key, row.value]),
        );

        if (JSON.stringify(currentEnv) !== JSON.stringify(initialEnv)) {
          payload.env = currentEnv;
        }

        // Only include port if changed
        const initialPort = initialState.webUi.port
          ? Number.parseInt(initialState.webUi.port, 10)
          : undefined;

        if (currentPort !== initialPort && currentPort !== undefined) {
          payload.webUiPort = currentPort;
        }

        await saveAppSettings(payload);
        setDidSave(true);
        onClose?.();
      } else if (mode === "install") {
        // Install mode: install app from template with custom settings
        if (!appId) throw new Error("App ID is required for install mode");

        await installApp({
          appId,
          displayName: state.title,
          env: currentEnv,
          webUiPort: currentPort,
        });

        setDidSave(true);
        onClose?.();
      } else {
        // Custom mode: install custom app
        await installCustomApp({
          name: state.title,
          iconUrl: state.iconUrl || undefined,
          webUiPort: currentPort,
          sourceType: "docker-compose",
          source: state.dockerImage, // TODO: Allow user to provide compose YAML
        });

        setDidSave(true);
        onClose?.();
      }
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : `Failed to ${mode === "edit" ? "save" : "install"}`,
      );
    } finally {
      setIsSaving(false);
    }
  }

  const headerTitle = useMemo(() => {
    if (mode === "edit") return `${state.title || "App"} Settings`;
    if (mode === "install") return `Install ${state.title || "App"}`;
    return "Custom App Configuration";
  }, [mode, state.title]);

  const buttonLabel = useMemo(() => {
    if (mode === "edit") return isSaving ? "Saving..." : "Save";
    return isSaving ? "Installing..." : "Install";
  }, [mode, isSaving]);

  return (
    <div className="flex h-full flex-col bg-card/90">
      <header className="flex items-center justify-between border-b border-glass-border px-6 py-4">
        <h3 className="text-xl font-semibold text-foreground">{headerTitle}</h3>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded-lg border border-glass-border p-2 text-muted-foreground transition-colors hover:bg-secondary/45 hover:text-foreground"
            aria-label="Terminal and Logs"
            title="Terminal and Logs"
          >
            <TerminalSquare className="size-4" />
          </button>
          <button
            type="button"
            className="rounded-lg border border-glass-border p-2 text-muted-foreground transition-colors hover:bg-secondary/45 hover:text-foreground"
            aria-label="Export ComposeFile"
            title="Export ComposeFile"
          >
            <Upload className="size-4" />
          </button>
        </div>
      </header>

      <section className="flex-1 overflow-y-auto px-6 py-5">
        <div className="mb-5 border-b border-glass-border pb-4">
          <button className="border-b-2 border-primary pb-2 text-lg font-semibold text-primary cursor-default">
            {appId}
          </button>
        </div>

        <div className="space-y-4">
          <Field label="Docker Image *">
            <Input
              readOnly
              value={state.dockerImage}
              onChange={(value) =>
                setState((previous) => ({
                  ...previous,
                  dockerImage: value,
                }))
              }
              placeholder="e.g. hello-world:latest"
              success
            />
          </Field>

          <Field label="Title *">
            <Input
              value={state.title}
              onChange={(value) =>
                setState((previous) => ({
                  ...previous,
                  title: value,
                }))
              }
              placeholder="e.g. Your App Name"
              success
            />
          </Field>

          <Field label="Icon URL">
            <div className="flex items-center gap-2">
              <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-glass-border bg-secondary/30">
                {state.iconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={state.iconUrl}
                    alt={`${state.title || "App"} icon`}
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">N/A</span>
                )}
              </div>
              <Input
                value={state.iconUrl}
                onChange={(value) =>
                  setState((previous) => ({
                    ...previous,
                    iconUrl: value,
                  }))
                }
                placeholder="Your custom icon URL"
              />
            </div>
          </Field>

          <Field label="Web UI">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-12">
              <div className="md:col-span-2">
                <Select
                  ariaLabel="Web UI protocol"
                  value={state.webUi.protocol}
                  options={PROTOCOL_OPTIONS.map((option) => ({
                    value: option,
                    label: `${option}://`,
                  }))}
                  onChange={(value) =>
                    setState((previous) => ({
                      ...previous,
                      webUi: {
                        ...previous.webUi,
                        protocol:
                          value as AppSettingsState["webUi"]["protocol"],
                      },
                    }))
                  }
                />
              </div>
              <div className="md:col-span-5">
                <Input
                  value={state.webUi.host}
                  onChange={(value) =>
                    setState((previous) => ({
                      ...previous,
                      webUi: {
                        ...previous.webUi,
                        host: value,
                      },
                    }))
                  }
                  placeholder="demo.casaos.io"
                />
              </div>
              <div className="md:col-span-2">
                <Input
                  value={state.webUi.port}
                  onChange={(value) =>
                    setState((previous) => ({
                      ...previous,
                      webUi: {
                        ...previous.webUi,
                        port: value.replace(/[^0-9]/g, ""),
                      },
                    }))
                  }
                  placeholder="Ports"
                />
              </div>
              <div className="md:col-span-3">
                <Input
                  value={state.webUi.path}
                  onChange={(value) =>
                    setState((previous) => ({
                      ...previous,
                      webUi: {
                        ...previous.webUi,
                        path: value,
                      },
                    }))
                  }
                  placeholder="/index.html Optional"
                />
              </div>
            </div>
          </Field>

          <Field label="Network">
            <Select
              ariaLabel="Network"
              value={state.network}
              options={NETWORK_OPTIONS.map((option) => ({
                value: option,
                label: option,
              }))}
              onChange={(value) =>
                setState((previous) => ({
                  ...previous,
                  network: value,
                }))
              }
            />
          </Field>

          <Field
            label="Port"
            withAdd
            onAdd={() =>
              setState((previous) => ({
                ...previous,
                ports: [
                  ...previous.ports,
                  {
                    id: nextId("port"),
                    host: "",
                    container: "",
                    protocol: "TCP",
                  },
                ],
              }))
            }
          >
            {state.ports.length === 0 ? (
              <HintText />
            ) : (
              <div className="space-y-2">
                {state.ports.map((row) => (
                  <PortEditor
                    key={row.id}
                    row={row}
                    onRemove={() =>
                      setState((previous) => ({
                        ...previous,
                        ports: previous.ports.filter(
                          (item) => item.id !== row.id,
                        ),
                      }))
                    }
                    onChange={(nextRow) =>
                      setState((previous) => ({
                        ...previous,
                        ports: previous.ports.map((item) =>
                          item.id === row.id ? nextRow : item,
                        ),
                      }))
                    }
                  />
                ))}
              </div>
            )}
          </Field>

          <Field
            label="Volumes"
            withAdd
            onAdd={() =>
              setState((previous) => ({
                ...previous,
                volumes: [
                  ...previous.volumes,
                  {
                    id: nextId("volume"),
                    host: "",
                    container: "",
                  },
                ],
              }))
            }
          >
            {state.volumes.length === 0 ? (
              <HintText />
            ) : (
              <div className="space-y-2">
                {state.volumes.map((row) => (
                  <VolumeEditor
                    key={row.id}
                    row={row}
                    onRemove={() =>
                      setState((previous) => ({
                        ...previous,
                        volumes: previous.volumes.filter(
                          (item) => item.id !== row.id,
                        ),
                      }))
                    }
                    onChange={(nextRow) =>
                      setState((previous) => ({
                        ...previous,
                        volumes: previous.volumes.map((item) =>
                          item.id === row.id ? nextRow : item,
                        ),
                      }))
                    }
                  />
                ))}
              </div>
            )}
          </Field>

          <Field
            label="Environment Variables"
            withAdd
            onAdd={() =>
              setState((previous) => ({
                ...previous,
                envVars: [
                  ...previous.envVars,
                  {
                    id: nextId("env"),
                    key: "",
                    value: "",
                  },
                ],
              }))
            }
          >
            {state.envVars.length === 0 ? (
              <HintText />
            ) : (
              <div className="space-y-2">
                {state.envVars.map((row) => (
                  <EnvEditor
                    key={row.id}
                    row={row}
                    onRemove={() =>
                      setState((previous) => ({
                        ...previous,
                        envVars: previous.envVars.filter(
                          (item) => item.id !== row.id,
                        ),
                      }))
                    }
                    onChange={(nextRow) =>
                      setState((previous) => ({
                        ...previous,
                        envVars: previous.envVars.map((item) =>
                          item.id === row.id ? nextRow : item,
                        ),
                      }))
                    }
                  />
                ))}
              </div>
            )}
          </Field>

          <Field
            label="Devices"
            withAdd
            onAdd={() =>
              setState((previous) => ({
                ...previous,
                devices: [...previous.devices, ""],
              }))
            }
          >
            <HintText />
          </Field>

          <Field
            label="Container Command"
            withAdd
            onAdd={() =>
              setState((previous) => ({
                ...previous,
                containerCommands: [...previous.containerCommands, ""],
              }))
            }
          >
            <HintText />
          </Field>

          <Field label="Privileges">
            <button
              type="button"
              role="switch"
              aria-checked={state.privileged}
              onClick={() => {
                setState((previous) => ({
                  ...previous,
                  privileged: !previous.privileged,
                }));
                setDidSave(false);
              }}
              className={`relative h-7 w-12 rounded-full transition-colors ${
                state.privileged ? "bg-primary/70" : "bg-muted"
              }`}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-background shadow transition-transform ${
                  state.privileged ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </Field>

          <Field label="Memory Limit">
            <div className="space-y-2">
              <input
                id="memory-limit"
                aria-label="Memory Limit"
                type="range"
                min={0}
                max={8192}
                value={state.memoryLimit}
                onChange={(event) => {
                  setState((previous) => ({
                    ...previous,
                    memoryLimit: Number(event.target.value),
                  }));
                  setDidSave(false);
                }}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-primary"
              />
              <p className="text-xs text-muted-foreground">
                {state.memoryLimit} MB
              </p>
            </div>
          </Field>

          <Field label="CPU Shares">
            <Select
              ariaLabel="CPU Shares"
              value={state.cpuShares}
              options={CPU_SHARES_OPTIONS.map((option) => ({
                value: option,
                label: option,
              }))}
              onChange={(value) => {
                setState((previous) => ({
                  ...previous,
                  cpuShares: value as AppSettingsState["cpuShares"],
                }));
                setDidSave(false);
              }}
            />
          </Field>

          <Field label="Restart Policy">
            <Select
              ariaLabel="Restart Policy"
              value={state.restartPolicy}
              options={RESTART_POLICY_OPTIONS.map((option) => ({
                value: option,
                label: option,
              }))}
              onChange={(value) => {
                setState((previous) => ({
                  ...previous,
                  restartPolicy: value as AppSettingsState["restartPolicy"],
                }));
                setDidSave(false);
              }}
            />
          </Field>

          <Field label="Container Capabilities (cap-add)">
            <Input
              ariaLabel="Container Capabilities (cap-add)"
              value={state.capabilities}
              onChange={(value) =>
                setState((previous) => ({
                  ...previous,
                  capabilities: value,
                }))
              }
              placeholder="NET_ADMIN,SYS_TIME"
            />
          </Field>

          <Field label="Container Hostname">
            <Input
              ariaLabel="Container Hostname"
              value={state.hostname}
              onChange={(value) =>
                setState((previous) => ({
                  ...previous,
                  hostname: toHostname(value),
                }))
              }
              placeholder="Hostname of app container"
              success
            />
          </Field>
        </div>
      </section>

      <footer className="flex items-center justify-between border-t border-glass-border px-6 py-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">
            {didSave
              ? mode === "edit"
                ? "Saved successfully"
                : "Installation started"
              : mode === "edit"
                ? "Changes are local for now"
                : "Configure settings before installing"}
          </span>
          {saveError && (
            <span className="text-xs text-status-red">{saveError}</span>
          )}
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-full bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isSaving && <Loader2 className="size-4 animate-spin" />}
          {buttonLabel}
        </button>
      </footer>
    </div>
  );
}

function Field({
  label,
  children,
  withAdd = false,
  onAdd,
}: {
  label: string;
  children: React.ReactNode;
  withAdd?: boolean;
  onAdd?: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-foreground">{label}</label>
        {withAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="rounded-full border border-glass-border bg-secondary/40 px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-secondary/60"
          >
            + Add
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function Input({
  ariaLabel,
  value,
  onChange,
  placeholder,
  readOnly = false,
  success = false,
}: {
  ariaLabel?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  success?: boolean;
}) {
  return (
    <div className="relative">
      <input
        type="text"
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        className={`h-10 w-full rounded-lg border bg-secondary/35 px-3 pr-10 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none ${
          success
            ? "border-status-green/70 focus:border-status-green"
            : "border-glass-border focus:border-primary/50"
        } ${readOnly ? "opacity-80" : ""}`}
      />
      {success && (
        <Check className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-status-green" />
      )}
    </div>
  );
}

function Select({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 w-full rounded-lg border border-glass-border bg-secondary/35 px-3 text-sm text-foreground focus:border-primary/50 focus:outline-none"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function HintText() {
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <Info className="size-4" />
      Click &quot;+&quot; to add one.
    </p>
  );
}

function PortEditor({
  row,
  onRemove,
  onChange,
}: {
  row: PortRow;
  onRemove: () => void;
  onChange: (row: PortRow) => void;
}) {
  return (
    <div className="rounded-lg border border-glass-border bg-secondary/20 p-2">
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-muted-foreground hover:text-status-red"
        >
          Remove
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <Input
          value={row.host}
          onChange={(value) =>
            onChange({ ...row, host: value.replace(/[^0-9]/g, "") })
          }
          placeholder="Host"
        />
        <Input
          value={row.container}
          onChange={(value) =>
            onChange({ ...row, container: value.replace(/[^0-9]/g, "") })
          }
          placeholder="Container"
        />
        <Select
          ariaLabel="Protocol"
          value={row.protocol}
          options={PORT_PROTOCOL_OPTIONS.map((option) => ({
            value: option,
            label: option,
          }))}
          onChange={(value) =>
            onChange({ ...row, protocol: value as PortProtocol })
          }
        />
      </div>
    </div>
  );
}

function VolumeEditor({
  row,
  onRemove,
  onChange,
}: {
  row: VolumeRow;
  onRemove: () => void;
  onChange: (row: VolumeRow) => void;
}) {
  return (
    <div className="rounded-lg border border-glass-border bg-secondary/20 p-2">
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-muted-foreground hover:text-status-red"
        >
          Remove
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <Input
          value={row.host}
          onChange={(value) => onChange({ ...row, host: value })}
          placeholder="Host"
        />
        <Input
          value={row.container}
          onChange={(value) => onChange({ ...row, container: value })}
          placeholder="Container"
        />
      </div>
    </div>
  );
}

function EnvEditor({
  row,
  onRemove,
  onChange,
}: {
  row: EnvRow;
  onRemove: () => void;
  onChange: (row: EnvRow) => void;
}) {
  return (
    <div className="rounded-lg border border-glass-border bg-secondary/20 p-2">
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-muted-foreground hover:text-status-red"
        >
          Remove
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <Input
          value={row.key}
          onChange={(value) => onChange({ ...row, key: value })}
          placeholder="KEY"
        />
        <Input
          value={row.value}
          onChange={(value) => onChange({ ...row, value })}
          placeholder="VALUE"
        />
      </div>
    </div>
  );
}
