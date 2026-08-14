import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SiteAddressModal } from "./SiteAddressModal";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("SiteAddressModal", () => {
  it("fills postal immediately from a typed 6-digit code without fetching", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const onSave = vi.fn();
    render(
      <SiteAddressModal address="" notes="" onClose={vi.fn()} onSave={onSave} />,
    );
    await user.type(
      screen.getByPlaceholderText(/jurong port road/i),
      "20 Jurong Port Road, 619094",
    );
    expect(screen.getByDisplayValue("619094")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /save address/i }));
    expect(onSave).toHaveBeenCalledWith(
      "20 Jurong Port Road, 619094",
      "619094",
      "",
    );
  });

  it("looks up a Singapore postal code from OneMap when none is typed", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ results: [{ POSTAL: "619094" }] }),
      }),
    );
    const onSave = vi.fn();
    render(
      <SiteAddressModal
        address="20 Jurong Port Road"
        notes=""
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );
    expect(
      await screen.findByDisplayValue("619094", {}, { timeout: 2000 }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /save address/i }));
    expect(onSave).toHaveBeenCalledWith("20 Jurong Port Road", "619094", "");
  });

  it("blocks save when no postal code can be found", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ results: [] }),
      }),
    );
    render(
      <SiteAddressModal
        address="not a real street xx"
        notes=""
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    await screen.findByPlaceholderText(/no match/i, {}, { timeout: 2000 });
    await user.click(screen.getByRole("button", { name: /save address/i }));
    expect(
      screen.getByText(/couldn't find a singapore postal code/i),
    ).toBeInTheDocument();
  });
});
