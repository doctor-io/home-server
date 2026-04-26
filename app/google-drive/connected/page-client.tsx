"use client";

import { useEffect } from "react";

type GoogleDriveConnectedClientProps = {
  error?: string;
  success?: string;
};

export default function GoogleDriveConnectedClient({
  error,
  success,
}: GoogleDriveConnectedClientProps) {
  useEffect(() => {
    if (window.opener) {
      window.opener.postMessage(
        { type: "gd-oauth-complete", success: Boolean(success), error: error ?? null },
        window.location.origin,
      );
      window.close();
    }
  }, [success, error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="text-center">
        {success ? (
          <>
            <p className="text-lg font-semibold">Google Drive connected!</p>
            <p className="mt-1 text-sm text-muted-foreground">You can close this window.</p>
          </>
        ) : (
          <>
            <p className="text-lg font-semibold text-destructive">Connection failed</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {error ?? "Unknown error"}. You can close this window.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
