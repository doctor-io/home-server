"use client";

import { useMemo } from "react";
import { toFilePath, type FilePasteCollision } from "@/modules/files/hooks/useFiles";
import type { FileEntry } from "@/modules/files/components/file-manager-presenters";
import type {
  ClipboardState,
  FileManagerAction,
  OpenFileState,
  PasteConflictState,
} from "@/modules/files/components/manager/file-manager-state";

type AsyncMutation<TArgs> = {
  mutateAsync: (args: TArgs) => Promise<unknown>;
};

export type UseFileManagerClipboardActionsArgs = {
  clipboardState: ClipboardState | null;
  dispatch: (action: FileManagerAction) => void;
  openFile: OpenFileState | null;
  pasteConflict: PasteConflictState | null;
  pasteFileEntryMutation: AsyncMutation<{
    sourcePath: string;
    destinationPath: string;
    operation: "copy" | "move";
    collision?: FilePasteCollision;
  }>;
  setStatusNotice: (message: string | null) => void;
};

export function useFileManagerClipboardActions({
  clipboardState,
  dispatch,
  openFile,
  pasteConflict,
  pasteFileEntryMutation,
  setStatusNotice,
}: UseFileManagerClipboardActionsArgs) {
  return useMemo(() => {
    function setClipboardFromEntries(entries: FileEntry[], operation: "copy" | "move") {
      dispatch({
        type: "SET_CLIPBOARD",
        sourcePaths: entries.map((entry) => entry.path),
        names: entries.map((entry) => entry.name),
        operation,
      });
      const label = entries.length === 1 ? entries[0].name : `${entries.length} items`;
      setStatusNotice(`${operation === "copy" ? "Copied" : "Cut"}: ${label}`);
    }

    async function handlePasteToDestination(destinationPath: string, collision?: FilePasteCollision) {
      if (!clipboardState) {
        setStatusNotice("Clipboard is empty");
        return;
      }

      for (const sourcePath of clipboardState.sourcePaths) {
        try {
          await pasteFileEntryMutation.mutateAsync({
            sourcePath,
            destinationPath,
            operation: clipboardState.operation,
            collision,
          });
        } catch (error) {
          const isConflict =
            error instanceof Error &&
            error.message.toLowerCase().includes("destination already exists");
          if (isConflict && !collision) {
            const remainingIndex = clipboardState.sourcePaths.indexOf(sourcePath);
            dispatch({
              type: "SHOW_PASTE_CONFLICT",
              conflict: {
                pendingSourcePaths: clipboardState.sourcePaths.slice(remainingIndex),
                conflictName: sourcePath.split("/").pop() ?? sourcePath,
                destinationPath,
                operation: clipboardState.operation,
              },
            });
            return;
          }
          setStatusNotice(error instanceof Error ? error.message : "Paste failed");
          return;
        }
      }

      const label =
        clipboardState.names.length === 1
          ? clipboardState.names[0] ?? "item"
          : `${clipboardState.names.length} items`;
      setStatusNotice(`${clipboardState.operation === "copy" ? "Copied" : "Moved"}: ${label}`);

      if (clipboardState.operation === "move") {
        dispatch({ type: "CLEAR_CLIPBOARD" });
        if (openFile && clipboardState.sourcePaths.includes(toFilePath(openFile.path))) {
          dispatch({ type: "CLOSE_FILE" });
        }
      }
    }

    async function handleConflictResolution(choice: FilePasteCollision | "skip-all") {
      if (!pasteConflict || !clipboardState) return;
      dispatch({ type: "HIDE_PASTE_CONFLICT" });
      if (choice === "skip-all") return;

      for (const sourcePath of pasteConflict.pendingSourcePaths) {
        try {
          await pasteFileEntryMutation.mutateAsync({
            sourcePath,
            destinationPath: pasteConflict.destinationPath,
            operation: pasteConflict.operation,
            collision: choice === "skip" ? "skip" : choice,
          });
        } catch (error) {
          setStatusNotice(error instanceof Error ? error.message : "Paste failed");
          return;
        }
      }

      const total = clipboardState.sourcePaths.length;
      const label = total === 1 ? clipboardState.names[0] ?? "item" : `${total} items`;
      setStatusNotice(`${pasteConflict.operation === "copy" ? "Copied" : "Moved"}: ${label}`);

      if (pasteConflict.operation === "move") {
        dispatch({ type: "CLEAR_CLIPBOARD" });
        if (openFile && clipboardState.sourcePaths.includes(toFilePath(openFile.path))) {
          dispatch({ type: "CLOSE_FILE" });
        }
      }
    }

    return { handleConflictResolution, handlePasteToDestination, setClipboardFromEntries };
  }, [clipboardState, dispatch, openFile, pasteConflict, pasteFileEntryMutation, setStatusNotice]);
}
