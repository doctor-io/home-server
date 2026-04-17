"use client";

import { FileManagerBackgroundContextMenu, FileManagerContextMenu } from "@/modules/files/components/menus/file-manager-overlays";
import {
  CreateEntryDialog,
  EmptyTrashConfirmDialog,
  FileInfoDialogOverlay,
  PasteConflictDialog,
  RenameEntryDialog,
} from "@/modules/files/components/dialogs/file-manager-dialogs";
import { NetworkStorageDialog } from "@/modules/files/components/dialogs/network-storage-dialog";
import type { FileInfoResponse } from "@/lib/shared/contracts/files";
import type { FileEntry } from "@/modules/files/components/file-manager-presenters";
import type {
  ClipboardState,
  CreateEntryDialogState,
  PasteConflictState,
  RenameDialogState,
} from "@/modules/files/components/manager/file-manager-state";

type FileManagerDialogLayerProps = {
  clipboardState: ClipboardState | null;
  contextShare:
    | {
        id: string;
      }
    | undefined;
  createEntryDialog: CreateEntryDialogState | null;
  fileInfoDialog: FileInfoResponse | null;
  isTrashView: boolean;
  pasteConflict: PasteConflictState | null;
  pastePending: boolean;
  renameDialog: RenameDialogState | null;
  showBackgroundContextMenu: { x: number; y: number } | null;
  showContextMenu: { x: number; y: number; entry: FileEntry } | null;
  showEmptyTrashConfirm: boolean;
  showNetworkDialog: boolean;
  trashItemCount: number;
  createPending: boolean;
  renamePending: boolean;
  onCloseContextMenu: () => void;
  onCloseBackgroundContextMenu: () => void;
  onOpenCreateEntryDialog: (kind: "file" | "folder") => void;
  onCloseCreateEntryDialog: () => void;
  onChangeCreateEntryDialog: (value: string) => void;
  onSubmitCreateEntryDialog: () => void;
  onCloseRenameDialog: () => void;
  onChangeRenameDialog: (value: string) => void;
  onSubmitRenameDialog: () => void;
  onCancelEmptyTrash: () => void;
  onConfirmEmptyTrash: () => void;
  onCloseFileInfoDialog: () => void;
  onConflictResolution: (choice: "replace" | "keep-both" | "skip" | "skip-all") => void;
  onCloseNetworkDialog: () => void;
  onNavigateToNetwork: () => void;
  onCopyContextEntry: () => void;
  onCopyContextPath: () => void;
  onCutContextEntry: () => void;
  onDeleteContextEntry: () => void;
  onDownloadContextEntry: () => void;
  onGetInfoContextEntry: () => void;
  onMoveContextEntryToTrash: () => void;
  onOpenContextEntry: () => void;
  onPasteIntoContextEntry: () => void;
  onPasteIntoBackground: () => void;
  onRenameContextEntry: () => void;
  onRestoreContextEntry: () => void;
  onToggleContextShare: () => void;
  onToggleContextStar: () => void;
};

export function FileManagerDialogLayer({
  clipboardState,
  contextShare,
  createEntryDialog,
  createPending,
  fileInfoDialog,
  isTrashView,
  onCancelEmptyTrash,
  onChangeCreateEntryDialog,
  onChangeRenameDialog,
  onCloseBackgroundContextMenu,
  onCloseContextMenu,
  onCloseCreateEntryDialog,
  onCloseFileInfoDialog,
  onCloseNetworkDialog,
  onCloseRenameDialog,
  onConfirmEmptyTrash,
  onConflictResolution,
  onCopyContextEntry,
  onCopyContextPath,
  onCutContextEntry,
  onDeleteContextEntry,
  onDownloadContextEntry,
  onGetInfoContextEntry,
  onMoveContextEntryToTrash,
  onNavigateToNetwork,
  onOpenContextEntry,
  onOpenCreateEntryDialog,
  onPasteIntoBackground,
  onPasteIntoContextEntry,
  onRenameContextEntry,
  onRestoreContextEntry,
  onSubmitCreateEntryDialog,
  onSubmitRenameDialog,
  onToggleContextShare,
  onToggleContextStar,
  pasteConflict,
  pastePending,
  renameDialog,
  renamePending,
  showBackgroundContextMenu,
  showContextMenu,
  showEmptyTrashConfirm,
  showNetworkDialog,
  trashItemCount,
}: FileManagerDialogLayerProps) {
  return (
    <>
      {showContextMenu ? (
        <FileManagerContextMenu
          contextShareActive={Boolean(contextShare)}
          entry={showContextMenu.entry}
          isTrashView={isTrashView}
          pasteDisabled={!clipboardState || isTrashView || pastePending}
          x={showContextMenu.x}
          y={showContextMenu.y}
          onClose={onCloseContextMenu}
          onCopy={onCopyContextEntry}
          onCopyPath={onCopyContextPath}
          onCut={onCutContextEntry}
          onDeletePermanently={onDeleteContextEntry}
          onDownload={onDownloadContextEntry}
          onGetInfo={onGetInfoContextEntry}
          onMoveToTrash={onMoveContextEntryToTrash}
          onOpen={onOpenContextEntry}
          onPaste={onPasteIntoContextEntry}
          onRename={onRenameContextEntry}
          onRestore={onRestoreContextEntry}
          onToggleShare={onToggleContextShare}
          onToggleStar={onToggleContextStar}
        />
      ) : null}

      {showBackgroundContextMenu ? (
        <FileManagerBackgroundContextMenu
          pasteDisabled={!clipboardState || pastePending}
          x={showBackgroundContextMenu.x}
          y={showBackgroundContextMenu.y}
          onClose={onCloseBackgroundContextMenu}
          onNewFolder={() => onOpenCreateEntryDialog("folder")}
          onNewFile={() => onOpenCreateEntryDialog("file")}
          onPaste={onPasteIntoBackground}
        />
      ) : null}

      {createEntryDialog ? (
        <CreateEntryDialog
          dialog={createEntryDialog}
          isCreatePending={createPending}
          onClose={onCloseCreateEntryDialog}
          onDialogChange={onChangeCreateEntryDialog}
          onSubmit={onSubmitCreateEntryDialog}
        />
      ) : null}

      {renameDialog ? (
        <RenameEntryDialog
          dialog={renameDialog}
          isRenamePending={renamePending}
          onClose={onCloseRenameDialog}
          onDialogChange={onChangeRenameDialog}
          onSubmit={onSubmitRenameDialog}
        />
      ) : null}

      {showEmptyTrashConfirm ? (
        <EmptyTrashConfirmDialog
          itemCount={trashItemCount}
          onCancel={onCancelEmptyTrash}
          onConfirm={onConfirmEmptyTrash}
        />
      ) : null}

      {fileInfoDialog ? (
        <FileInfoDialogOverlay fileInfo={fileInfoDialog} onClose={onCloseFileInfoDialog} />
      ) : null}

      {pasteConflict ? (
        <PasteConflictDialog
          conflictName={pasteConflict.conflictName}
          onReplace={() => onConflictResolution("replace")}
          onKeepBoth={() => onConflictResolution("keep-both")}
          onSkip={() => onConflictResolution("skip")}
          onSkipAll={() => onConflictResolution("skip-all")}
        />
      ) : null}

      <NetworkStorageDialog
        isOpen={showNetworkDialog}
        onClose={onCloseNetworkDialog}
        onNavigateToNetwork={onNavigateToNetwork}
      />
    </>
  );
}
