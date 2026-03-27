/* @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

const mockUseTerminalCommand = vi.fn();

vi.mock("@/modules/shell/hooks/useTerminalCommand", () => ({
  useTerminalCommand: () => mockUseTerminalCommand(),
}));

import { Terminal } from "@/modules/shell/components/terminal";

describe("Terminal", () => {
  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: vi.fn(),
    });
  });

  it("keeps the input editable while command execution is pending", () => {
    mockUseTerminalCommand.mockReturnValue({
      executeCommand: vi.fn(),
      isExecuting: true,
      executeError: null,
    });

    render(<Terminal />);

    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.disabled).toBe(false);
  });

  it("hides command input in read-only mode", () => {
    mockUseTerminalCommand.mockReturnValue({
      executeCommand: vi.fn(),
      isExecuting: false,
      executeError: null,
    });

    render(<Terminal readOnly />);

    expect(screen.queryByRole("textbox")).toBeNull();
    expect(
      screen.getByText("Read-only mode. Command input is disabled."),
    ).toBeTruthy();
  });
});
