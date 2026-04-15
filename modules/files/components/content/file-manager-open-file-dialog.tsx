"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Save } from "@/components/icons/platform-icons";
import type { FileReadResponse } from "@/lib/shared/contracts/files";
import { PreviewBody } from "@/modules/files/components/content/file-manager-open-file-preview";
import {
  FILES_BADGE_SURFACE,
  FILES_PANEL_INSET,
} from "@/modules/files/components/file-manager-surface";
import { getFileIcon, type FileEntry } from "@/modules/files/components/file-manager-presenters";
import React from "react";
import type { SetStateAction } from "react";

type OpenFileDialogProps = {
  canSaveOpenFile: boolean;
  editorNotice: string | null;
  fileContentErrorMessage: string;
  fileContentIsError: boolean;
  fileContentIsLoading: boolean;
  onChangeOpenFileDraft: (value: SetStateAction<string>) => void;
  onClose: () => void;
  onSave: () => void;
  openFile: { entry: FileEntry };
  openFileAssetUrl: string;
  openFileBadgeLabel: string;
  openFileContent: string;
  openFileKey: string | null;
  openFileLanguage: string;
  openFileViewer: FileReadResponse | null;
  showSaveOpenFile: boolean;
};

export function OpenFileDialog({
  canSaveOpenFile,
  editorNotice,
  fileContentErrorMessage,
  fileContentIsError,
  fileContentIsLoading,
  onChangeOpenFileDraft,
  onClose,
  onSave,
  openFile,
  openFileAssetUrl,
  openFileBadgeLabel,
  openFileContent,
  openFileKey,
  openFileLanguage,
  openFileViewer,
  showSaveOpenFile,
}: OpenFileDialogProps) {
  const headerEntry =
    openFileViewer && openFile.entry.type === "file"
      ? { ...openFile.entry, ext: openFileViewer.ext ?? openFile.entry.ext }
      : openFile.entry;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        aria-label={`Open file ${openFile.entry.name}`}
        className={`h-[min(88vh,920px)] w-[min(96vw,76rem)] max-w-[min(96vw,76rem)] gap-0 overflow-hidden rounded-[24px] border-glass-border/80 bg-popover/95 p-0 shadow-2xl backdrop-blur-xl sm:max-w-[min(96vw,76rem)] lg:w-[min(92vw,84rem)] lg:max-w-[min(92vw,84rem)] ${FILES_PANEL_INSET}`}
      >
        <DialogHeader className="gap-3 border-b border-glass-border/80 bg-linear-to-b from-background/88 to-background/60 px-5 py-4 pr-14 text-left">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-2xl border border-glass-border/70 bg-background/72 text-primary shadow-sm">
                {getFileIcon(headerEntry)}
              </div>
                <div className="min-w-0 space-y-1">
                  <DialogTitle className="truncate text-base font-semibold text-foreground">
                    {openFile.entry.name}
                  </DialogTitle>
                  <DialogDescription className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className={`${FILES_BADGE_SURFACE} px-2 py-0.5 uppercase tracking-wider text-primary`}>
                      {openFileBadgeLabel}
                    </span>
                  </DialogDescription>
                </div>
              </div>

            <div className="flex shrink-0 items-center gap-2">
              {showSaveOpenFile ? (
                <button
                  onClick={onSave}
                  disabled={!canSaveOpenFile}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-primary/20 bg-primary/14 px-3 text-xs font-medium text-primary transition-colors hover:bg-primary/22 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Save className="size-3.5" />
                  Save
                </button>
              ) : null}
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 bg-background/30">
          <PreviewBody
            fileContentErrorMessage={fileContentErrorMessage}
            fileContentIsError={fileContentIsError}
            fileContentIsLoading={fileContentIsLoading}
            onChangeOpenFileDraft={onChangeOpenFileDraft}
            openFile={openFile}
            openFileAssetUrl={openFileAssetUrl}
            openFileContent={openFileContent}
            openFileKey={openFileKey}
            openFileLanguage={openFileLanguage}
            openFileViewer={openFileViewer}
          />
        </div>

        {editorNotice ? (
          <div className="border-t border-glass-border/80 bg-background/60 px-5 py-3">
            <div className="inline-flex items-center rounded-full border border-glass-border bg-background/72 px-2.5 py-1 text-xs text-muted-foreground">
              {editorNotice}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
