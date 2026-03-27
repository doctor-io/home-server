/* @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/auth/register-form", () => ({
  RegisterForm: () => <div>RegisterFormStub</div>,
}));

vi.mock("@/modules/shell/hooks/useResolvedWallpaper", () => ({
  useResolvedWallpaper: () => ({
    wallpaper: "/images/14.jpg",
    isHydrated: true,
  }),
}));

import RegisterPage from "@/app/register/page";

describe("RegisterPage", () => {
  it("renders inside the shared full-screen shell", () => {
    render(<RegisterPage />);

    expect(screen.getByText("RegisterFormStub")).toBeTruthy();
    expect(
      (screen.getByTestId("full-screen-wallpaper") as HTMLDivElement).style
        .backgroundImage,
    ).toContain("/images/14.jpg");
    expect(screen.getByTestId("full-screen-clock")).toBeTruthy();
  });
});
