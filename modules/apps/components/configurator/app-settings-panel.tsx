"use client";

import type { AppActionTarget } from "@/modules/apps/components/app-grid";
import {
  AppConfiguratorPanel,
  type AppConfiguratorContext,
} from "@/modules/apps/components/configurator/app-configurator-panel";
import type { StoreAppDetail } from "@/lib/shared/contracts/apps";

type AppSettingsPanelProps = {
  target?: AppActionTarget;
  template?: StoreAppDetail;
  customDefaults?: {
    name?: string;
    iconUrl?: string;
  };
  onClose?: () => void;
};

function resolveContext({
  target,
  template,
}: Pick<AppSettingsPanelProps, "target" | "template">): AppConfiguratorContext {
  if (target) return "installed_edit";
  if (template) return "catalog_install";
  return "custom_install";
}

export function AppSettingsPanel(props: AppSettingsPanelProps) {
  return (
    <AppConfiguratorPanel
      context={resolveContext(props)}
      target={props.target}
      template={props.template}
      customDefaults={props.customDefaults}
      onClose={props.onClose}
    />
  );
}
