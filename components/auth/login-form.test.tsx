/* @vitest-environment jsdom */

import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/components/auth/login-form";

const replaceMock = vi.fn();
const refreshMock = vi.fn();
const getSearchParamMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
    refresh: refreshMock,
  }),
  useSearchParams: () => ({
    get: getSearchParamMock,
  }),
}));

describe("LoginForm", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    replaceMock.mockReset();
    refreshMock.mockReset();
    getSearchParamMock.mockReset();
    getSearchParamMock.mockImplementation((key: string) => {
      if (key === "next") return "/";
      return null;
    });
  });

  it("toggles password visibility from the eye button", () => {
    render(<LoginForm />);

    const passwordInput = screen.getByPlaceholderText("Password") as HTMLInputElement;
    expect(passwordInput.type).toBe("password");

    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(passwordInput.type).toBe("text");

    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(passwordInput.type).toBe("password");
  });

  it("shows a retry countdown on the submit button after invalid credentials", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        headers: new Headers(),
        json: async () => ({ error: "Invalid username or password" }),
      }),
    );

    render(<LoginForm />);

    fireEvent.change(screen.getByPlaceholderText("Username"), {
      target: { value: "admin" },
    });
    fireEvent.change(screen.getByPlaceholderText("Password"), {
      target: { value: "wrong-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("Invalid username or password")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: /try again in 3s/i }) as HTMLButtonElement).disabled,
    ).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(
      screen.getByRole("button", { name: /try again in [12]s/i }),
    ).toBeTruthy();

  });
});
