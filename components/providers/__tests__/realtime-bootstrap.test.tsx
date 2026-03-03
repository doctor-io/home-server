/* @vitest-environment jsdom */

import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useSystemSse", () => ({
  useSystemSse: vi.fn(),
}));

import { RealtimeBootstrap } from "@/components/providers/realtime-bootstrap";
import { useSystemSse } from "@/hooks/useSystemSse";

describe("RealtimeBootstrap", () => {
  it("enables SSE subscription", () => {
    render(<RealtimeBootstrap />);

    expect(useSystemSse).toHaveBeenCalledWith(true);
  });
});
