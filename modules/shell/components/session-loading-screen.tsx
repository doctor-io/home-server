"use client";

import { StatusScreen } from "./status-screen";

export function SessionLoadingScreen() {
  return (
    <StatusScreen
      title="Loading session..."
      body="Preparing your desktop, restoring preferences, and reconnecting Homeio services now."
    />
  );
}
