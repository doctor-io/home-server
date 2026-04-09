"use client";

import type { FileEntry } from "@/modules/files/components/file-manager-presenters";
import { FILES_MENU_SHELL } from "@/modules/files/components/file-manager-surface";
import {
  ArrowUp,
  ClipboardPaste,
  Copy,
  Download,
  FileText,
  FolderOpen,
  Info,
  Link2,
  Scissors,
  Star,
  Trash2,
  Users,
} from "@/components/icons/platform-icons";
import type { ReactNode } from "react";

export function FileManagerContextMenu({
  contextShareActive,
  entry,
  isTrashView,
  onClose,
  onCopy,
  onCopyPath,
  onCut,
  onDeletePermanently,
  onDownload,
  onGetInfo,
  onMoveToTrash,
  onOpen,
  onPaste,
  onRename,
  onRestore,
  onToggleShare,
  onToggleStar,
  pasteDisabled,
  x,
  y,
}: {
  contextShareActive: boolean;
  entry: FileEntry;
  isTrashView: boolean;
  pasteDisabled: boolean;
  x: number;
  y: number;
  onClose: () => void;
  onCopy: () => void;
  onCopyPath: () => void;
  onCut: () => void;
  onDeletePermanently: () => void;
  onDownload: () => void;
  onGetInfo: () => void;
  onMoveToTrash: () => void;
  onOpen: () => void;
  onPaste: () => void;
  onRename: () => void;
  onRestore: () => void;
  onToggleShare: () => void;
  onToggleStar: () => void;
}) {
  return (
    <div
      className={`absolute z-[200] min-w-44 py-1.5 ${FILES_MENU_SHELL}`}
      style={{ left: x, top: y }}
      onClick={(event) => event.stopPropagation()}
    >
      <ContextMenuItem
        icon={<FolderOpen className="size-3.5" />}
        label="Open"
        onClick={() => {
          onOpen();
          onClose();
        }}
      />
      <ContextMenuItem
        icon={<Info className="size-3.5" />}
        label="Get Info"
        onClick={() => {
          onGetInfo();
          onClose();
        }}
      />
      <ContextMenuItem
        icon={<Link2 className="size-3.5" />}
        label="Copy Path"
        onClick={() => {
          onCopyPath();
          onClose();
        }}
      />
      {!isTrashView ? (
        <ContextMenuItem
          icon={<FileText className="size-3.5" />}
          label="Rename"
          onClick={() => {
            onRename();
            onClose();
          }}
        />
      ) : null}

      <div className="mx-2 my-1 h-px bg-border" />

      <ContextMenuItem
        icon={<Copy className="size-3.5" />}
        label="Copy"
        onClick={() => {
          onCopy();
          onClose();
        }}
      />
      <ContextMenuItem
        icon={<Scissors className="size-3.5" />}
        label="Cut"
        onClick={() => {
          onCut();
          onClose();
        }}
      />
      <ContextMenuItem
        icon={<ClipboardPaste className="size-3.5" />}
        label="Paste"
        disabled={pasteDisabled}
        onClick={() => {
          onPaste();
          onClose();
        }}
      />

      <div className="mx-2 my-1 h-px bg-border" />

      <ContextMenuItem
        icon={<Star className="size-3.5 text-amber-400" />}
        label="Toggle Star"
        onClick={() => {
          onToggleStar();
          onClose();
        }}
      />
      <ContextMenuItem
        icon={<Download className="size-3.5" />}
        label={entry.type === "folder" ? "Download as Zip" : "Download"}
        onClick={() => {
          onDownload();
          onClose();
        }}
      />

      {entry.type === "folder" && !isTrashView ? (
        <>
          <ContextMenuItem
            icon={<Users className="size-3.5 text-sky-400" />}
            label={contextShareActive ? "Unshare Folder" : "Share Folder"}
            onClick={() => {
              onToggleShare();
              onClose();
            }}
          />
          <div className="mx-2 my-1 h-px bg-border" />
        </>
      ) : null}

      {isTrashView ? (
        <>
          <ContextMenuItem
            icon={<ArrowUp className="size-3.5" />}
            label="Restore"
            onClick={() => {
              onRestore();
              onClose();
            }}
          />
          <ContextMenuItem
            icon={<Trash2 className="size-3.5 text-status-red" />}
            label="Delete Permanently"
            danger
            onClick={() => {
              onDeletePermanently();
              onClose();
            }}
          />
        </>
      ) : (
        <ContextMenuItem
          icon={<Trash2 className="size-3.5 text-status-red" />}
          label="Move to Trash"
          danger
          onClick={() => {
            onMoveToTrash();
            onClose();
          }}
        />
      )}
    </div>
  );
}

export function FileManagerBackgroundContextMenu({
  pasteDisabled,
  x,
  y,
  onClose,
  onNewFolder,
  onNewFile,
  onPaste,
}: {
  pasteDisabled: boolean;
  x: number;
  y: number;
  onClose: () => void;
  onNewFolder: () => void;
  onNewFile: () => void;
  onPaste: () => void;
}) {
  return (
    <div
      className={`absolute z-[200] min-w-44 py-1.5 ${FILES_MENU_SHELL}`}
      style={{ left: x, top: y }}
      onClick={(event) => event.stopPropagation()}
    >
      <ContextMenuItem
        icon={<ClipboardPaste className="size-3.5" />}
        label="Paste"
        disabled={pasteDisabled}
        onClick={() => {
          onPaste();
          onClose();
        }}
      />
      <div className="mx-2 my-1 h-px bg-border" />
      <ContextMenuItem
        icon={<FolderOpen className="size-3.5" />}
        label="New Folder"
        onClick={() => {
          onNewFolder();
          onClose();
        }}
      />
      <ContextMenuItem
        icon={<FileText className="size-3.5" />}
        label="New File"
        onClick={() => {
          onNewFile();
          onClose();
        }}
      />
    </div>
  );
}

function ContextMenuItem({
  danger,
  disabled,
  icon,
  label,
  onClick,
}: {
  danger?: boolean;
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-xs transition-colors cursor-pointer ${
        disabled
          ? "cursor-not-allowed text-muted-foreground/50"
          : danger
            ? "text-status-red hover:bg-status-red/10"
            : "text-foreground hover:bg-secondary/50"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
