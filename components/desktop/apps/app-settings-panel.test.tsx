/* @vitest-environment jsdom */

import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const appConfiguratorPanelMock = vi.fn(() => null);

vi.mock("@/components/desktop/apps/app-configurator-panel", () => ({
  AppConfiguratorPanel: (props: unknown) => appConfiguratorPanelMock(props),
}));

import { AppSettingsPanel } from "@/components/desktop/apps/app-settings-panel";

describe("AppSettingsPanel wrapper", () => {
  it("maps target usage to installed_edit context", () => {
    render(
      <AppSettingsPanel
        target={{
          appName: "Plex",
          containerName: "plex",
          dashboardUrl: "http://localhost:32400",
        }}
      />,
    );

    expect(appConfiguratorPanelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        context: "installed_edit",
      }),
    );
  });

  it("maps template usage to catalog_install context", () => {
    render(
      <AppSettingsPanel
        template={{
          id: "home-assistant",
          name: "Home Assistant",
          description: "Home automation",
          platform: "linux",
          categories: ["Automation"],
          logoUrl: null,
          repositoryUrl: "https://github.com/home-assistant/core",
          stackFile: "compose.yml",
          status: "not_installed",
          webUiPort: 8123,
          updateAvailable: false,
          localDigest: null,
          remoteDigest: null,
          note: "",
          env: [],
          installedConfig: null,
        }}
      />,
    );

    expect(appConfiguratorPanelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        context: "catalog_install",
      }),
    );
  });

  it("defaults to custom_install context when no target/template", () => {
    render(<AppSettingsPanel />);

    expect(appConfiguratorPanelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        context: "custom_install",
      }),
    );
  });
});
