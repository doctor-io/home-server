#!/usr/bin/env bash
# Downloads only the Kora icons referenced in components/icons/icon-assets.ts.
# No git clone needed — fetches 27 SVGs directly from GitHub raw.
set -euo pipefail

BASE="https://raw.githubusercontent.com/bikass/kora/master/kora"
DEST="$(cd "$(dirname "$0")/.." && pwd)/public/kora"

fetch() {
  local category="$1" file="$2"
  local dir="$DEST/$category/scalable"
  local url="$BASE/$category/scalable/$file"
  mkdir -p "$dir"
  if [[ -f "$dir/$file" ]]; then
    echo "  skip  $category/$file"
    return
  fi
  echo "  fetch $category/$file"
  curl -fsSL "$url" -o "$dir/$file"
}

echo "==> Apps"
fetch apps org.gnome.Software.svg
fetch apps org.gnome.Terminal.svg
fetch apps org.gnome.Nautilus.svg
fetch apps org.gnome.SystemMonitor.svg
fetch apps org.gnome.Settings.svg

echo "==> Places"
fetch places folder.svg
fetch places folder-download.svg
fetch places folder-music.svg
fetch places folder-videos.svg
fetch places folder-pictures.svg
fetch places folder-documents.svg
fetch places folder-development.svg
fetch places folder-publicshare.svg
fetch places folder-remote.svg
fetch places folder-saved-search.svg
fetch places user-desktop.svg
fetch places user-trash.svg

echo "==> Mimetypes"
fetch mimetypes image-x-generic.svg
fetch mimetypes audio-x-generic.svg
fetch mimetypes video-x-generic.svg
fetch mimetypes application-x-archive.svg
fetch mimetypes text-x-script.svg
fetch mimetypes x-office-document.svg
fetch mimetypes text-x-generic.svg

echo "==> Devices"
fetch devices drive-harddisk.svg
fetch devices drive-removable-media-usb.svg
fetch devices network-server.svg

echo ""
echo "Done. $(find "$DEST" -name '*.svg' | wc -l | tr -d ' ') icons in public/kora/"
