/* @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

const mockUseTerminalCommand = vi.fn();

vi.mock("@/hooks/useTerminalCommand", () => ({
  useTerminalCommand: () => mockUseTerminalCommand(),
}));

import { Terminal } from "@/components/desktop/terminal";

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
});
