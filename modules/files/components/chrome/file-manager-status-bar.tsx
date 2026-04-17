"use client";

import { DeleteRegular } from "@fluentui/react-icons";
import { FILES_BADGE_SURFACE } from "@/modules/files/components/file-manager-surface";

type StatusBarProps = {
  clipboardName: string | null;
  clipboardOperation: "copy" | "move" | null;
  currentPathForDisplay: string[];
  fileCount: number;
  folderCount: number;
  isStarredView: boolean;
  isTrashView: boolean;
  rootLabel: string;
  selectedFilesCount: number;
  statusNotice: string | null;
  onTrashSelected: () => void;
};

export function FileManagerStatusBar({
  clipboardName,
  clipboardOperation,
  currentPathForDisplay,
  fileCount,
  folderCount,
  isStarredView,
  isTrashView,
  rootLabel,
  selectedFilesCount,
  statusNotice,
  onTrashSelected,
}: StatusBarProps) {
  return (
    <div className="flex items-center justify-between border-t border-glass-border/80 bg-background/48 px-3 py-1.5 text-xs text-muted-foreground">
      <span className="flex items-center gap-3">
        <span>
          {folderCount > 0 && `${folderCount} folder${folderCount > 1 ? "s" : ""}`}
          {folderCount > 0 && fileCount > 0 ? ", " : ""}
          {fileCount > 0 && `${fileCount} file${fileCount > 1 ? "s" : ""}`}
        </span>
        {selectedFilesCount > 1 ? (
          <span className="flex items-center gap-1.5 text-primary">
            <span>{selectedFilesCount} selected</span>
            {!isTrashView && !isStarredView ? (
              <button
                onClick={onTrashSelected}
                className={`flex items-center gap-1 px-1.5 py-0.5 text-status-red transition-colors hover:bg-status-red/20 cursor-pointer ${FILES_BADGE_SURFACE}`}
                title="Move selected to Trash"
              >
                <DeleteRegular className="size-3" />
                <span>Trash selected</span>
              </button>
            ) : null}
          </span>
        ) : null}
      </span>

      <div className="flex items-center gap-3">
        {statusNotice ? (
          <span className="max-w-72 truncate text-status-amber">{statusNotice}</span>
        ) : null}
        {clipboardName && clipboardOperation ? (
          <span className="max-w-56 truncate text-muted-foreground">
            {clipboardOperation === "copy" ? "Clipboard" : "Cut"}: {clipboardName}
          </span>
        ) : null}
        <span className="font-mono">
          {rootLabel}
          {currentPathForDisplay.length > 0 ? `/${currentPathForDisplay.join("/")}` : ""}
        </span>
      </div>
    </div>
  );
}
