// Maps semantic keys → Kora icon theme paths under /public/kora/.
// SVGs are in the scalable/ subdirectory of each category.

const K_APPS  = "/kora/apps/scalable";
const K_PLACES = "/kora/places/scalable";
const K_MIME  = "/kora/mimetypes/scalable";
const K_DEV   = "/kora/devices/scalable";

export const APP_ICONS: Record<string, string> = {
  apps:        `${K_APPS}/org.gnome.Software.svg`,
  terminal:    `${K_APPS}/org.gnome.Terminal.svg`,
  files:       `${K_APPS}/org.gnome.Nautilus.svg`,
  monitor:     `${K_APPS}/org.gnome.SystemMonitor.svg`,
  "app-store": `${K_APPS}/org.gnome.Software.svg`,
  settings:    `${K_APPS}/org.gnome.Settings.svg`,
};

// badge type (from file-icons.tsx FOLDER_BADGE_MAP) → Kora places icon
export const FOLDER_ICONS: Record<string, string> = {
  default:  `${K_PLACES}/folder.svg`,
  download: `${K_PLACES}/folder-download.svg`,
  upload:   `${K_PLACES}/folder.svg`,
  music:    `${K_PLACES}/folder-music.svg`,
  video:    `${K_PLACES}/folder-videos.svg`,
  image:    `${K_PLACES}/folder-pictures.svg`,
  document: `${K_PLACES}/folder-documents.svg`,
  code:     `${K_PLACES}/folder-development.svg`,
  share:    `${K_PLACES}/folder-publicshare.svg`,
  network:  `${K_PLACES}/folder-remote.svg`,
  backup:   `${K_PLACES}/folder-saved-search.svg`,
  desktop:  `${K_PLACES}/user-desktop.svg`,
  trash:    `${K_PLACES}/user-trash.svg`,
  app:      `${K_PLACES}/folder.svg`,
};

export const MIMETYPE_ICONS: Record<string, string> = {
  image:    `${K_MIME}/image-x-generic.svg`,
  audio:    `${K_MIME}/audio-x-generic.svg`,
  video:    `${K_MIME}/video-x-generic.svg`,
  archive:  `${K_MIME}/application-x-archive.svg`,
  code:     `${K_MIME}/text-x-script.svg`,
  document: `${K_MIME}/x-office-document.svg`,
  text:     `${K_MIME}/text-x-generic.svg`,
  generic:  `${K_MIME}/text-x-generic.svg`,
};

export const DEVICE_ICONS: Record<string, string> = {
  drive:   `${K_DEV}/drive-harddisk.svg`,
  usb:     `${K_DEV}/drive-removable-media-usb.svg`,
  network: `${K_DEV}/network-server.svg`,
};
