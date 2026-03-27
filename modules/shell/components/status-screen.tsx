"use client";

import Image from "next/image";
import { type ReactNode } from "react";
import { FullScreenShell } from "./full-screen-shell";

type StatusScreenProps = {
  title: string;
  body: string;
  action?: ReactNode;
  failed?: boolean;
};

export function StatusScreen({
  title,
  body,
  action,
  failed = false,
}: StatusScreenProps) {
  return (
    <FullScreenShell
      showClock={false}
      center={
        <div className="flex items-center justify-center">
          <div
            className={`flex size-32 items-center justify-center rounded-[2rem] border shadow-2xl shadow-black/45 backdrop-blur-md sm:size-36 ${
              failed
                ? "border-status-red/35 bg-status-red/10"
                : "animate-homeio-breathe-glow border-white/14 bg-white/10"
            }`}
          >
            <Image
              src="/icon.png"
              alt="Homeio"
              width={96}
              height={96}
              className={`size-20 sm:size-24 ${failed ? "" : "animate-homeio-breathe blur-[0.25px]"}`}
            />
          </div>
        </div>
      }
      bottom={
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {title}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/78 sm:text-base">
            {body}
          </p>
          {action}
        </div>
      }
    />
  );
}
