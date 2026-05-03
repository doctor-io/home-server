"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SectionDivider, InfoBanner } from "@/modules/settings/components/panel/controls";
import { SETTINGS_PANEL_INSET } from "@/modules/settings/components/panel/surface";
import { queryKeys } from "@/lib/shared/query-keys";
import type { GoogleOAuthConfigPublic } from "@/lib/shared/contracts/google-drive";
import { cn } from "@/lib/utils";
import { Check, Eye, EyeOff, ExternalLink } from "@/components/icons/platform-icons";

async function fetchGoogleOAuthConfig(): Promise<GoogleOAuthConfigPublic> {
  const res = await fetch("/api/v1/settings/google-oauth", { cache: "no-store" });
  const json = (await res.json()) as { data?: GoogleOAuthConfigPublic; error?: string };
  if (!res.ok) throw new Error(json.error ?? "Failed to fetch");
  return json.data!;
}

async function saveGoogleOAuthConfig(payload: { clientId: string; clientSecret: string; redirectUri: string }): Promise<GoogleOAuthConfigPublic> {
  const res = await fetch("/api/v1/settings/google-oauth", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await res.json()) as { data?: GoogleOAuthConfigPublic; error?: string };
  if (!res.ok) throw new Error(json.error ?? "Failed to save");
  return json.data!;
}

async function clearGoogleOAuthConfig(): Promise<void> {
  const res = await fetch("/api/v1/settings/google-oauth", { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to clear");
}

function InputRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className={cn(SETTINGS_PANEL_INSET, "flex items-start justify-between gap-4 px-4 py-3")}>
      <div className="min-w-0 flex-1">
        <div className="text-sm text-foreground">{label}</div>
        {description && <div className="mt-0.5 text-[11px] text-muted-foreground/70">{description}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

const inputCls = "h-8 w-64 rounded-lg border border-glass-border bg-background/55 px-3 text-xs text-foreground placeholder:text-muted-foreground/40 focus:border-primary/40 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50";

function GoogleDriveConfig() {
  const queryClient = useQueryClient();
  const { data: saved, isLoading } = useQuery({
    queryKey: queryKeys.googleOAuthConfig,
    queryFn: fetchGoogleOAuthConfig,
  });

  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [redirectUri, setRedirectUri] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

  const effectiveRedirectUri = redirectUri || saved?.redirectUri || "http://localhost:3000/api/v1/files/google-drive/callback";

  const saveMutation = useMutation({
    mutationFn: saveGoogleOAuthConfig,
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.googleOAuthConfig });
      void queryClient.invalidateQueries({ queryKey: queryKeys.googleDriveConnections });
      setClientSecret("");
      setClientId("");
      setRedirectUri("");
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 3000);
      void data;
    },
  });

  const clearMutation = useMutation({
    mutationFn: clearGoogleOAuthConfig,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.googleOAuthConfig });
      void queryClient.invalidateQueries({ queryKey: queryKeys.googleDriveConnections });
    },
  });

  const isConfigured = Boolean(saved?.clientId && saved?.hasSecret);
  const isBusy = saveMutation.isPending || clearMutation.isPending || isLoading;

  function handleSave() {
    const id = clientId.trim() || saved?.clientId || "";
    const secret = clientSecret.trim();
    const uri = redirectUri.trim() || effectiveRedirectUri;
    if (!id || !secret || !uri) return;
    saveMutation.mutate({ clientId: id, clientSecret: secret, redirectUri: uri });
  }

  const hasChanges = clientId.trim().length > 0 || clientSecret.trim().length > 0 || (redirectUri.trim().length > 0 && redirectUri.trim() !== saved?.redirectUri);
  const canSave = hasChanges && (clientSecret.trim().length > 0);

  return (
    <div className="flex flex-col gap-1">
      {/* Status banner */}
      {isConfigured && !saveMutation.error && (
        <InfoBanner
          text={savedOk ? "Credentials saved successfully." : `OAuth app configured · Client ID: ${saved?.clientId?.slice(0, 20)}...`}
          variant="info"
        />
      )}
      {saveMutation.error && (
        <InfoBanner text={(saveMutation.error as Error).message} variant="warning" />
      )}
      {clearMutation.error && (
        <InfoBanner text={(clearMutation.error as Error).message} variant="warning" />
      )}

      {/* Setup guide link */}
      <div className={cn(SETTINGS_PANEL_INSET, "flex items-center justify-between px-4 py-2.5")}>
        <div className="text-[11px] text-muted-foreground/70">
          You need a Google Cloud project with the Drive API enabled and an OAuth 2.0 Client ID.
        </div>
        <a
          href="https://console.cloud.google.com/apis/credentials"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-4 flex shrink-0 items-center gap-1 text-[11px] text-primary hover:underline"
        >
          Google Cloud Console
          <ExternalLink className="size-3" />
        </a>
      </div>

      {/* Redirect URI (read-only hint) */}
      <div className={cn(SETTINGS_PANEL_INSET, "flex items-center justify-between gap-4 px-4 py-2.5")}>
        <div className="min-w-0 flex-1">
          <div className="text-sm text-foreground">Redirect URI</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground/70">Add this exact URI to your OAuth client&apos;s Authorized redirect URIs</div>
        </div>
        <code className="rounded bg-background/55 px-2 py-1 font-mono text-[10px] text-foreground">
          {effectiveRedirectUri}
        </code>
      </div>

      {/* Custom redirect URI override */}
      <InputRow
        label="Custom redirect URI"
        description="Override if your server uses a public domain instead of localhost"
      >
        <input
          value={redirectUri}
          onChange={(e) => setRedirectUri(e.target.value)}
          placeholder={saved?.redirectUri ?? "http://localhost:3000/api/v1/files/google-drive/callback"}
          disabled={isBusy}
          className={inputCls}
        />
      </InputRow>

      {/* Client ID */}
      <InputRow label="Client ID" description="From Google Cloud Console → OAuth 2.0 Client IDs">
        <input
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          placeholder={saved?.clientId ? `${saved.clientId.slice(0, 24)}…` : "1234567890-abc...apps.googleusercontent.com"}
          disabled={isBusy}
          className={inputCls}
        />
      </InputRow>

      {/* Client Secret */}
      <InputRow label="Client secret" description="Kept encrypted in the database">
        <div className="relative">
          <input
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            type={showSecret ? "text" : "password"}
            placeholder={saved?.hasSecret ? "••••••••••••••••" : "GOCSPX-..."}
            disabled={isBusy}
            className={cn(inputCls, "pr-9")}
          />
          <button
            type="button"
            onClick={() => setShowSecret((v) => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground"
            tabIndex={-1}
          >
            {showSecret ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </button>
        </div>
      </InputRow>

      {/* Actions */}
      <div className={cn(SETTINGS_PANEL_INSET, "flex items-center justify-between px-4 py-2.5")}>
        {isConfigured ? (
          <button
            onClick={() => clearMutation.mutate()}
            disabled={isBusy}
            className="text-[11px] text-status-red hover:underline disabled:opacity-50"
          >
            {clearMutation.isPending ? "Removing…" : "Remove credentials"}
          </button>
        ) : (
          <span />
        )}
        <button
          onClick={handleSave}
          disabled={!canSave || isBusy}
          className="flex h-7 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          {savedOk && <Check className="size-3" />}
          {saveMutation.isPending ? "Saving…" : savedOk ? "Saved" : "Save credentials"}
        </button>
      </div>
    </div>
  );
}

export function IntegrationsSection() {
  return (
    <div className="flex flex-col gap-1">
      <SectionDivider title="Google Drive" />
      <GoogleDriveConfig />
    </div>
  );
}
