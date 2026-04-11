"use client";

import { cn } from "@/lib/utils";

export function EthernetIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className={cn("size-4", className)}
    >
      {/* Horizontal bus */}
      <path d="M3 10h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      {/* Center drop */}
      <path d="M10 10v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      {/* Left drop */}
      <path d="M5.5 10v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      {/* Right drop */}
      <path d="M14.5 10v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      {/* Top stem */}
      <path d="M10 6v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      {/* Top connector */}
      <rect x="7.5" y="4" width="5" height="2.5" rx="1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function getSignalLevel(quality: number | null) {
  if (quality === null) return 1;
  if (quality >= 70) return 3;
  if (quality >= 40) return 2;
  return 1;
}

export function WifiSignalIcon({
  quality,
  className,
}: {
  quality: number | null;
  className?: string;
}) {
  const level = getSignalLevel(quality);

  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className={cn("size-4", className)}
    >
      <path
        d="M3.5 8.25c4.1-3.95 8.9-3.95 13 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={level >= 3 ? 1 : 0.22}
      />
      <path
        d="M6.2 11c2.45-2.3 5.15-2.3 7.6 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={level >= 2 ? 1 : 0.22}
      />
      <path
        d="M8.85 13.8c0.75-0.7 1.55-0.7 2.3 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={level >= 1 ? 1 : 0.22}
      />
      {/* <circle cx="10" cy="16.45" r="1.25" fill="currentColor" /> */}
    </svg>
  );
}

export function WifiStatusIcon({
  connected,
  quality,
  className,
}: {
  connected: boolean;
  quality: number | null;
  className?: string;
}) {
  if (connected) {
    return <WifiSignalIcon quality={quality} className={className} />;
  }

  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className={cn("size-4", className)}
    >
      <path
        d="M3.5 8.25c4.1-3.95 8.9-3.95 13 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.28"
      />
      <path
        d="M6.2 11c2.45-2.3 5.15-2.3 7.6 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.28"
      />
      <path
        d="M8.85 13.8c0.75-0.7 1.55-0.7 2.3 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.28"
      />
      <circle cx="10" cy="16.45" r="1.25" fill="currentColor" opacity="0.28" />
      <path
        d="M4.25 4.5 15.75 16"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}
