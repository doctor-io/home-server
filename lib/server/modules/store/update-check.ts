import "server-only";

/** Compare two image tags as dot-separated numeric segments. Returns >0 if a > b. */
export function compareImageTags(a: string, b: string): number {
  const pa = a.split(".").map((s) => parseInt(s, 10) || 0);
  const pb = b.split(".").map((s) => parseInt(s, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** Extract the tag from an image reference (e.g. "nginx:1.25.3" → "1.25.3"). */
export function extractImageTag(image: string | null | undefined): string | null {
  if (!image) return null;
  const lastSlash = image.lastIndexOf("/");
  const lastColon = image.lastIndexOf(":");
  if (lastColon > lastSlash) return image.slice(lastColon + 1) || null;
  return null;
}

/**
 * Returns true when the catalog template has a strictly newer tag than
 * what is currently written in the installed compose file.
 */
export function isTagUpdateAvailable(
  installedImage: string | null | undefined,
  catalogImage: string | null | undefined,
): boolean {
  const installedTag = extractImageTag(installedImage);
  const catalogTag = extractImageTag(catalogImage);
  if (!installedTag || !catalogTag) return false;
  return compareImageTags(catalogTag, installedTag) > 0;
}
