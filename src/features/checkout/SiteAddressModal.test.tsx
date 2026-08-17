import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SiteAddressModal } from "./SiteAddressModal";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Routes the global fetch mock by URL — API mode calls both the unauthenticated
// OneMap search (absolute onemap.gov.sg URL) and the authenticated
// /api/postalCodes/{code} validation endpoint, so a single blanket mock can't
// serve both. Rejects anything unexpected instead of silently no-op-ing so a
// stray call fails loudly.
function postalCodesFetch(handler: (postalCode: string) => Response) {
  return vi.fn((url: string) => {
    if (typeof url === "string" && url.startsWith("/api/postalCodes/")) {
      return Promise.resolve(handler(url.split("/").pop() ?? ""));
    }
    return Promise.reject(new Error(`unexpected fetch in test: ${url}`));
  });
}

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
    // Button reads "Confirm Address" (not "Save Address") since this modal opened with
    // an existing address already passed in.
    await user.click(screen.getByRole("button", { name: /confirm address/i }));
    expect(onSave).toHaveBeenCalledWith("20 Jurong Port Road", "619094", "");
  });

  it("allows save with just a plain address when no postal code can be found", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ results: [] }),
      }),
    );
    const onSave = vi.fn();
    render(
      <SiteAddressModal
        address="not a real street xx"
        notes=""
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );
    // Button reads "Confirm Address" (not "Save Address") since this modal opened with
    // an existing address already passed in.
    await user.click(screen.getByRole("button", { name: /confirm address/i }));
    expect(onSave).toHaveBeenCalledWith("not a real street xx", "", "");
  });

  it("still requires a non-blank address", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <SiteAddressModal address="" notes="" onClose={vi.fn()} onSave={onSave} />,
    );
    await user.click(screen.getByRole("button", { name: /save address/i }));
    expect(screen.getByText(/site address is required/i)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('labels the button "Save Address" with no prior address, "Confirm Address" when one already exists', () => {
    const { unmount } = render(
      <SiteAddressModal address="" notes="" onClose={vi.fn()} onSave={vi.fn()} />,
    );
    expect(
      screen.getByRole("button", { name: /^save address$/i }),
    ).toBeInTheDocument();
    unmount();

    render(
      <SiteAddressModal
        address="20 Jurong Port Road, 619094"
        notes=""
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: /^confirm address$/i }),
    ).toBeInTheDocument();
  });
});

describe("SiteAddressModal — API mode postal-code validation", () => {
  beforeEach(() => {
    vi.stubEnv("MODE", "api");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("blocks Save and shows the backend's message when the postal code resolves INVALID", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      postalCodesFetch((code) =>
        jsonResponse({
          status: "INVALID",
          postalCode: code,
          message: "No address found for this postal code",
        }),
      ),
    );
    const onSave = vi.fn();
    render(
      <SiteAddressModal address="" notes="" onClose={vi.fn()} onSave={onSave} />,
    );
    await user.type(
      screen.getByPlaceholderText(/jurong port road/i),
      "20 Jurong Port Road, 619094",
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /save address/i })).not.toBeDisabled(),
    );
    await user.click(screen.getByRole("button", { name: /save address/i }));
    expect(
      screen.getByText(/no address found for this postal code/i),
    ).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("allows Save once the postal code resolves VALID", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      postalCodesFetch((code) =>
        jsonResponse({
          status: "VALID",
          postalCode: code,
          address: "20 JURONG PORT ROAD SINGAPORE 619094",
        }),
      ),
    );
    const onSave = vi.fn();
    render(
      <SiteAddressModal address="" notes="" onClose={vi.fn()} onSave={onSave} />,
    );
    await user.type(
      screen.getByPlaceholderText(/jurong port road/i),
      "20 Jurong Port Road, 619094",
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /save address/i })).not.toBeDisabled(),
    );
    await user.click(screen.getByRole("button", { name: /save address/i }));
    expect(onSave).toHaveBeenCalledWith(
      "20 Jurong Port Road, 619094",
      "619094",
      "",
    );
  });

  it("does not block Save when the validation call fails (soft-fail on unavailable)", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      postalCodesFetch(() =>
        jsonResponse(
          {
            status: "UNAVAILABLE",
            postalCode: "619094",
            message: "Postal code lookup is temporarily unavailable — you may continue",
          },
          503,
        ),
      ),
    );
    const onSave = vi.fn();
    render(
      <SiteAddressModal address="" notes="" onClose={vi.fn()} onSave={onSave} />,
    );
    await user.type(
      screen.getByPlaceholderText(/jurong port road/i),
      "20 Jurong Port Road, 619094",
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /save address/i })).not.toBeDisabled(),
    );
    await user.click(screen.getByRole("button", { name: /save address/i }));
    expect(onSave).toHaveBeenCalledWith(
      "20 Jurong Port Road, 619094",
      "619094",
      "",
    );
  });

  it("blocks Save when no postal code could be derived at all", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (typeof url === "string" && url.startsWith("/api/postalCodes/")) {
          return Promise.reject(
            new Error("should not validate a postal code that was never derived"),
          );
        }
        return Promise.resolve({ ok: true, json: async () => ({ results: [] }) });
      }),
    );
    const onSave = vi.fn();
    render(
      <SiteAddressModal
        address="not a real street xx"
        notes=""
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );
    // Button reads "Confirm Address" (not "Save Address") since this modal opened with
    // an existing address already passed in.
    await user.click(screen.getByRole("button", { name: /confirm address/i }));
    expect(
      screen.getByText(/couldn't find a singapore postal code for this address/i),
    ).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });
});
