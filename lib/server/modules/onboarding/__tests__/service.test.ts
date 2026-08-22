import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockFindOnboardingRow,
  mockMarkOnboardingComplete,
  mockMarkOnboardingPending,
  mockSaveOnboardingProgress,
} = vi.hoisted(() => ({
  mockFindOnboardingRow: vi.fn(),
  mockMarkOnboardingComplete: vi.fn(),
  mockMarkOnboardingPending: vi.fn(),
  mockSaveOnboardingProgress: vi.fn(),
}));

vi.mock("@/lib/server/modules/onboarding/repository", () => ({
  findOnboardingRow: mockFindOnboardingRow,
  markOnboardingComplete: mockMarkOnboardingComplete,
  markOnboardingPending: mockMarkOnboardingPending,
  saveOnboardingProgress: mockSaveOnboardingProgress,
}));

import {
  OnboardingError,
  finishOnboarding,
  getOnboardingState,
  recordOnboardingStep,
  startOnboarding,
} from "@/lib/server/modules/onboarding/service";

function row(overrides: Record<string, unknown> = {}) {
  return {
    onboardingState: "pending",
    onboardingStep: 1,
    onboardingCompletedAt: null,
    timezone: null,
    defaultStorageRoot: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockMarkOnboardingComplete.mockResolvedValue(undefined);
  mockMarkOnboardingPending.mockResolvedValue(undefined);
  mockSaveOnboardingProgress.mockResolvedValue(undefined);
});

describe("getOnboardingState", () => {
  it("treats an install that predates the wizard as not applicable", async () => {
    mockFindOnboardingRow.mockResolvedValue(row({ onboardingState: null }));

    await expect(getOnboardingState()).resolves.toMatchObject({ status: "not_applicable" });
  });

  it("treats a missing settings row as not applicable", async () => {
    mockFindOnboardingRow.mockResolvedValue(null);

    await expect(getOnboardingState()).resolves.toMatchObject({ status: "not_applicable" });
  });

  it("never traps a user behind setup on an unrecognised state", async () => {
    mockFindOnboardingRow.mockResolvedValue(row({ onboardingState: "wat" }));

    await expect(getOnboardingState()).resolves.toMatchObject({ status: "not_applicable" });
  });

  it("returns the stored step and answers while pending", async () => {
    mockFindOnboardingRow.mockResolvedValue(
      row({ onboardingStep: 3, timezone: "Europe/Paris", defaultStorageRoot: "/DATA" }),
    );

    await expect(getOnboardingState()).resolves.toEqual({
      status: "pending",
      step: 3,
      timezone: "Europe/Paris",
      defaultStorageRoot: "/DATA",
      completedAt: null,
    });
  });

  it("falls back to the first step when the stored step is out of range", async () => {
    mockFindOnboardingRow.mockResolvedValue(row({ onboardingStep: 42 }));

    await expect(getOnboardingState()).resolves.toMatchObject({ step: 1 });
  });

  it("serialises the completion timestamp", async () => {
    mockFindOnboardingRow.mockResolvedValue(
      row({ onboardingState: "complete", onboardingCompletedAt: new Date("2026-08-22T10:00:00Z") }),
    );

    await expect(getOnboardingState()).resolves.toMatchObject({
      status: "complete",
      completedAt: "2026-08-22T10:00:00.000Z",
    });
  });
});

describe("startOnboarding", () => {
  it("delegates to the guarded repository write", async () => {
    await startOnboarding();

    expect(mockMarkOnboardingPending).toHaveBeenCalledTimes(1);
  });
});

describe("recordOnboardingStep", () => {
  it("rejects a step outside the wizard", async () => {
    mockFindOnboardingRow.mockResolvedValue(row());

    await expect(recordOnboardingStep({ step: 9 as never })).rejects.toMatchObject({
      code: "invalid_step",
      statusCode: 400,
    });
    expect(mockSaveOnboardingProgress).not.toHaveBeenCalled();
  });

  it("refuses to write against an install that is not mid-wizard", async () => {
    mockFindOnboardingRow.mockResolvedValue(row({ onboardingState: null }));

    await expect(recordOnboardingStep({ step: 2 })).rejects.toBeInstanceOf(OnboardingError);
    expect(mockSaveOnboardingProgress).not.toHaveBeenCalled();
  });

  it("omits fields the step did not supply so answers are not cleared", async () => {
    mockFindOnboardingRow.mockResolvedValue(row());

    await recordOnboardingStep({ step: 2 });

    expect(mockSaveOnboardingProgress).toHaveBeenCalledWith({ step: 2 });
  });

  it("trims supplied values and stores blanks as null", async () => {
    mockFindOnboardingRow.mockResolvedValue(row());

    await recordOnboardingStep({ step: 2, timezone: "  Europe/Paris  ", defaultStorageRoot: "   " });

    expect(mockSaveOnboardingProgress).toHaveBeenCalledWith({
      step: 2,
      timezone: "Europe/Paris",
      defaultStorageRoot: null,
    });
  });
});

describe("finishOnboarding", () => {
  it("completes a pending wizard", async () => {
    mockFindOnboardingRow
      .mockResolvedValueOnce(row())
      .mockResolvedValueOnce(row({ onboardingState: "complete" }));

    await expect(finishOnboarding()).resolves.toMatchObject({ status: "complete" });
    expect(mockMarkOnboardingComplete).toHaveBeenCalledTimes(1);
  });

  it("is a no-op for an install that never started the wizard", async () => {
    mockFindOnboardingRow.mockResolvedValue(row({ onboardingState: null }));

    await expect(finishOnboarding()).resolves.toMatchObject({ status: "not_applicable" });
    expect(mockMarkOnboardingComplete).not.toHaveBeenCalled();
  });

  it("is idempotent once complete", async () => {
    mockFindOnboardingRow.mockResolvedValue(row({ onboardingState: "complete" }));

    await expect(finishOnboarding()).resolves.toMatchObject({ status: "complete" });
    expect(mockMarkOnboardingComplete).not.toHaveBeenCalled();
  });
});
