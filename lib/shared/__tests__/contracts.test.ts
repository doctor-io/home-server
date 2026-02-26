import { describe, expectTypeOf, it } from "vitest";
import type {
  DockerPullProgressDetail,
  InstalledApp,
  InstalledStackConfig,
  StoreAppDetail,
  StoreAppSummary,
  StoreOperation,
  StoreOperationEvent,
} from "@/lib/shared/contracts/apps";
import type {
  FileListEntry,
  FileReadResponse,
  FileServiceErrorCode,
  FileWriteRequest,
  FileWriteResponse,
} from "@/lib/shared/contracts/files";
import type { SystemMetricsSnapshot } from "@/lib/shared/contracts/system";
import type { WeatherSnapshot } from "@/lib/shared/contracts/weather";
import type {
  ConnectNetworkRequest,
  NetworkEvent,
  NetworkStatus,
  WifiAccessPoint,
} from "@/lib/shared/contracts/network";
import type {
  TerminalExecuteRequest,
  TerminalExecuteResult,
} from "@/lib/shared/contracts/terminal";

describe("shared contracts", () => {
  it("exposes typed runtime contracts", () => {
    expectTypeOf<InstalledApp>().toMatchTypeOf<{
      id: string;
      name: string;
      status: "running" | "stopped" | "unknown";
      updatedAt: string;
    }>();

    expectTypeOf<StoreAppSummary>().toMatchTypeOf<{
      id: string;
      platform: string;
      status:
        | "installed"
        | "not_installed"
        | "installing"
        | "error"
        | "updating"
        | "uninstalling";
      webUiPort: number | null;
      updateAvailable: boolean;
      localDigest: string | null;
      remoteDigest: string | null;
    }>();

    expectTypeOf<StoreAppDetail>().toMatchTypeOf<{
      env: Array<{
        name: string;
      }>;
      installedConfig: InstalledStackConfig | null;
    }>();

    expectTypeOf<DockerPullProgressDetail>().toMatchTypeOf<{
      current: number;
      total: number;
      percent: number | null;
    }>();

    expectTypeOf<StoreOperation>().toMatchTypeOf<{
      id: string;
      action: "install" | "redeploy" | "uninstall";
      status: "queued" | "running" | "success" | "error";
      progressPercent: number;
    }>();

    expectTypeOf<StoreOperationEvent>().toMatchTypeOf<{
      type:
        | "operation.started"
        | "operation.step"
        | "operation.pull.progress"
        | "operation.completed"
        | "operation.failed";
      operationId: string;
      step: string;
    }>();

    expectTypeOf<SystemMetricsSnapshot>().toMatchTypeOf<{
      timestamp: string;
      hostname: string;
      platform: string;
      uptimeSeconds: number;
      temperature: {
        mainCelsius: number | null;
      };
      battery: {
        hasBattery: boolean;
      };
      wifi: {
        connected: boolean;
      };
    }>();

    expectTypeOf<WeatherSnapshot>().toMatchTypeOf<{
      source: "navigator";
      location: {
        label: string;
      };
      current: {
        condition: string;
      };
    }>();

    expectTypeOf<NetworkStatus>().toMatchTypeOf<{
      connected: boolean;
      iface: string | null;
      ssid: string | null;
      ipv4: string | null;
      signalPercent: number | null;
    }>();

    expectTypeOf<WifiAccessPoint>().toMatchTypeOf<{
      ssid: string;
      bssid: string | null;
      security: string | null;
    }>();

    expectTypeOf<ConnectNetworkRequest>().toMatchTypeOf<{
      ssid: string;
      password?: string;
    }>();

    expectTypeOf<NetworkEvent>().toMatchTypeOf<{
      type: "network.connection.changed" | "network.device.state.changed";
      connected: boolean;
      timestamp: string;
    }>();

    expectTypeOf<TerminalExecuteRequest>().toMatchTypeOf<{
      command: string;
      cwd?: string;
      history?: string[];
    }>();

    expectTypeOf<TerminalExecuteResult>().toMatchTypeOf<{
      cwd: string;
      lines: Array<{
        type: "output" | "error" | "info";
        content: string;
      }>;
      exitCode: number | null;
    }>();

    expectTypeOf<FileListEntry>().toMatchTypeOf<{
      path: string;
      type: "folder" | "file";
      sizeBytes: number | null;
    }>();

    expectTypeOf<FileReadResponse>().toMatchTypeOf<{
      mode: "text" | "image" | "pdf" | "binary_unsupported" | "too_large";
      content: string | null;
      mimeType: string | null;
    }>();

    expectTypeOf<FileWriteRequest>().toMatchTypeOf<{
      path: string;
      content: string;
      expectedMtimeMs?: number;
    }>();

    expectTypeOf<FileWriteResponse>().toMatchTypeOf<{
      sizeBytes: number;
      modifiedAt: string;
      mtimeMs: number;
    }>();

    expectTypeOf<FileServiceErrorCode>().toMatchTypeOf<
      | "invalid_path"
      | "path_outside_root"
      | "not_found"
      | "not_a_file"
      | "not_a_directory"
      | "hidden_blocked"
      | "symlink_blocked"
      | "unsupported_file"
      | "payload_too_large"
      | "write_conflict"
      | "internal_error"
    >();
  });
});
