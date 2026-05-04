"use client";

import {
  useFileManagerClipboardActions,
  type UseFileManagerClipboardActionsArgs,
} from "@/modules/files/components/manager/file-manager-clipboard-actions";
import {
  useFileManagerEntryActions,
  type UseFileManagerEntryActionsArgs,
} from "@/modules/files/components/manager/file-manager-entry-actions";

type UseFileManagerActionsArgs = UseFileManagerEntryActionsArgs &
  UseFileManagerClipboardActionsArgs;

export function useFileManagerActions(args: UseFileManagerActionsArgs) {
  const entryActions = useFileManagerEntryActions(args);
  const clipboardActions = useFileManagerClipboardActions(args);
  return { ...entryActions, ...clipboardActions };
}
