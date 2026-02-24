import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/modules/auth/repository", () => ({
  hasAnyUsers: vi.fn(),
}));

vi.mock("@/lib/server/modules/auth/service", () => {
  class AuthError extends Error {
    constructor(
      message: string,
      public readonly statusCode: number,
    ) {
      super(message);
    }
  }

  return {
    AuthError,
    registerUser: vi.fn(),
  };
});

vi.mock("@/lib/server/storage/data-root", () => ({
  ensureDataRootDirectories: vi.fn(),
  resolveDataRootDirectory: vi.fn(() => "/DATA"),
}));

import { POST } from "@/app/api/auth/register/route";
import { hasAnyUsers } from "@/lib/server/modules/auth/repository";
import { registerUser } from "@/lib/server/modules/auth/service";
import { ensureDataRootDirectories } from "@/lib/server/storage/data-root";

describe("POST /api/auth/register", () => {
  it("returns 403 when registration is disabled", async () => {
    vi.mocked(hasAnyUsers).mockResolvedValueOnce(true);

    const request = new Request("http://localhost/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        username: "admin",
        password: "StrongPass123",
        confirmPassword: "StrongPass123",
      }),
    });

    const response = await POST(request);
    const json = (await response.json()) as { error: string };

    expect(response.status).toBe(403);
    expect(json.error).toContain("disabled");
    expect(registerUser).not.toHaveBeenCalled();
    expect(ensureDataRootDirectories).not.toHaveBeenCalled();
  });

  it("allows first registration when no users exist", async () => {
    vi.mocked(hasAnyUsers).mockResolvedValueOnce(false);
    vi.mocked(registerUser).mockResolvedValueOnce({
      id: "u1",
      username: "admin",
    });

    const request = new Request("http://localhost/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        username: "admin",
        password: "StrongPass123",
        confirmPassword: "StrongPass123",
      }),
    });

    const response = await POST(request);
    const json = (await response.json()) as {
      data: { username: string };
    };

    expect(response.status).toBe(201);
    expect(json.data.username).toBe("admin");
    expect(ensureDataRootDirectories).toHaveBeenCalledTimes(1);
  });
});
