/* @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { StoreAppDetail } from "@/lib/shared/contracts/apps";

const useStoreAppMock = vi.fn();
const useAppComposeMock = vi.fn();
const useStoreActionsMock = vi.fn();

vi.mock("@/hooks/useStoreApp", () => ({
  useStoreApp: (...args: unknown[]) => useStoreAppMock(...args),
}));

vi.mock("@/hooks/useAppCompose", () => ({
  useAppCompose: (...args: unknown[]) => useAppComposeMock(...args),
}));

vi.mock("@/hooks/useStoreActions", () => ({
  useStoreActions: (...args: unknown[]) => useStoreActionsMock(...args),
}));

import { AppConfiguratorPanel } from "@/components/desktop/apps/app-configurator-panel";

const template: StoreAppDetail = {
  id: "home-assistant",
  name: "Home Assistant",
  description: "Home automation",
  platform: "linux",
  categories: ["Automation"],
  logoUrl: "https://example.com/ha.png",
  repositoryUrl: "https://github.com/home-assistant/core",
  stackFile: "compose.yml",
  status: "not_installed",
  webUiPort: 8123,
  updateAvailable: false,
  localDigest: null,
  remoteDigest: null,
  note: "Install note",
  env: [],
  installedConfig: null,
};

function setupActions() {
  const saveAppSettings = vi.fn().mockResolvedValue(undefined);
  const installApp = vi.fn().mockResolvedValue(undefined);
  const installCustomApp = vi.fn().mockResolvedValue(undefined);

  useStoreActionsMock.mockReturnValue({
    saveAppSettings,
    installApp,
    installCustomApp,
  });

  return { saveAppSettings, installApp, installCustomApp };
}

describe("AppConfiguratorPanel", () => {
  beforeEach(() => {
    useStoreAppMock.mockReset();
    useAppComposeMock.mockReset();
    useStoreActionsMock.mockReset();

    useStoreAppMock.mockReturnValue({
      data: null,
      isLoading: false,
    });
    useAppComposeMock.mockReturnValue({
      data: {
        compose:
          "services:\n  app:\n    image: ghcr.io/example/app:latest\n    ports:\n      - \"8123:8123\"\n",
        primary: {
          image: "ghcr.io/example/app:latest",
          ports: ["8123:8123"],
        },
        primaryServiceName: "app",
      },
      isLoading: false,
      isError: false,
      error: null,
    });
  });

  it("selects compose source by context", () => {
    setupActions();

    const installedTarget = {
      appName: "Home Assistant",
      dashboardUrl: "http://homeio.local:8123",
      containerName: "home-assistant",
    };

    const { rerender } = render(
      <AppConfiguratorPanel context="catalog_install" template={template} />,
    );
    expect(useAppComposeMock).toHaveBeenCalledWith(
      "home-assistant",
      true,
      "catalog",
    );

    rerender(
      <AppConfiguratorPanel context="installed_edit" target={installedTarget} />,
    );
    expect(useAppComposeMock).toHaveBeenCalledWith(
      "home-assistant",
      true,
      "installed",
    );
  });

  it("shows docker run tab only for custom install context", () => {
    setupActions();

    const { rerender } = render(
      <AppConfiguratorPanel context="custom_install" />,
    );

    expect(screen.getByRole("button", { name: "Docker Run" })).toBeTruthy();

    rerender(<AppConfiguratorPanel context="catalog_install" template={template} />);

    expect(screen.queryByRole("button", { name: "Docker Run" })).toBeNull();
  });

  it("syncs classic edits into compose view", () => {
    setupActions();

    render(<AppConfiguratorPanel context="catalog_install" template={template} />);

    fireEvent.change(screen.getByLabelText("Docker Image"), {
      target: { value: "nginx:1.27" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Docker Compose" }));

    const composeEditor = screen.getByLabelText("Docker Compose") as HTMLTextAreaElement;
    expect(composeEditor.value).toContain("image: nginx:1.27");
  });

  it("syncs compose edits back into classic fields", () => {
    setupActions();

    render(<AppConfiguratorPanel context="catalog_install" template={template} />);

    fireEvent.click(screen.getByRole("button", { name: "Docker Compose" }));

    const composeEditor = screen.getByLabelText("Docker Compose");
    fireEvent.change(composeEditor, {
      target: {
        value: `services:\n  app:\n    image: redis:7\n    ports:\n      - \"6380:6379\"\n`,
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "Classic" }));

    expect((screen.getByLabelText("Docker Image") as HTMLInputElement).value).toBe("redis:7");
  });

  it("submits install in catalog context", async () => {
    const { installApp } = setupActions();

    render(<AppConfiguratorPanel context="catalog_install" template={template} />);

    fireEvent.click(screen.getByRole("button", { name: "Install" }));

    await waitFor(() => {
      expect(installApp).toHaveBeenCalledTimes(1);
    });
    expect(installApp).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: "home-assistant",
        composeSource: expect.stringContaining("services:"),
      }),
    );
  });

  it("submits docker run install for custom context when docker run tab is active", async () => {
    const { installCustomApp } = setupActions();

    render(<AppConfiguratorPanel context="custom_install" />);

    fireEvent.change(screen.getByLabelText("App Name"), {
      target: { value: "My Run App" },
    });
    fireEvent.change(screen.getByLabelText("Docker Run"), {
      target: { value: "docker run --name my-run-app nginx:latest" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Install" }));

    await waitFor(() => {
      expect(installCustomApp).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceType: "docker-run",
          name: "My Run App",
        }),
      );
    });
  });
});
