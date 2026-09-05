"use client";

import {
  ArchiveFileIcon,
  AudioFileIcon,
  CodeFileIcon,
  DocumentFileIcon,
  FolderIcon,
  GenericFileIcon,
  ImageFileIcon,
  OpenFolderIcon,
  TextFileIcon,
  VideoFileIcon,
} from "@/components/icons/file-icons";

const ICONS = [
  { label: "Folder", icon: FolderIcon },
  { label: "Open Folder", icon: OpenFolderIcon },
  { label: "Image", icon: ImageFileIcon },
  { label: "Audio", icon: AudioFileIcon },
  { label: "Video", icon: VideoFileIcon },
  { label: "Archive", icon: ArchiveFileIcon },
  { label: "Code", icon: CodeFileIcon },
  { label: "Document", icon: DocumentFileIcon },
  { label: "Text", icon: TextFileIcon },
  { label: "Generic", icon: GenericFileIcon },
];

export default function IconsDevPage() {
  return (
    <div className="min-h-screen bg-[#1a1a1a] p-12">
      <h1 className="mb-2 text-2xl font-bold text-white">File Icons</h1>
      <p className="mb-10 text-sm text-white/40">
        Colors follow <code className="rounded bg-white/10 px-1.5 py-0.5">--accent</code> CSS variable
      </p>

      {/* Large */}
      <section className="mb-12">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-white/30">
          Large — size-14 (56 px)
        </h2>
        <div className="flex flex-wrap gap-8">
          {ICONS.map(({ label, icon: Icon }) => (
            <div key={label} className="flex flex-col items-center gap-2">
              <Icon className="size-14" />
              <span className="text-2xs text-white/50">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Medium */}
      <section className="mb-12">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-white/30">
          Medium — size-8 (32 px)
        </h2>
        <div className="flex flex-wrap gap-6">
          {ICONS.map(({ label, icon: Icon }) => (
            <div key={label} className="flex flex-col items-center gap-2">
              <Icon className="size-8" />
              <span className="text-2xs text-white/50">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Small */}
      <section className="mb-12">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-white/30">
          Small — size-5 (20 px)
        </h2>
        <div className="flex flex-wrap items-center gap-5">
          {ICONS.map(({ label, icon: Icon }) => (
            <div key={label} className="flex flex-col items-center gap-2">
              <Icon className="size-5" />
              <span className="text-2xs text-white/50">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* In context — simulated grid row */}
      <section>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-white/30">
          In context — grid
        </h2>
        <div className="flex flex-wrap gap-3">
          {[
            { label: "Documents", icon: FolderIcon },
            { label: "photo.jpg", icon: ImageFileIcon },
            { label: "song.mp3", icon: AudioFileIcon },
            { label: "movie.mp4", icon: VideoFileIcon },
            { label: "archive.zip", icon: ArchiveFileIcon },
            { label: "index.ts", icon: CodeFileIcon },
            { label: "report.pdf", icon: DocumentFileIcon },
            { label: "notes.txt", icon: TextFileIcon },
            { label: "unknown.bin", icon: GenericFileIcon },
          ].map(({ label, icon: Icon }) => (
            <div
              key={label}
              className="flex w-24 cursor-pointer flex-col items-center gap-3 rounded-xl border border-transparent p-4 hover:bg-white/5"
            >
              <Icon className="size-14" />
              <span className="line-clamp-2 break-all text-center text-xs font-medium text-white/70">
                {label}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
