"use client";

import { Download, Minimize2, RotateCw, ZoomIn, ZoomOut } from "@/components/icons/platform-icons";
import { getFileIcon, type FileEntry } from "@/modules/files/components/file-manager-presenters";
import type { FileReadResponse } from "@/lib/shared/contracts/files";
import React, { useCallback, useEffect, useState } from "react";

type OpenFileFullscreenProps = {
  openFile: { entry: FileEntry };
  openFileAssetUrl: string;
  openFileBadgeLabel: string;
  openFileViewer: FileReadResponse | null;
  onCollapse: () => void;
};

const ZOOM_STEP = 0.25;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 4;

export function OpenFileFullscreen({
  openFile,
  openFileAssetUrl,
  openFileBadgeLabel,
  openFileViewer,
  onCollapse,
}: OpenFileFullscreenProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCollapse();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCollapse]);

  const handleBackdropClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onCollapse();
  }, [onCollapse]);

  if (openFileViewer?.mode !== "image") return null;

  return (
    <div className="fixed inset-0 z-[210] flex flex-col bg-black/92 backdrop-blur-md" onClick={handleBackdropClick}>
      <div className="flex shrink-0 items-center gap-2 border-b border-white/10 bg-black/60 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          {getFileIcon(openFile.entry)}
          <span className="truncate text-sm font-medium text-white/90">{openFile.entry.name}</span>
          <span className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-xs uppercase tracking-wider text-white/50">
            {openFileBadgeLabel}
          </span>
        </div>
        <div className="flex-1" />
        <button
          onClick={() => setZoom((z) => Math.max(z - ZOOM_STEP, ZOOM_MIN))}
          className="rounded p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Zoom out"
        >
          <ZoomOut className="size-4" />
        </button>
        <button
          onClick={() => setZoom(1)}
          className="rounded px-2 py-1 text-xs font-mono text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          onClick={() => setZoom((z) => Math.min(z + ZOOM_STEP, ZOOM_MAX))}
          className="rounded p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Zoom in"
        >
          <ZoomIn className="size-4" />
        </button>
        <button
          onClick={() => setRotation((r) => (r + 90) % 360)}
          className="rounded p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Rotate 90 degrees"
        >
          <RotateCw className="size-4" />
        </button>
        <a
          href={openFileAssetUrl}
          download={openFile.entry.name}
          className="rounded p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Download"
        >
          <Download className="size-4" />
        </a>
        <button
          onClick={onCollapse}
          className="rounded p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Exit full screen"
        >
          <Minimize2 className="size-4" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-6" onClick={handleBackdropClick}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={openFileAssetUrl}
          alt={openFile.entry.name}
          style={{
            transform: `scale(${zoom}) rotate(${rotation}deg)`,
            transition: "transform 0.2s ease",
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain",
          }}
        />
      </div>
    </div>
  );
}
