import "server-only";

import {
  ONBOARDING_FIRST_STEP,
  ONBOARDING_LAST_STEP,
  isOnboardingStepNumber,
  type OnboardingProgressInput,
  type OnboardingState,
  type OnboardingStatus,
  type OnboardingStepNumber,
} from "@/lib/shared/contracts/onboarding";
import {
  findOnboardingRow,
  markOnboardingComplete,
  markOnboardingPending,
  saveOnboardingProgress,
  type OnboardingRow,
} from "@/lib/server/modules/onboarding/repository";

export class OnboardingError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(code: string, message: string, statusCode: number) {
    super(message);
    this.name = "OnboardingError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

function toStatus(value: string | null | undefined): OnboardingStatus {
  if (value === "pending") return "pending";
  if (value === "complete") return "complete";
  // NULL, or anything we do not recognise, means the wizard does not apply to
  // this install. Failing to "not_applicable" keeps an unexpected value from
  // trapping an existing user behind a setup screen.
  return "not_applicable";
}

function toStep(value: number | null | undefined): OnboardingStepNumber {
  return isOnboardingStepNumber(value) ? value : ONBOARDING_FIRST_STEP;
}

function toState(row: OnboardingRow | null): OnboardingState {
  return {
    status: toStatus(row?.onboardingState),
    step: toStep(row?.onboardingStep),
    timezone: row?.timezone ?? null,
    defaultStorageRoot: row?.defaultStorageRoot ?? null,
    completedAt: row?.onboardingCompletedAt?.toISOString() ?? null,
  };
}

export async function getOnboardingState(): Promise<OnboardingState> {
  return toState(await findOnboardingRow());
}

/**
 * Called once, right after the first account is created. Installs that
 * registered before this release keep a NULL state and skip the wizard.
 */
export async function startOnboarding(): Promise<void> {
  await markOnboardingPending();
}

export async function recordOnboardingStep(
  input: OnboardingProgressInput,
): Promise<OnboardingState> {
  if (!isOnboardingStepNumber(input.step)) {
    throw new OnboardingError(
      "invalid_step",
      `Step must be between ${ONBOARDING_FIRST_STEP} and ${ONBOARDING_LAST_STEP}`,
      400,
    );
  }

  const current = await getOnboardingState();
  if (current.status !== "pending") {
    throw new OnboardingError("not_pending", "Setup is not in progress", 409);
  }

  await saveOnboardingProgress({
    step: input.step,
    ...(input.timezone === undefined ? {} : { timezone: normalizeOptional(input.timezone) }),
    ...(input.defaultStorageRoot === undefined
      ? {}
      : { defaultStorageRoot: normalizeOptional(input.defaultStorageRoot) }),
  });

  return getOnboardingState();
}

/**
 * Finishing and skipping are the same write: the wizard is explicitly
 * skippable at every step, so "skipped" is not a distinct end state.
 */
export async function finishOnboarding(): Promise<OnboardingState> {
  const current = await getOnboardingState();
  if (current.status === "complete" || current.status === "not_applicable") {
    return current;
  }

  await markOnboardingComplete();
  return getOnboardingState();
}

function normalizeOptional(value: string | null | undefined) {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
