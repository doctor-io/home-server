/* @vitest-environment jsdom */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useStoreAppMock = vi.fn();
const saveAppSettingsMock = vi.fn();

vi.mock("@/hooks/useStoreApp", () => ({
  useStoreApp: (...args: unknown[]) => useStoreAppMock(...args),
}));

vi.mock("@/hooks/useStoreActions", () => ({
  useStoreActions: () => ({
    saveAppSettings: saveAppSettingsMock,
  }),
}));

import { AppSettingsPanel } from "@/components/desktop/apps/app-settings-panel";

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

describe("AppSettingsPanel", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    useStoreAppMock.mockReset();
    saveAppSettingsMock.mockReset();
    useStoreAppMock.mockReturnValue({
      data: null,
      isLoading: false,
    });
  });

  it("prefills settings from installed config when available (edit mode)", () => {
    useStoreAppMock.mockReturnValue({
      data: {
        id: "2fauth",
        name: "2FAuth",
        installedConfig: {
          appId: "2fauth",
          stackName: "2fauth",
          displayName: null,
          iconUrl: null,
          env: {
            PRIVILEGED: "true",
            MEMORY_LIMIT: "75",
            CPU_SHARES: "medium",
            RESTART_POLICY: "unless-stopped",
            CAP_ADD: "NET_ADMIN",
          },
        },
      },
      isLoading: false,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AppSettingsPanel
          target={{
            appName: "2FAuth",
            containerName: "big-bear-2fauth",
            dashboardUrl: "http://localhost:8000",
          }}
        />
      </QueryClientProvider>,
    );

    expect(useStoreAppMock).toHaveBeenCalledWith("2fauth");
    expect((screen.getByLabelText("Container Hostname") as HTMLInputElement).value).toBe("2fauth");
    expect((screen.getByLabelText("CPU Shares") as HTMLSelectElement).value).toBe("Medium");
    expect((screen.getByLabelText("Restart Policy") as HTMLSelectElement).value).toBe(
      "unless-stopped",
    );
    expect((screen.getByLabelText("Memory Limit") as HTMLInputElement).value).toBe("75");
    expect((screen.getByLabelText("Container Capabilities (cap-add)") as HTMLInputElement).value).toBe(
      "NET_ADMIN",
    );
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText("Save")).toBeTruthy();
  });

  it("uses template defaults for install mode", () => {
    const template = {
      id: "home-assistant",
      name: "Home Assistant",
      description: "Open source home automation",
      platform: "linux",
      categories: ["Automation"],
      logoUrl: "https://example.com/ha.png",
      repositoryUrl: "https://github.com/home-assistant/core",
      stackFile: "docker-compose.yml",
      status: "not_installed" as const,
      webUiPort: 8123,
      updateAvailable: false,
      localDigest: null,
      remoteDigest: null,
      note: "Home automation platform",
      env: [],
      installedConfig: null,
    };

    render(
      <QueryClientProvider client={queryClient}>
        <AppSettingsPanel template={template} />
      </QueryClientProvider>,
    );

    expect(useStoreAppMock).toHaveBeenCalledWith("home-assistant");
    expect(screen.getByText("Install")).toBeTruthy();
    expect(screen.getByText("Install Home Assistant")).toBeTruthy();
  });
});
