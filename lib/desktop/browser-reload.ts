"use client";

export function reloadBrowserWindow() {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  url.searchParams.set("__homeio_reload", Date.now().toString());
  window.location.replace(url.toString());
}
