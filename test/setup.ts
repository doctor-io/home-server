import { afterEach, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/server/modules/auth/api", async () => {
  const { NextResponse } = await import("next/server");

  return {
    requireApiSession: vi.fn(async () => ({
      session: {
        sessionId: "test-session",
        userId: "test-user",
        username: "admin",
        passwordHash: "test-password-hash",
        expiresAt: new Date(Date.now() + 3600_000),
      },
      response: null,
    })),
    unauthorizedApiResponse: () =>
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
  };
});

// next-themes calls window.matchMedia on mount; JSDOM doesn't implement it.
if (typeof window !== "undefined" && !window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

if (typeof globalThis !== "undefined" && !("EventSource" in globalThis)) {
  class EventSourceMock {
    addEventListener() {}
    removeEventListener() {}
    close() {}
  }

  Object.defineProperty(globalThis, "EventSource", {
    configurable: true,
    writable: true,
    value: EventSourceMock,
  });
}

if (typeof globalThis !== "undefined" && !globalThis.localStorage) {
  const store = new Map<string, string>();
  const localStorageMock = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: localStorageMock,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});
