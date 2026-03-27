import {
  NOT_AVAILABLE_REASON,
  SAVE_DISABLED_REASON,
} from "@/modules/settings/hooks/backend/constants";
import { controlDisabled } from "@/modules/settings/hooks/backend/formatters";

export function createSettingsCapabilities() {
  return {
    general: {
      hostname: {
        disabled: false,
        disabledReason: undefined,
      },
      timezone: {
        disabled: false,
        disabledReason: undefined,
      },
      language: {
        disabled: false,
        disabledReason: undefined,
      },
    },
    network: {
      gateway: controlDisabled(NOT_AVAILABLE_REASON),
      dnsPrimary: controlDisabled(NOT_AVAILABLE_REASON),
      dnsSecondary: controlDisabled(NOT_AVAILABLE_REASON),
      domain: controlDisabled(NOT_AVAILABLE_REASON),
      dhcp: controlDisabled(NOT_AVAILABLE_REASON),
      ipv6: controlDisabled(NOT_AVAILABLE_REASON),
      wol: controlDisabled(NOT_AVAILABLE_REASON),
      mtu: controlDisabled(NOT_AVAILABLE_REASON),
      addRule: controlDisabled(NOT_AVAILABLE_REASON),
    },
    docker: {
      lifecycle: controlDisabled(NOT_AVAILABLE_REASON),
      autoRestart: controlDisabled(NOT_AVAILABLE_REASON),
      logRotation: controlDisabled(NOT_AVAILABLE_REASON),
      defaultNetwork: controlDisabled(NOT_AVAILABLE_REASON),
      pruneImages: {
        disabled: false,
        disabledReason: undefined,
      },
      pruneVolumes: {
        disabled: false,
        disabledReason: undefined,
      },
    },
    security: {
      firewall: {
        disabled: false,
        disabledReason: undefined,
      },
      fail2ban: {
        disabled: false,
        disabledReason: undefined,
      },
    },
    backup: {
      schedule: {
        disabled: false,
        disabledReason: undefined,
      },
      runNow: {
        disabled: false,
        disabledReason: undefined,
      },
      restore: {
        disabled: false,
        disabledReason: undefined,
      },
    },
    updates: {
      updateHomeio: {
        disabled: false,
        disabledReason: undefined,
      },
      autoCheck: {
        disabled: false,
        disabledReason: undefined,
      },
      checkForUpdates: {
        disabled: false,
        disabledReason: undefined,
      },
    },
    unsupportedSectionReason: NOT_AVAILABLE_REASON,
    saveBySection: {
      general: true,
      network: false,
      storage: false,
      docker: false,
      users: false,
      security: true,
      notifications: true,
      backup: true,
      updates: false,
      power: false,
    },
    saveDisabledReason: SAVE_DISABLED_REASON,
  };
}
