"use client";

import { useEffect, useState } from "react";
import { Copy, Plus, Trash2 } from "@/components/icons/platform-icons";
import { SectionDivider } from "@/modules/settings/components/panel/controls";
import { SETTINGS_PANEL_INSET } from "@/modules/settings/components/panel/surface";
import { cn } from "@/lib/utils";
import {
  API_TOKEN_SCOPES,
  API_TOKEN_SCOPE_LABELS,
  isStale,
  type ApiToken,
  type ApiTokenScope,
  type ApiTokenWithSecret,
} from "@/lib/shared/contracts/api-tokens";

function formatWhen(value: string | null) {
  if (!value) return "never";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "never" : parsed.toLocaleDateString();
}

export function ApiTokensCard({ isDemoMode = false }: { isDemoMode?: boolean }) {
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<ApiTokenScope[]>(["read:metrics"]);
  const [issued, setIssued] = useState<ApiTokenWithSecret | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  async function load() {
    try {
      const response = await fetch("/api/v1/auth/tokens");
      if (!response.ok) throw new Error("failed");
      const json = (await response.json()) as { data: ApiToken[] };
      setTokens(json.data);
    } catch {
      setError("Could not load API tokens.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function toggleScope(scope: ApiTokenScope) {
    setScopes((current) =>
      current.includes(scope) ? current.filter((value) => value !== scope) : [...current, scope],
    );
  }

  async function create() {
    setIsBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/auth/tokens", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), scopes }),
      });
      if (!response.ok) throw new Error("failed");

      const json = (await response.json()) as { data: ApiTokenWithSecret };
      setIssued(json.data);
      setIsCreating(false);
      setName("");
      setScopes(["read:metrics"]);
      await load();
    } catch {
      setError("Could not create the token.");
    } finally {
      setIsBusy(false);
    }
  }

  async function revoke(id: string) {
    setIsBusy(true);
    try {
      await fetch(`/api/v1/auth/tokens/${encodeURIComponent(id)}`, { method: "DELETE" });
      await load();
    } catch {
      setError("Could not revoke the token.");
    } finally {
      setIsBusy(false);
    }
  }

  const wantsPower = scopes.includes("system:power");
  const canSubmit = name.trim().length > 0 && scopes.length > 0 && !isBusy;

  return (
    <>
      <SectionDivider title="API Tokens" />

      {issued && (
        <div className={cn(SETTINGS_PANEL_INSET, "flex flex-col gap-2 px-4 py-3")}>
          <span className="text-xs font-medium text-status-green">
            Copy this token now — it is not shown again
          </span>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md bg-black/40 px-2 py-1.5 font-mono text-2xs text-foreground">
              {issued.token}
            </code>
            <button
              type="button"
              onClick={() => void navigator.clipboard?.writeText(issued.token)}
              className="flex items-center gap-1 rounded-md border border-glass-border px-2 py-1.5 text-2xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <Copy className="size-3" /> Copy
            </button>
          </div>
          <button
            type="button"
            onClick={() => setIssued(null)}
            className="self-start text-2xs text-muted-foreground hover:text-foreground"
          >
            I have saved it
          </button>
        </div>
      )}

      <div className={cn(SETTINGS_PANEL_INSET, "overflow-hidden")}>
        {tokens.length === 0 ? (
          <p className="px-4 py-3 text-2xs text-muted-foreground/70">
            No tokens yet. Create one to let Home Assistant, n8n or a script talk to Homeio.
          </p>
        ) : (
          tokens.map((token) => (
            <div
              key={token.id}
              className="flex items-center gap-3 border-b border-glass-border/40 px-4 py-3 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm text-foreground">{token.name}</span>
                  {token.revokedAt ? (
                    <span className="rounded bg-white/10 px-1.5 py-0.5 text-3xs text-muted-foreground">
                      Revoked
                    </span>
                  ) : isStale(token) ? (
                    // Not an error, but worth asking whether it is still needed.
                    <span className="rounded bg-status-amber/15 px-1.5 py-0.5 text-3xs text-status-amber">
                      Unused 90 days
                    </span>
                  ) : null}
                </div>
                <div className="mt-0.5 truncate font-mono text-3xs text-muted-foreground/70">
                  {token.prefix}… · {token.scopes.join(", ") || "no scopes"}
                </div>
                <div className="text-3xs text-muted-foreground/60">
                  Last used {formatWhen(token.lastUsedAt)}
                  {token.lastUsedIp ? ` from ${token.lastUsedIp}` : ""}
                </div>
              </div>

              {!token.revokedAt && (
                <button
                  type="button"
                  onClick={() => void revoke(token.id)}
                  disabled={isBusy || isDemoMode}
                  className="flex shrink-0 items-center gap-1 rounded-md border border-status-red/30 px-2 py-1 text-2xs text-status-red transition-colors hover:bg-status-red/10 disabled:opacity-50"
                >
                  <Trash2 className="size-3" /> Revoke
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {isCreating ? (
        <div className={cn(SETTINGS_PANEL_INSET, "flex flex-col gap-3 px-4 py-3")}>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="What is this token for? e.g. Home Assistant"
            aria-label="Token name"
            className="rounded-lg border border-glass-border bg-black/25 px-2.5 py-2 text-xs text-foreground outline-none focus:border-primary/50"
          />

          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1 text-2xs text-muted-foreground">Scopes</legend>
            {API_TOKEN_SCOPES.map((scope) => (
              <label key={scope} className="flex items-center gap-2 text-2xs text-foreground">
                <input
                  type="checkbox"
                  checked={scopes.includes(scope)}
                  onChange={() => toggleScope(scope)}
                  className="size-3.5 accent-primary"
                />
                {API_TOKEN_SCOPE_LABELS[scope]}
              </label>
            ))}
          </fieldset>

          {wantsPower && (
            // Power is the one scope that can take the server away from you.
            <p className="rounded-md border border-status-amber/30 bg-status-amber/10 px-2.5 py-2 text-2xs leading-relaxed text-status-amber">
              This token will be able to shut down and restart your server. Anyone who
              obtains it can take it offline.
            </p>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void create()}
              disabled={!canSubmit}
              className="rounded-md bg-primary px-3 py-1.5 text-2xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {isBusy ? "Creating…" : "Create token"}
            </button>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="rounded-md border border-glass-border px-3 py-1.5 text-2xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsCreating(true)}
          disabled={isDemoMode}
          className={cn(
            SETTINGS_PANEL_INSET,
            "flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50",
          )}
        >
          <Plus className="size-3.5" /> New token
        </button>
      )}

      {error && (
        <p className="px-4 py-2 text-2xs text-status-red" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
