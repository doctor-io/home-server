"use client";

import { OsIcon } from "./OsIcon";
import { FOLDER_ICONS, MIMETYPE_ICONS } from "./icon-assets";

type IconProps = { className?: string };

// Shared paper body used by every file-type icon.
// The paper is tinted with `c` at low opacity so the color reads at small sizes
// even when the embedded symbol is too tiny to distinguish.
function PaperBase({ c, children }: { c: string; children?: React.ReactNode }) {
  return (
    <>
      {/* Body */}
      <path
        d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8L14 2z"
        fill={c}
        fillOpacity="0.1"
        stroke={c}
        strokeOpacity="0.28"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      {/* Fold corner fill */}
      <path d="M14 2L20 8H14V2Z" fill={c} fillOpacity="0.22" />
      {/* Fold crease */}
      <path
        d="M14 2V8H20"
        stroke={c}
        strokeOpacity="0.38"
        strokeWidth="1"
        fill="none"
        strokeLinejoin="round"
      />
      {children}
    </>
  );
}

// ─── Folder badge system ──────────────────────────────────────────────────────
// Maps lowercase folder names to a badge type. Add entries here to support more.

type BadgeType =
  | "download" | "upload"
  | "music"    | "video"  | "image"
  | "document" | "code"   | "archive"
  | "network"  | "backup" | "share"
  | "desktop"  | "trash"  | "app";

const FOLDER_BADGE_MAP: Record<string, BadgeType> = {
  // Downloads
  download: "download", downloads: "download",
  // Music / Audio
  music: "music", audio: "music", songs: "music",
  // Video / Media
  video: "video", videos: "video", movies: "video",
  movie: "video", media: "video", films: "video", film: "video",
  // Images / Photos
  pictures: "image", picture: "image", photos: "image",
  photo: "image", images: "image", gallery: "image",
  screenshots: "image", screenshot: "image", wallpapers: "image",
  // Documents
  documents: "document", document: "document", docs: "document",
  // Code / Dev
  code: "code", dev: "code", development: "code",
  projects: "code", src: "code", repos: "code", github: "code",
  // Archives
  archive: "archive", archives: "archive",
  // Network / Shared
  shared: "share", network: "network",
  // Backup
  backup: "backup", backups: "backup",
  // Desktop
  desktop: "desktop",
  // Apps / AppData
  apps: "app", appdata: "app",
  // Trash
  trash: "trash", ".trash": "trash",
};

// Badge rendered at bottom-right corner inside the 48×48 folder SVG.
// Circle at (36, 37) r=11 gives ~22 px badge area.
function FolderBadgeOverlay({ type }: { type: BadgeType }) {
  const s = { stroke: "white", strokeWidth: "1.7", strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  return (
    // translate(-12, -10) shifts badge center from (36,37) → (24,27), the visual center of the folder body
    <g transform="translate(-12, -10)">

      {type === "download" && (
        <g {...s}>
          <line x1="36" y1="29.5" x2="36" y2="38" />
          <polyline points="32.5,34.5 36,38 39.5,34.5" />
          <line x1="31" y1="41" x2="41" y2="41" />
        </g>
      )}

      {type === "upload" && (
        <g {...s}>
          <line x1="36" y1="44.5" x2="36" y2="36" />
          <polyline points="32.5,39.5 36,36 39.5,39.5" />
          <line x1="31" y1="32" x2="41" y2="32" />
        </g>
      )}

      {type === "music" && (
        <>
          <circle cx="32.5" cy="40.5" r="2.5" fill="white" />
          <g {...s}>
            <line x1="35" y1="40.5" x2="35" y2="30.5" />
            <polyline points="35,30.5 41,29 41,33" />
          </g>
        </>
      )}

      {type === "video" && (
        <path d="M30.5 30.5 L30.5 43.5 L43 37 Z" fill="white" />
      )}

      {type === "image" && (
        <>
          <circle cx="40" cy="30" r="2.5" fill="white" />
          <polyline points="27,43.5 33,34.5 38.5,40.5 41,37 45,43.5" {...s} />
        </>
      )}

      {type === "document" && (
        <g {...s}>
          <rect x="29" y="28.5" width="14" height="17" rx="1.5" />
          <line x1="32" y1="33" x2="40" y2="33" />
          <line x1="32" y1="36.5" x2="40" y2="36.5" />
          <line x1="32" y1="40" x2="37" y2="40" />
        </g>
      )}

      {type === "code" && (
        <g {...s}>
          <polyline points="32,30 28,37 32,44" />
          <polyline points="40,30 44,37 40,44" />
          <line x1="38.5" y1="29" x2="33.5" y2="45" />
        </g>
      )}

      {type === "archive" && (
        <g {...s}>
          <rect x="28.5" y="34" width="15" height="11" rx="1" />
          <rect x="27.5" y="30.5" width="17" height="3.5" rx="1" />
          <line x1="33.5" y1="38" x2="38.5" y2="38" />
        </g>
      )}

      {type === "network" && (
        <>
          <circle cx="36" cy="30.5" r="2.5" fill="white" />
          <circle cx="28" cy="43" r="2" fill="white" />
          <circle cx="36" cy="43" r="2" fill="white" />
          <circle cx="44" cy="43" r="2" fill="white" />
          <g {...s}>
            <line x1="30" y1="41.5" x2="34" y2="33" />
            <line x1="36" y1="41" x2="36" y2="33" />
            <line x1="42" y1="41.5" x2="38" y2="33" />
          </g>
        </>
      )}

      {type === "backup" && (
        <g {...s}>
          <path d="M27.5 37 a8.5 8.5 0 1 0 2.5-6" />
          <polyline points="27.5,27 27.5,31.5 32,31.5" />
        </g>
      )}

      {type === "share" && (
        <>
          <circle cx="28.5" cy="37" r="2.5" stroke="white" strokeWidth="1.7" fill="none" />
          <circle cx="43" cy="30" r="2.5" stroke="white" strokeWidth="1.7" fill="none" />
          <circle cx="43" cy="44" r="2.5" stroke="white" strokeWidth="1.7" fill="none" />
          <g {...s}>
            <line x1="31" y1="36" x2="40.5" y2="31.5" />
            <line x1="31" y1="38" x2="40.5" y2="42.5" />
          </g>
        </>
      )}

      {type === "desktop" && (
        <g {...s}>
          <rect x="27" y="29" width="18" height="12" rx="1.5" />
          <line x1="33" y1="41" x2="33" y2="44" />
          <line x1="39" y1="41" x2="39" y2="44" />
          <line x1="30.5" y1="44" x2="41.5" y2="44" />
        </g>
      )}

      {type === "trash" && (
        <g {...s}>
          <polyline points="29,32 36,32 43,32" />
          <path d="M32 32 v-2 h8 v2" />
          <rect x="30" y="33" width="12" height="12" rx="1" />
          <line x1="33.5" y1="36" x2="33.5" y2="42" />
          <line x1="36" y1="36" x2="36" y2="42" />
          <line x1="38.5" y1="36" x2="38.5" y2="42" />
        </g>
      )}

      {type === "app" && (
        <g {...s}>
          <rect x="29.5" y="30.5" width="5.5" height="5.5" rx="1" />
          <rect x="37"   y="30.5" width="5.5" height="5.5" rx="1" />
          <rect x="29.5" y="38"   width="5.5" height="5.5" rx="1" />
          <rect x="37"   y="38"   width="5.5" height="5.5" rx="1" />
        </g>
      )}
    </g>
  );
}

function getFolderBadge(name: string): BadgeType | null {
  return FOLDER_BADGE_MAP[name.toLowerCase()] ?? null;
}

// ─── Folder (closed) ─────────────────────────────────────────────────────────

function FolderSvg({ className, name }: IconProps & { name?: string }) {
  const badge = name ? getFolderBadge(name) : null;
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M40,12H22l-4-4H8c-2.2,0-4,1.8-4,4v8h40v-4C44,13.8,42.2,12,40,12z"
        style={{ fill: "color-mix(in srgb, var(--accent) 80%, #000)" }}
      />
      <path
        d="M40,12H8c-2.2,0-4,1.8-4,4v20c0,2.2,1.8,4,4,4h32c2.2,0,4-1.8,4-4V16C44,13.8,42.2,12,40,12z"
        style={{ fill: "color-mix(in srgb, var(--accent) 58%, #fff)" }}
      />
      {badge && <FolderBadgeOverlay type={badge} />}
    </svg>
  );
}

export function FolderIcon({ className, name }: IconProps & { name?: string }) {
  const badge = name ? getFolderBadge(name) : null;
  const osSrc = FOLDER_ICONS[badge ?? "default"] ?? FOLDER_ICONS.default;
  return (
    <OsIcon
      src={osSrc}
      className={className}
      fallback={<FolderSvg className={className} name={name} />}
    />
  );
}

// ─── Folder (open) ────────────────────────────────────────────────────────────

function OpenFolderSvg({ className, name }: IconProps & { name?: string }) {
  const badge = name ? getFolderBadge(name) : null;
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M38,12H22l-4-4H8c-2.2,0-4,1.8-4,4v24c0,2.2,1.8,4,4,4h31c1.7,0,3-1.3,3-3V16C42,13.8,40.2,12,38,12z"
        style={{ fill: "color-mix(in srgb, var(--accent) 80%, #000)" }}
      />
      <path
        d="M42.2,18H15.3c-1.9,0-3.6,1.4-3.9,3.3L8,40h31.7c1.9,0,3.6-1.4,3.9-3.3l2.5-14C46.6,20.3,44.7,18,42.2,18z"
        style={{ fill: "color-mix(in srgb, var(--accent) 58%, #fff)" }}
      />
      {badge && <FolderBadgeOverlay type={badge} />}
    </svg>
  );
}

export function OpenFolderIcon({ className, name }: IconProps & { name?: string }) {
  const badge = name ? getFolderBadge(name) : null;
  const osSrc = FOLDER_ICONS[badge ?? "default"] ?? FOLDER_ICONS.default;
  return (
    <OsIcon
      src={osSrc}
      className={className}
      fallback={<OpenFolderSvg className={className} name={name} />}
    />
  );
}

// ─── Image ────────────────────────────────────────────────────────────────────

export function ImageFileIcon({ className }: IconProps) {
  const c = "#f472b6";
  return (
    <OsIcon
      src={MIMETYPE_ICONS.image}
      className={className}
      fallback={
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <PaperBase c={c}>
            <circle cx="8" cy="11.5" r="2" fill={c} />
            <path d="M5 18L9.5 13L13.5 18H5Z" fill={c} fillOpacity="0.7" />
            <path d="M11 18L15.5 11.5L20 18H11Z" fill={c} />
          </PaperBase>
        </svg>
      }
    />
  );
}

// ─── Audio ────────────────────────────────────────────────────────────────────

export function AudioFileIcon({ className }: IconProps) {
  const c = "#c084fc";
  return (
    <OsIcon
      src={MIMETYPE_ICONS.audio}
      className={className}
      fallback={
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <PaperBase c={c}>
            <circle cx="8" cy="17" r="2" fill={c} />
            <circle cx="14" cy="16.5" r="2" fill={c} />
            <path
              d="M10 17V10M16 16.5V9.5M10 10L16 9.5"
              stroke={c}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </PaperBase>
        </svg>
      }
    />
  );
}

// ─── Video ────────────────────────────────────────────────────────────────────

export function VideoFileIcon({ className }: IconProps) {
  const c = "#fbbf24";
  return (
    <OsIcon
      src={MIMETYPE_ICONS.video}
      className={className}
      fallback={
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <PaperBase c={c}>
            <path d="M9.5 10.5V18.5L17.5 14.5L9.5 10.5Z" fill={c} />
          </PaperBase>
        </svg>
      }
    />
  );
}

// ─── Archive ──────────────────────────────────────────────────────────────────

export function ArchiveFileIcon({ className }: IconProps) {
  const c = "#a78bfa";
  return (
    <OsIcon
      src={MIMETYPE_ICONS.archive}
      className={className}
      fallback={
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <PaperBase c={c}>
            <rect x="5.5" y="10" width="13" height="2.5" rx="0.5" fill={c} fillOpacity="0.9" />
            <rect
              x="5.5" y="13" width="13" height="6.5" rx="0.5"
              fill={c} fillOpacity="0.15"
              stroke={c} strokeOpacity="0.5" strokeWidth="0.75"
            />
            <path
              d="M10 10V12.5M14 10V12.5"
              stroke={c}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </PaperBase>
        </svg>
      }
    />
  );
}

// ─── Code ─────────────────────────────────────────────────────────────────────

export function CodeFileIcon({ className }: IconProps) {
  const c = "#34d399";
  return (
    <OsIcon
      src={MIMETYPE_ICONS.code}
      className={className}
      fallback={
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <PaperBase c={c}>
            <path
              d="M9 11L6.5 14L9 17M15 11L17.5 14L15 17M13.5 10.5L10.5 18"
              stroke={c}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </PaperBase>
        </svg>
      }
    />
  );
}

// ─── Document (PDF / DOC) ─────────────────────────────────────────────────────

export function DocumentFileIcon({ className }: IconProps) {
  const c = "#60a5fa";
  return (
    <OsIcon
      src={MIMETYPE_ICONS.document}
      className={className}
      fallback={
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <PaperBase c={c}>
            <path
              d="M7 10.5H17M7 13.5H17M7 16.5H13"
              stroke={c}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </PaperBase>
        </svg>
      }
    />
  );
}

// ─── Plain text ───────────────────────────────────────────────────────────────

export function TextFileIcon({ className }: IconProps) {
  const c = "#94a3b8";
  return (
    <OsIcon
      src={MIMETYPE_ICONS.text}
      className={className}
      fallback={
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <PaperBase c={c}>
            <path
              d="M7 10.5H17M7 13H17M7 15.5H14.5M7 18H11"
              stroke={c}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </PaperBase>
        </svg>
      }
    />
  );
}

// ─── Generic file ─────────────────────────────────────────────────────────────

export function GenericFileIcon({ className }: IconProps) {
  const c = "#6b7280";
  return (
    <OsIcon
      src={MIMETYPE_ICONS.generic}
      className={className}
      fallback={
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <PaperBase c={c}>
            <path
              d="M7 11H17M7 14H14M7 17H11"
              stroke={c}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </PaperBase>
        </svg>
      }
    />
  );
}

export function KoraFileIcon({ className, iconKey }: IconProps & { iconKey: string }) {
  const src = MIMETYPE_ICONS[iconKey] ?? MIMETYPE_ICONS.generic;
  return (
    <OsIcon
      src={src}
      className={className}
      fallback={<GenericFileIcon className={className} />}
    />
  );
}
