import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuthLoadingOverlay } from "./AuthLoadingOverlay";

describe("AuthLoadingOverlay", () => {
  it("does not expose a progressbar when closed", () => {
    render(<AuthLoadingOverlay open={false} />);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("shows a centered Material 3 progressbar when open", () => {
    render(<AuthLoadingOverlay open />);
    expect(screen.getByRole("progressbar", { name: /signing in/i })).toBeInTheDocument();
  });
});
