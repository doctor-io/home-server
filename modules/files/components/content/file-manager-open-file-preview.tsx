"use client";

import { MonitorSpeaker, Music, Pause, Play } from "@/components/icons/platform-icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { formatBytesCompact } from "@/lib/client/format";
import type { FileReadResponse } from "@/lib/shared/contracts/files";
import { MonacoEditorPane } from "@/modules/files/components/content/file-manager-editor-pane";
import type { FileEntry } from "@/modules/files/components/file-manager-presenters";
import React, { useCallback, useEffect, useRef, useState } from "react";
import type { SetStateAction } from "react";

export type PreviewBodyProps = {
  fileContentErrorMessage: string;
  fileContentIsError: boolean;
  fileContentIsLoading: boolean;
  onChangeOpenFileDraft: (value: SetStateAction<string>) => void;
  onSaveOpenFile?: () => void;
  openFile: { entry: FileEntry };
  openFileAssetUrl: string;
  openFileContent: string;
  openFileKey: string | null;
  openFileLanguage: string;
  openFileViewer: FileReadResponse | null;
};

export function PreviewBody({
  fileContentErrorMessage,
  fileContentIsError,
  fileContentIsLoading,
  onChangeOpenFileDraft,
  onSaveOpenFile,
  openFile,
  openFileAssetUrl,
  openFileContent,
  openFileKey,
  openFileLanguage,
  openFileViewer,
}: PreviewBodyProps) {
  const isViewerLoading = fileContentIsLoading || (!fileContentIsError && openFileViewer === null);

  if (isViewerLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading file...
      </div>
    );
  }

  if (fileContentIsError) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-status-red">
        {fileContentErrorMessage}
      </div>
    );
  }

  if (openFileViewer?.mode === "text") {
    return (
      <MonacoEditorPane
        key={openFileKey ?? "editor"}
        language={openFileLanguage}
        value={openFileContent}
        onChange={(value) => onChangeOpenFileDraft(value)}
        onSave={onSaveOpenFile}
      />
    );
  }

  if (openFileViewer?.mode === "image") {
    return (
      <div className="flex h-full items-center justify-center overflow-auto bg-background/50 p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={openFileAssetUrl}
          alt={openFile.entry.name}
          className="max-h-full max-w-full object-contain"
        />
      </div>
    );
  }

  if (openFileViewer?.mode === "pdf") {
    return (
      <iframe
        title={openFile.entry.name}
        src={openFileAssetUrl}
        className="h-full w-full border-0 bg-background/50"
      />
    );
  }

  if (openFileViewer?.mode === "video") {
    return (
      <div className="flex h-full items-center justify-center overflow-auto bg-black/95 p-4">
        <video
          key={openFileAssetUrl}
          src={openFileAssetUrl}
          controls
          className="max-h-full max-w-full"
          style={{ outline: "none" }}
        />
      </div>
    );
  }

  if (openFileViewer?.mode === "audio") {
    return <AudioPlayer src={openFileAssetUrl} fileName={openFile.entry.name} />;
  }

  if (openFileViewer?.mode === "too_large") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 p-6 text-center">
        <p className="text-sm text-muted-foreground">This file is too large to open in the editor.</p>
        <p className="text-xs text-muted-foreground/60">
          {formatBytesCompact(openFileViewer.sizeBytes)} — editor limit is 2 MB
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
      This file type is not supported for in-app preview.
    </div>
  );
}

function AudioPlayer({ src, fileName }: { src: string; fileName: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [audioError, setAudioError] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setAudioError(false);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onEnded = () => setIsPlaying(false);
    const onError = () => setAudioError(true);

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [src]);

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds)) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play();
    else audio.pause();
  }, []);

  return (
    <div className="h-full overflow-auto bg-linear-to-br from-background/70 via-background/35 to-primary/6 p-4 sm:p-6">
      <div className="mx-auto w-full max-w-2xl overflow-hidden rounded-[28px] border border-glass-border/70 bg-background/72 shadow-2xl backdrop-blur-xl">
        <div className="grid gap-6 p-5 sm:gap-7 sm:p-6">
          <div className={`relative mx-auto flex aspect-square w-full max-w-64 items-center justify-center overflow-hidden rounded-[24px] border ${audioError ? "border-status-red/20 bg-status-red/10" : "border-primary/20 bg-linear-to-br from-primary/16 via-primary/8 to-background/70"}`}>
            <div className="absolute inset-0 bg-radial from-white/8 via-transparent to-transparent" />
            <Music className={`relative size-24 ${audioError ? "text-status-red/60" : "text-primary/65"}`} />
          </div>

          <div className="min-w-0 space-y-5 sm:space-y-6">
            <div className="space-y-2 text-center sm:text-left">
              <p className="text-2xs font-medium uppercase tracking-[0.24em] text-muted-foreground/80">
                Audio Preview
              </p>
              <h3 className="truncate text-xl font-semibold text-foreground sm:text-2xl" title={fileName}>
                {fileName}
              </h3>
              <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground sm:justify-start">
                <span className="rounded-full border border-glass-border bg-background/60 px-2 py-0.5">
                  {formatTime(duration)}
                </span>
                <span>{audioError ? "Unavailable" : isPlaying ? "Now playing" : "Ready to play"}</span>
              </div>
            </div>

            {audioError ? (
              <p className="text-sm text-status-red">Failed to load audio file.</p>
            ) : null}

            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
              <div className="rounded-2xl border border-glass-border/70 bg-background/58 px-4 py-4 shadow-sm">
                <Slider
                  aria-label="Audio progress"
                  min={0}
                  max={duration || 1}
                  step={0.1}
                  value={[currentTime]}
                  onValueChange={([value]) => {
                    if (!audioRef.current || typeof value !== "number") return;
                    audioRef.current.currentTime = value;
                    setCurrentTime(value);
                  }}
                  className="[&_[data-slot=slider-thumb]]:size-3.5 [&_[data-slot=slider-thumb]]:rounded-full [&_[data-slot=slider-track]]:h-2 [&_[data-slot=slider-track]]:bg-white/5 [&_[data-slot=slider-range]]:bg-primary"
                />
              </div>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <button
                onClick={togglePlay}
                className="inline-flex size-14 shrink-0 items-center justify-center self-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:scale-[1.03] hover:brightness-110 active:scale-95 sm:self-auto"
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause className="size-5" /> : <Play className="ml-0.5 size-5" />}
              </button>

              <div className="flex min-w-0 flex-1 items-center justify-end">
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex h-11 items-center gap-2 rounded-2xl border border-glass-border/70 bg-background/58 px-4 text-xs font-medium text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground"
                      aria-label="Open volume control"
                    >
                      <MonitorSpeaker className="size-4 shrink-0" />
                      <span className="tabular-nums">{Math.round(volume * 100)}%</span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    side="top"
                    align="end"
                    className="w-16 rounded-2xl border-glass-border/80 bg-popover/95 p-3 shadow-xl backdrop-blur-xl"
                  >
                    <div className="flex flex-col items-center gap-3">
                      <span className="text-2xs font-medium tabular-nums text-muted-foreground">
                        {Math.round(volume * 100)}%
                      </span>
                      <Slider
                        aria-label="Audio volume"
                        orientation="vertical"
                        min={0}
                        max={1}
                        step={0.01}
                        value={[volume]}
                        onValueChange={([nextVolume]) => {
                          if (typeof nextVolume !== "number") return;
                          setVolume(nextVolume);
                          if (audioRef.current) audioRef.current.volume = nextVolume;
                        }}
                        className="h-28 [&_[data-slot=slider-thumb]]:size-3.5 [&_[data-slot=slider-thumb]]:rounded-full [&_[data-slot=slider-track]]:w-2 [&_[data-slot=slider-track]]:bg-white/8 [&_[data-slot=slider-range]]:bg-primary"
                      />
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
        </div>
        <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
      </div>
    </div>
  );
}
