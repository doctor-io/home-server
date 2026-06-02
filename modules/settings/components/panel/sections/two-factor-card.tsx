"use client";

import { useState } from "react";
import { ArrowLeft, Check, Copy, Download, Lock, Shield } from "@/components/icons/platform-icons";
import { cn } from "@/lib/utils";
import { SETTINGS_PANEL_INSET } from "@/modules/settings/components/panel/surface";
import { SectionDivider } from "@/modules/settings/components/panel/controls";
import type {
  TwoFactorErrorCode,
  TwoFactorStatus,
} from "@/lib/shared/contracts/auth";
import {
  TwoFactorApiError,
  useDisableTwoFactor,
  useStartTwoFactorSetup,
  useVerifyTwoFactor,
} from "@/modules/settings/hooks/useTwoFactor";

type WizardStep = "idle" | "scan" | "verify" | "backup-codes";

type TwoFactorCardProps = {
  status: TwoFactorStatus;
  isDemoMode?: boolean;
};

const codeInputCls =
  "h-10 w-full rounded-lg border border-glass-border bg-background/55 px-3 font-mono text-sm text-foreground tracking-[0.2em] text-center focus:border-primary/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50";

function describeError(error: unknown): string {
  if (error instanceof TwoFactorApiError) {
    return mapErrorCodeToMessage(error.code, error.message);
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong";
}

function mapErrorCodeToMessage(
  code: TwoFactorErrorCode | "unknown",
  fallback: string,
): string {
  switch (code) {
    case "invalid_totp":
      return "That code doesn't match. Check the time on your device and try again.";
    case "invalid_backup_code":
      return "That backup code isn't valid or has already been used.";
    case "too_many_attempts":
      return "Too many attempts. Wait a moment before trying again.";
    case "already_enabled":
      return "Two-factor is already enabled.";
    case "not_enabled":
      return "Two-factor isn't enabled on this account.";
    case "no_pending_enrollment":
      return "Enrolment expired. Start again.";
    default:
      return fallback;
  }
}

function formatEnrolledAt(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function downloadBackupCodes(codes: string[]) {
  const text = [
    "Homeio — Two-Factor Backup Codes",
    "Generated: " + new Date().toISOString(),
    "",
    "Each code may be used once. Store these somewhere safe — they are the",
    "only way to sign in if you lose access to your authenticator app.",
    "",
    ...codes,
    "",
  ].join("\n");
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "homeio-2fa-backup-codes.txt";
  a.click();
  URL.revokeObjectURL(url);
}

export function TwoFactorCard({ status, isDemoMode = false }: TwoFactorCardProps) {
  const [step, setStep] = useState<WizardStep>("idle");
  const [setupData, setSetupData] = useState<{
    secret: string;
    otpAuthUrl: string;
    qrCodeSvg: string;
  } | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [acknowledgedBackup, setAcknowledgedBackup] = useState(false);
  const [showDisable, setShowDisable] = useState(false);
  const [secretCopied, setSecretCopied] = useState(false);

  const startSetup = useStartTwoFactorSetup();
  const verify = useVerifyTwoFactor();
  const disable = useDisableTwoFactor();

  async function handleEnableClick() {
    if (isDemoMode) return;
    try {
      const data = await startSetup.mutateAsync();
      setSetupData(data);
      setVerifyCode("");
      setAcknowledgedBackup(false);
      setStep("scan");
    } catch {
      // mutation surface keeps the error
    }
  }

  async function handleVerifySubmit() {
    if (!verifyCode.trim()) return;
    try {
      const result = await verify.mutateAsync({ code: verifyCode.trim() });
      setBackupCodes(result.backupCodes);
      setVerifyCode("");
      setStep("backup-codes");
    } catch {
      // error surface kept by mutation
    }
  }

  async function handleDisableSubmit() {
    if (!disableCode.trim()) return;
    try {
      await disable.mutateAsync({ code: disableCode.trim() });
      setDisableCode("");
      setShowDisable(false);
      // The server clears the session cookie. Push to /login so the user
      // doesn't sit on a stale screen until the next request 401s.
      window.location.href = "/login";
    } catch {
      // surface kept by mutation
    }
  }

  function cancelWizard() {
    setStep("idle");
    setSetupData(null);
    setVerifyCode("");
    setBackupCodes([]);
    setAcknowledgedBackup(false);
    startSetup.reset();
    verify.reset();
  }

  function finishBackupStep() {
    setBackupCodes([]);
    setAcknowledgedBackup(false);
    setSetupData(null);
    setStep("idle");
  }

  async function copySecret() {
    if (!setupData) return;
    try {
      await navigator.clipboard.writeText(setupData.secret);
      setSecretCopied(true);
      window.setTimeout(() => setSecretCopied(false), 1500);
    } catch {
      // Ignore — fallback is the visible secret string.
    }
  }

  async function copyAllBackupCodes() {
    try {
      await navigator.clipboard.writeText(backupCodes.join("\n"));
    } catch {
      // Ignore.
    }
  }

  return (
    <>
      <SectionDivider title="Two-Factor Authentication" />

      {step === "idle" ? (
        <div className={cn(SETTINGS_PANEL_INSET, "flex flex-col gap-3 px-4 py-3")}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-glass-border bg-background/55">
                <Shield className="size-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    Authenticator app
                  </span>
                  <StatusBadge enabled={status.enabled} />
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                  {status.enabled
                    ? `Enabled on ${formatEnrolledAt(status.enrolledAt)}. A 6-digit code is required at sign-in.`
                    : "Add a second step to sign-in using an authenticator app (Google Authenticator, 1Password, Aegis, …)."}
                </p>
              </div>
            </div>

            <div className="shrink-0">
              {status.enabled ? (
                <button
                  type="button"
                  onClick={() => setShowDisable((v) => !v)}
                  disabled={isDemoMode}
                  className="rounded-lg border border-status-red/40 px-3 py-1.5 text-xs font-medium text-status-red transition-colors hover:bg-status-red/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {showDisable ? "Cancel" : "Disable"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleEnableClick}
                  disabled={isDemoMode || startSetup.isPending}
                  className="rounded-lg bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/25 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {startSetup.isPending ? "Preparing…" : "Enable"}
                </button>
              )}
            </div>
          </div>

          {startSetup.error ? (
            <p className="text-xs text-status-red/90">{describeError(startSetup.error)}</p>
          ) : null}

          {status.enabled && showDisable ? (
            <div className="flex flex-col gap-2 rounded-lg border border-glass-border bg-background/40 p-3">
              <label
                htmlFor="two-factor-disable-code"
                className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80"
              >
                Confirm with current code or backup code
              </label>
              <input
                id="two-factor-disable-code"
                value={disableCode}
                onChange={(event) => setDisableCode(event.target.value)}
                inputMode="text"
                autoComplete="one-time-code"
                placeholder="123456 or backup code"
                disabled={disable.isPending}
                className={codeInputCls}
              />
              {disable.error ? (
                <p className="text-xs text-status-red/90">{describeError(disable.error)}</p>
              ) : null}
              <button
                type="button"
                onClick={handleDisableSubmit}
                disabled={disable.isPending || !disableCode.trim()}
                className="self-end rounded-lg bg-status-red/85 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-status-red disabled:cursor-not-allowed disabled:opacity-50"
              >
                {disable.isPending ? "Disabling…" : "Disable 2FA"}
              </button>
              <p className="text-[11px] text-muted-foreground/70">
                You&apos;ll be signed out and need to sign in again.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {step === "scan" && setupData ? (
        <div className={cn(SETTINGS_PANEL_INSET, "flex flex-col gap-4 px-4 py-4")}>
          <button
            type="button"
            onClick={cancelWizard}
            className="self-start inline-flex items-center gap-1 text-[11px] text-muted-foreground/80 hover:text-foreground"
          >
            <ArrowLeft className="size-3" />
            Cancel
          </button>

          <div className="flex flex-col gap-3 md:flex-row md:items-start">
            <div
              className="mx-auto size-44 shrink-0 rounded-xl bg-white p-2 md:mx-0"
              // The setup endpoint returns a sanitized, fully-formed <svg> the
              // server controls end-to-end. Rendering as HTML is intentional.
              dangerouslySetInnerHTML={{ __html: setupData.qrCodeSvg }}
            />
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Scan with your authenticator app
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground/80">
                  Add a new account and scan this QR. Don&apos;t have a camera?
                  Enter the key below manually.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all rounded-lg border border-glass-border bg-background/55 px-2 py-1.5 font-mono text-xs text-foreground">
                  {setupData.secret}
                </code>
                <button
                  type="button"
                  onClick={copySecret}
                  className="flex size-8 items-center justify-center rounded-lg border border-glass-border bg-background/55 text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground"
                  aria-label="Copy secret"
                >
                  {secretCopied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setStep("verify")}
                className="self-start rounded-lg bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/25"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {step === "verify" ? (
        <div className={cn(SETTINGS_PANEL_INSET, "flex flex-col gap-3 px-4 py-4")}>
          <button
            type="button"
            onClick={() => setStep("scan")}
            className="self-start inline-flex items-center gap-1 text-[11px] text-muted-foreground/80 hover:text-foreground"
          >
            <ArrowLeft className="size-3" />
            Back
          </button>
          <div>
            <p className="text-sm font-medium text-foreground">
              Enter the 6-digit code
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground/80">
              Type the current code from your authenticator app to confirm.
            </p>
          </div>
          <input
            value={verifyCode}
            onChange={(event) => setVerifyCode(event.target.value.replace(/\s+/g, ""))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            disabled={verify.isPending}
            className={codeInputCls}
            autoFocus
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleVerifySubmit();
              }
            }}
          />
          {verify.error ? (
            <p className="text-xs text-status-red/90">{describeError(verify.error)}</p>
          ) : null}
          <button
            type="button"
            onClick={handleVerifySubmit}
            disabled={verify.isPending || !verifyCode.trim()}
            className="self-end rounded-lg bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {verify.isPending ? "Verifying…" : "Verify and enable"}
          </button>
        </div>
      ) : null}

      {step === "backup-codes" ? (
        <div className={cn(SETTINGS_PANEL_INSET, "flex flex-col gap-3 px-4 py-4")}>
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-status-amber/30 bg-status-amber/10">
              <Lock className="size-4 text-status-amber" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                Save your backup codes
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground/80">
                These ten codes are the only way to sign in if you lose your
                authenticator. Each works once. We can&apos;t show them again.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-lg border border-glass-border bg-background/40 p-3 font-mono text-xs text-foreground">
            {backupCodes.map((code) => (
              <span key={code} className="select-all tabular-nums tracking-[0.18em]">
                {code}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyAllBackupCodes}
              className="inline-flex items-center gap-1.5 rounded-lg border border-glass-border bg-background/55 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-background/70"
            >
              <Copy className="size-3" />
              Copy all
            </button>
            <button
              type="button"
              onClick={() => downloadBackupCodes(backupCodes)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-glass-border bg-background/55 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-background/70"
            >
              <Download className="size-3" />
              Download .txt
            </button>
          </div>

          <label className="mt-1 flex items-start gap-2 text-[11px] text-muted-foreground/90">
            <input
              type="checkbox"
              checked={acknowledgedBackup}
              onChange={(event) => setAcknowledgedBackup(event.target.checked)}
              className="mt-0.5 size-3.5 accent-primary"
            />
            <span>I saved these codes somewhere safe.</span>
          </label>

          <button
            type="button"
            onClick={finishBackupStep}
            disabled={!acknowledgedBackup}
            className="self-end rounded-lg bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Done
          </button>
        </div>
      ) : null}
    </>
  );
}

function StatusBadge({ enabled }: { enabled: boolean }) {
  if (enabled) {
    return (
      <span className="rounded-md bg-status-green/15 px-1.5 py-0.5 text-[11px] font-medium text-status-green">
        Enabled
      </span>
    );
  }
  return (
    <span className="rounded-md bg-muted/40 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
      Disabled
    </span>
  );
}
