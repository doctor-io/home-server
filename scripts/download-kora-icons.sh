#!/usr/bin/env bash
# Downloads only the Kora icons referenced in components/icons/icon-assets.ts.
# Downloads the repo tarball so symlinked icons can be dereferenced correctly.
set -euo pipefail

DEST="$(cd "$(dirname "$0")/.." && pwd)/public/kora"
TARBALL_URL="https://github.com/bikass/kora/archive/refs/heads/master.tar.gz"
TMPDIR="$(mktemp -d)"

cleanup() {
  rm -rf "$TMPDIR"
}
trap cleanup EXIT

copy_icon() {
  local category="$1" file="$2"
  local src="$TMPDIR/kora-master/kora/$category/scalable/$file"
  local dir="$DEST/$category/scalable"
  local out="$dir/$file"

  if [[ ! -e "$src" ]]; then
    echo "  missing $category/$file" >&2
    return 1
  fi

  mkdir -p "$dir"

  # cp -L resolves Kora theme symlinks so public/ receives real SVG XML,
  # not tiny text files containing only the linked filename.
  cp -L "$src" "$out"

  if ! head -c 16 "$out" | grep -q "<svg"; then
    echo "  invalid $category/$file (not SVG content)" >&2
    return 1
  fi

  echo "  copy  $category/$file"
}

copy_icon_path() {
  local relative_path="$1"
  local src="$TMPDIR/kora-master/kora/$relative_path"
  local out="$DEST/$relative_path"

  if [[ ! -e "$src" ]]; then
    echo "  missing $relative_path" >&2
    return 1
  fi

  mkdir -p "$(dirname "$out")"
  cp -L "$src" "$out"

  if ! head -c 16 "$out" | grep -q "<svg"; then
    echo "  invalid $relative_path (not SVG content)" >&2
    return 1
  fi

  echo "  copy  $relative_path"
}

echo "==> Downloading Kora icon theme"
curl -fsSL "$TARBALL_URL" | tar -xz -C "$TMPDIR"

echo "==> Actions"
copy_icon_path actions/16/homerun.svg

echo "==> Apps"
copy_icon apps google-drive.svg
copy_icon apps org.gnome.Software.svg
copy_icon apps org.gnome.Terminal.svg
copy_icon apps org.gnome.Nautilus.svg
copy_icon apps org.gnome.SystemMonitor.svg
copy_icon apps org.gnome.Settings.svg

echo "==> Places"
copy_icon places folder.svg
copy_icon places folder-applications.svg
copy_icon places folder-download.svg
copy_icon places folder-music.svg
copy_icon places folder-videos.svg
copy_icon places folder-pictures.svg
copy_icon places folder-documents.svg
copy_icon places folder-development.svg
copy_icon places folder-publicshare.svg
copy_icon places folder-remote.svg
copy_icon places folder-remote-smb.svg
copy_icon places folder-saved-search.svg
copy_icon places user-desktop.svg
copy_icon places user-trash.svg

echo "==> Mimetypes"
copy_icon mimetypes image-x-generic.svg
copy_icon mimetypes audio-x-generic.svg
copy_icon mimetypes video-x-generic.svg
copy_icon mimetypes application-x-archive.svg
copy_icon mimetypes application-archive-zip.svg
copy_icon mimetypes text-x-script.svg
copy_icon mimetypes application-javascript.svg
copy_icon mimetypes application-x-typescript.svg
copy_icon mimetypes application-x-tsx.svg
copy_icon mimetypes application-x-jsx.svg
copy_icon mimetypes text-x-python.svg
copy_icon mimetypes application-x-shellscript.svg
copy_icon mimetypes application-json.svg
copy_icon mimetypes application-yaml.svg
copy_icon mimetypes application-toml.svg
copy_icon mimetypes text-css.svg
copy_icon mimetypes text-html.svg
copy_icon mimetypes application-xml.svg
copy_icon mimetypes text-markdown.svg
copy_icon mimetypes application-sql.svg
copy_icon mimetypes application-database.svg
copy_icon mimetypes application-pdf.svg
copy_icon mimetypes x-office-document.svg
copy_icon mimetypes text-x-generic.svg

echo "==> Devices"
copy_icon devices drive-harddisk.svg
copy_icon devices drive-removable-media-usb.svg
copy_icon devices network-server.svg

echo "==> Platform UI icons"
while IFS= read -r icon_path; do
  [[ -z "$icon_path" ]] && continue
  copy_icon_path "$icon_path"
done <<'PLATFORM_ICONS'
actions/16/application-rss+xml.svg
actions/16/archive.svg
actions/16/bell.svg
actions/16/checkbox.svg
actions/16/checked-completed.svg
actions/16/chronometer.svg
actions/16/clock.svg
actions/16/code-block.svg
actions/16/configure-toolbars.svg
actions/16/configure.svg
actions/16/dialog-close.svg
actions/16/dialog-information.svg
actions/16/dialog-messages.svg
actions/16/dialog-ok-apply.svg
actions/16/dialog-ok.svg
actions/16/dialog-password.svg
actions/16/document-new.svg
actions/16/document-properties.svg
actions/16/document-save.svg
actions/16/download.svg
actions/16/draw-brush.svg
actions/16/draw-circle.svg
actions/16/draw-rectangle.svg
actions/16/edit-copy.svg
actions/16/edit-cut.svg
actions/16/edit-delete.svg
actions/16/edit-paste.svg
actions/16/edit-redo.svg
actions/16/edit-undo.svg
actions/16/favorite.svg
actions/16/go-down.svg
actions/16/go-next.svg
actions/16/go-previous.svg
actions/16/go-up.svg
actions/16/help-contents.svg
actions/16/homerun.svg
actions/16/insert-image.svg
actions/16/insert-link.svg
actions/16/list-add.svg
actions/16/list-remove.svg
actions/16/lock.svg
actions/16/mail-message-new.svg
actions/16/media-eject.svg
actions/16/media-playback-pause.svg
actions/16/media-playback-start.svg
actions/16/network-disconnect.svg
actions/16/package.svg
actions/16/star-on.svg
actions/16/system-log-out.svg
actions/16/system-search.svg
actions/16/system-shutdown.svg
actions/16/system-software-install.svg
actions/16/system-upgrade.svg
actions/16/system-users.svg
actions/16/tools.svg
actions/16/upload.svg
actions/16/user.svg
actions/16/view-calendar-time-spent.svg
actions/16/view-certificate.svg
actions/16/view-grid.svg
actions/16/view-hidden.svg
actions/16/view-left-close.svg
actions/16/view-list-details.svg
actions/16/view-list-text.svg
actions/16/view-list-video.svg
actions/16/view-list.svg
actions/16/view-media-track.svg
actions/16/view-more-horizontal.svg
actions/16/view-refresh.svg
actions/16/view-sort-ascending.svg
actions/16/view-sort-descending.svg
actions/16/view-statistics.svg
actions/16/view-visible.svg
actions/16/web-browser.svg
actions/16/window-maximize.svg
actions/16/window-minimize.svg
actions/16/window-new.svg
actions/16/zoom-in.svg
actions/16/zoom-out.svg
apps/scalable/docker-desktop.svg
apps/scalable/org.gnome.Terminal.svg
devices/scalable/camera-photo.svg
devices/scalable/cpu.svg
devices/scalable/drive-harddisk.svg
devices/scalable/drive-removable-media-usb.svg
devices/scalable/input-gaming.svg
devices/scalable/memory.svg
devices/scalable/network-server.svg
devices/scalable/network-vpn.svg
devices/scalable/network-wired.svg
devices/scalable/network-wireless.svg
devices/scalable/server-database.svg
devices/scalable/video-display.svg
mimetypes/scalable/text-x-generic.svg
mimetypes/scalable/video-x-generic.svg
places/scalable/folder-cloud.svg
places/scalable/folder-open.svg
places/scalable/folder.svg
status/scalable/ac-adapter.svg
status/scalable/battery-ac-adapter.svg
status/scalable/battery-full-charging.svg
status/scalable/battery-full.svg
status/scalable/dialog-information.svg
status/scalable/dialog-warning.svg
status/scalable/notification-network-wireless-disconnected.svg
status/scalable/notification-network-wireless-symbolic.svg
status/scalable/notification-network-wireless.svg
status/scalable/weather-clear-wind.svg
status/scalable/weather-clear.svg
status/scalable/weather-few-clouds.svg
status/scalable/weather-fog.svg
status/scalable/weather-showers-scattered.svg
status/scalable/weather-showers.svg
status/scalable/weather-snow.svg
status/scalable/weather-storm.svg
PLATFORM_ICONS

echo ""
echo "Done. $(find "$DEST" -name '*.svg' | wc -l | tr -d ' ') icons in public/kora/"
