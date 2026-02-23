/* @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LockScreen } from "@/components/desktop/lock-screen";

describe("LockScreen", () => {
  it("shows only unlock UI and submits password", async () => {
    const onUnlock = vi.fn(async () => undefined);
    const onLogout = vi.fn(async () => undefined);

    render(
      <LockScreen username="admin" onUnlock={onUnlock} onLogout={onLogout} />,
    );

    expect(screen.queryByText("Sign up")).toBeNull();
    expect(screen.queryByText("Login")).toBeNull();

    fireEvent.change(screen.getByPlaceholderText("Enter your password"), {
      target: { value: "StrongPass123" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));

    await waitFor(() => {
      expect(onUnlock).toHaveBeenCalledWith("StrongPass123");
    });
  });

  it("shows unlock error message", async () => {
    const onUnlock = vi.fn(async () => {
      throw new Error("Invalid password");
    });

    render(
      <LockScreen
        username="admin"
        onUnlock={onUnlock}
        onLogout={vi.fn(async () => undefined)}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Enter your password"), {
      target: { value: "bad-pass" },
    });

    fireEvent.submit(screen.getByRole("button", { name: "Unlock" }));

    expect(await screen.findByText("Invalid password")).toBeTruthy();
  });
});
