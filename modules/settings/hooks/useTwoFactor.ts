"use client";

import type {
  TwoFactorDisableRequest,
  TwoFactorDisableResponse,
  TwoFactorErrorCode,
  TwoFactorSetupResponse,
  TwoFactorVerifyRequest,
  TwoFactorVerifyResponse,
} from "@/lib/shared/contracts/auth";
import { queryKeys } from "@/lib/shared/query-keys";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export class TwoFactorApiError extends Error {
  readonly code: TwoFactorErrorCode | "unknown";
  readonly status: number;

  constructor(
    message: string,
    status: number,
    code: TwoFactorErrorCode | "unknown",
  ) {
    super(message);
    this.name = "TwoFactorApiError";
    this.status = status;
    this.code = code;
  }
}

type ApiEnvelope<T> = { data?: T; error?: string; code?: string };

async function postJson<TBody, TResponse>(
  endpoint: string,
  body?: TBody,
): Promise<TResponse> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  const payload = (await response
    .json()
    .catch(() => ({}))) as ApiEnvelope<TResponse>;

  if (!response.ok) {
    throw new TwoFactorApiError(
      payload.error ?? `Request failed (${response.status})`,
      response.status,
      (payload.code as TwoFactorErrorCode) ?? "unknown",
    );
  }

  if (!payload.data) {
    throw new TwoFactorApiError(
      "Malformed response from server",
      response.status,
      "unknown",
    );
  }

  return payload.data;
}

export function useStartTwoFactorSetup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      postJson<undefined, TwoFactorSetupResponse>("/api/v1/auth/2fa/setup"),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.currentUser });
    },
  });
}

export function useVerifyTwoFactor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: TwoFactorVerifyRequest) =>
      postJson<TwoFactorVerifyRequest, TwoFactorVerifyResponse>(
        "/api/v1/auth/2fa/verify",
        input,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.currentUser });
    },
  });
}

export function useDisableTwoFactor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: TwoFactorDisableRequest) =>
      postJson<TwoFactorDisableRequest, TwoFactorDisableResponse>(
        "/api/v1/auth/2fa/disable",
        input,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.currentUser });
    },
  });
}
