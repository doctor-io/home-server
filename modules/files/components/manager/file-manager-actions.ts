"use client";

import { useFileManagerClipboardActions } from "@/modules/files/components/manager/file-manager-clipboard-actions";
import { useFileManagerEntryActions } from "@/modules/files/components/manager/file-manager-entry-actions";

export function useFileManagerActions(args: Parameters<typeof useFileManagerEntryActions>[0]) {
  const entryActions = useFileManagerEntryActions(args);
  const clipboardActions = useFileManagerClipboardActions(args);
  return { ...entryActions, ...clipboardActions };
}
