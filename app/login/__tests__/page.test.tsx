/* @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/auth/login-form", () => ({
  LoginForm: () => <div>LoginFormStub</div>,
}));

vi.mock("@/modules/shell/hooks/useResolvedWallpaper", () => ({
  useResolvedWallpaper: () => ({
    wallpaper: "/images/12.jpg",
    isHydrated: true,
  }),
}));

import LoginPage from "@/app/login/page";

describe("LoginPage", () => {
  it("renders inside the shared full-screen shell", () => {
    render(<LoginPage />);

    expect(screen.getByText("LoginFormStub")).toBeTruthy();
    expect(
      (screen.getByTestId("full-screen-wallpaper") as HTMLDivElement).style
        .backgroundImage,
    ).toContain("/images/12.jpg");
    expect(screen.getByTestId("full-screen-clock")).toBeTruthy();
  });
});
