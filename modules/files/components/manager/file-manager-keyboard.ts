"use client";

import { useEffect, useEffectEvent } from "react";
import { toFilePath } from "@/modules/files/hooks/useFiles";
import type { FileEntry } from "@/modules/files/components/file-manager-presenters";
import type {
  ClipboardState,
  FileManagerAction,
  PasteConflictState,
} from "@/modules/files/components/manager/file-manager-state";

type UseFileManagerKeyboardArgs = {
  clipboardState: ClipboardState | null;
  createEntryDialogOpen: boolean;
  currentPath: string[];
  dispatch: (action: FileManagerAction) => void;
  fileInfoDialogOpen: boolean;
  isStarredView: boolean;
  isTrashView: boolean;
  openFileOpen: boolean;
  pasteConflict: PasteConflictState | null;
  renameDialogOpen: boolean;
  searchQuery: string;
  selectedFile: string | null;
  selectedFiles: Set<string>;
  showContextMenuOpen: boolean;
  showEmptyTrashConfirmOpen: boolean;
  sortedEntries: FileEntry[];
  onCopyEntries: (entries: FileEntry[], operation: "copy" | "move") => void;
  onDeleteFromTrash: (entry: FileEntry) => Promise<void>;
  onMoveToTrash: (entry: FileEntry) => Promise<void>;
  onNavigateTo: (entry: FileEntry) => void;
  onNavigateUp: () => void;
  onPaste: (destinationPath: string) => Promise<void>;
  onRenameEntry: (entry: FileEntry) => void;
};

export function useFileManagerKeyboard({
  clipboardState,
  createEntryDialogOpen,
  currentPath,
  dispatch,
  fileInfoDialogOpen,
  isStarredView,
  isTrashView,
  onCopyEntries,
  onDeleteFromTrash,
  onMoveToTrash,
  onNavigateTo,
  onNavigateUp,
  onPaste,
  onRenameEntry,
  openFileOpen,
  pasteConflict,
  renameDialogOpen,
  searchQuery,
  selectedFile,
  selectedFiles,
  showContextMenuOpen,
  showEmptyTrashConfirmOpen,
  sortedEntries,
}: UseFileManagerKeyboardArgs) {
  const navigateToEvent = useEffectEvent((entry: FileEntry) => onNavigateTo(entry));
  const navigateUpEvent = useEffectEvent(() => onNavigateUp());
  const deleteFromTrashEvent = useEffectEvent((entry: FileEntry) => {
    void onDeleteFromTrash(entry);
  });
  const moveToTrashEvent = useEffectEvent((entry: FileEntry) => {
    void onMoveToTrash(entry);
  });
  const renameEntryEvent = useEffectEvent((entry: FileEntry) => onRenameEntry(entry));
  const copyEntryEvent = useEffectEvent((entries: FileEntry[], operation: "copy" | "move") => {
    onCopyEntries(entries, operation);
  });
  const pasteEvent = useEffectEvent((destinationPath: string) => {
    void onPaste(destinationPath);
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      if (
        createEntryDialogOpen ||
        renameDialogOpen ||
        fileInfoDialogOpen ||
        showEmptyTrashConfirmOpen ||
        showContextMenuOpen ||
        pasteConflict
      ) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        if (openFileOpen) dispatch({ type: "CLOSE_FILE" });
        else if (selectedFile || selectedFiles.size > 0) dispatch({ type: "CLEAR_SELECTION" });
        else if (searchQuery) dispatch({ type: "SET_SEARCH_QUERY", query: "" });
        return;
      }

      if (openFileOpen || sortedEntries.length === 0) return;

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const currentIndex = selectedFile
          ? sortedEntries.findIndex((entry) => entry.name === selectedFile)
          : -1;
        const nextIndex =
          event.key === "ArrowDown"
            ? Math.min(currentIndex + 1, sortedEntries.length - 1)
            : Math.max(currentIndex - 1, 0);
        dispatch({ type: "SELECT_FILE", name: sortedEntries[nextIndex].name });
        dispatch({ type: "SET_SELECTED_FILES", files: new Set([sortedEntries[nextIndex].name]) });
        return;
      }

      if (event.key === "Enter" || event.key === "ArrowRight") {
        if (!selectedFile) return;
        const entry = sortedEntries.find((candidate) => candidate.name === selectedFile);
        if (!entry) return;
        event.preventDefault();
        navigateToEvent(entry);
        return;
      }

      if (event.key === "Backspace" || event.key === "ArrowLeft") {
        if (currentPath.length > 0 && !isStarredView) {
          event.preventDefault();
          navigateUpEvent();
        }
        return;
      }

      if (event.key === "Delete") {
        const names =
          selectedFiles.size > 0 ? [...selectedFiles] : selectedFile ? [selectedFile] : [];
        if (names.length === 0) return;
        event.preventDefault();
        for (const name of names) {
          const entry = sortedEntries.find((candidate) => candidate.name === name);
          if (!entry) continue;
          if (isTrashView) deleteFromTrashEvent(entry);
          else moveToTrashEvent(entry);
        }
        return;
      }

      if (event.key === "F2") {
        if (!selectedFile || isTrashView) return;
        const entry = sortedEntries.find((candidate) => candidate.name === selectedFile);
        if (!entry) return;
        event.preventDefault();
        renameEntryEvent(entry);
        return;
      }

      const isMod = event.ctrlKey || event.metaKey;
      if (!isMod) return;

      if (event.key === "a" || event.key === "A") {
        event.preventDefault();
        dispatch({
          type: "SET_SELECTED_FILES",
          files: new Set(sortedEntries.map((entry) => entry.name)),
        });
        if (sortedEntries.length > 0) {
          dispatch({ type: "SELECT_FILE", name: sortedEntries[0].name });
        }
        return;
      }

      if (event.key === "c" || event.key === "C" || event.key === "x" || event.key === "X") {
        if (isTrashView) return;
        const entries =
          selectedFiles.size > 0
            ? sortedEntries.filter((entry) => selectedFiles.has(entry.name))
            : selectedFile
              ? sortedEntries.filter((entry) => entry.name === selectedFile)
              : [];
        if (entries.length === 0) return;
        event.preventDefault();
        copyEntryEvent(entries, event.key.toLowerCase() === "c" ? "copy" : "move");
        return;
      }

      if (event.key === "v" || event.key === "V") {
        if (!clipboardState || isTrashView) return;
        event.preventDefault();
        pasteEvent(toFilePath(currentPath));
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    clipboardState,
    createEntryDialogOpen,
    currentPath,
    dispatch,
    fileInfoDialogOpen,
    isStarredView,
    isTrashView,
    openFileOpen,
    pasteConflict,
    renameDialogOpen,
    searchQuery,
    selectedFile,
    selectedFiles,
    showContextMenuOpen,
    showEmptyTrashConfirmOpen,
    sortedEntries,
  ]);
}
