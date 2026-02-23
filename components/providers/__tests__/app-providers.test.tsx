/* @vitest-environment jsdom */

import { useQueryClient } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppProviders } from "@/components/providers/app-providers";

function Probe() {
  const queryClient = useQueryClient();
  return <div data-testid="probe">{queryClient ? "ready" : "missing"}</div>;
}

describe("AppProviders", () => {
  it("provides a QueryClient context", () => {
    render(
      <AppProviders>
        <Probe />
      </AppProviders>,
    );

    expect(screen.getByTestId("probe").textContent).toBe("ready");
  });
});
