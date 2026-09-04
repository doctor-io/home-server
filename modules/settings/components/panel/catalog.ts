import {
  Bell         as AlertRegular,
  RefreshCw    as ArrowSyncRegular,
  Container    as BoxRegular,
  CalendarClock as CalendarClockRegular,
  Database     as DatabaseRegular,
  HardDrive    as HardDriveRegular,
  Paintbrush   as PaintBrushRegular,
  Plug         as PlugRegular,
  Users        as PeopleRegular,
  Power        as PowerRegular,
  Router       as RouterRegular,
  Server       as ServerRegular,
  Shield       as ShieldRegular,
  Wrench       as WrenchRegular,
} from "@/components/icons/platform-icons";
import type {
  SettingsSection,
  SettingsSectionGroup,
  SettingsSectionId,
} from "@/modules/settings/components/panel/types";

/**
 * The single source of truth for what settings sections exist.
 *
 * Holds metadata only — no section components — so the desktop shell and the
 * command palette can read the catalog without pulling in the whole settings
 * panel. The matching renderers live in `./registry`, keyed by section id.
 */

export const SETTINGS_SECTION_GROUPS: SettingsSectionGroup[] = [
  { id: "system",         label: "System"         },
  { id: "infrastructure", label: "Infrastructure" },
  { id: "integrations",   label: "Integrations"   },
  { id: "automation",     label: "Automation"     },
  { id: "access",         label: "Access"         },
  { id: "danger",         label: "Danger Zone"    },
];

export const SETTINGS_SECTIONS: SettingsSection[] = [
  { id: "general",         label: "General",          icon: ServerRegular,        group: "system"         },
  { id: "appearance",      label: "Appearance",       icon: PaintBrushRegular,    group: "system"         },
  { id: "updates",         label: "Updates",          icon: ArrowSyncRegular,     group: "system"         },
  { id: "network",         label: "Network",          icon: RouterRegular,        group: "infrastructure" },
  { id: "storage",         label: "Storage",          icon: HardDriveRegular,     group: "infrastructure" },
  { id: "docker",          label: "Docker",           icon: BoxRegular,           group: "infrastructure" },
  { id: "integrations",    label: "Integrations",     icon: PlugRegular,          group: "integrations"   },
  { id: "scheduled-tasks", label: "Scheduled Tasks",  icon: CalendarClockRegular, group: "automation"     },
  { id: "backup",          label: "Backup & Restore", icon: DatabaseRegular,      group: "automation"     },
  { id: "users",           label: "Users & Access",   icon: PeopleRegular,        group: "access"         },
  { id: "security",        label: "Security",         icon: ShieldRegular,        group: "access"         },
  { id: "notifications",   label: "Notifications",    icon: AlertRegular,         group: "access"         },
  { id: "power",           label: "Power",            icon: PowerRegular,         group: "danger"         },
  { id: "advanced",        label: "Advanced",         icon: WrenchRegular,        group: "danger"         },
];

/** Stable identity, so consumers can pass it to hook dependency arrays. */
export const SETTINGS_SECTION_IDS: SettingsSectionId[] = SETTINGS_SECTIONS.map(
  (section) => section.id,
);
