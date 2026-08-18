import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ApiError,
  postalCodeApi,
  rentalPlanCartApi,
  setAuthToken,
  type CreateRentalPlanRequest,
} from "./api";
import type { RentalPlanResponse } from "./types";

const samplePlan: RentalPlanResponse = {
  id: 55,
  startDate: "2026-09-01",
  endDate: "2026-09-05",
  siteAddress: "20 Jurong Port Road, 619094",
  status: "QUOTED",
  totalAmount: 2250,
  items: [{ id: 101, assetId: 4, assetName: "CAT 320 Excavator", dailyRate: 450, subtotal: 2250 }],
  updatedAt: "2026-08-13T10:30:00",
  createdAt: "2026-08-13T09:15:00",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("rentalPlanCartApi", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setAuthToken(null);
  });

  it("list() GETs /api/rentalPlans and returns the parsed array", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([samplePlan]));

    const result = await rentalPlanCartApi.list();

    expect(result).toEqual([samplePlan]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/rentalPlans");
    expect(init?.method ?? "GET").toBe("GET");
  });

  it("create() POSTs the plan body to /api/rentalPlans", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(samplePlan));
    const body: CreateRentalPlanRequest = {
      startDate: "2026-09-01",
      endDate: "2026-09-05",
      siteAddress: "20 Jurong Port Road, 619094",
    };

    const result = await rentalPlanCartApi.create(body);

    expect(result).toEqual(samplePlan);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/rentalPlans");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual(body);
  });

  it("create() omits siteAddress entirely when not given ('Skip for now')", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...samplePlan, siteAddress: null }));
    const body: CreateRentalPlanRequest = {
      startDate: "2026-09-01",
      endDate: "2026-09-05",
    };

    const result = await rentalPlanCartApi.create(body);

    expect(result.siteAddress).toBeNull();
    const [, init] = fetchMock.mock.calls[0];
    const sentBody = JSON.parse(init?.body as string);
    expect(sentBody).toEqual({ startDate: "2026-09-01", endDate: "2026-09-05" });
    expect(sentBody).not.toHaveProperty("siteAddress");
  });

  it("addItem() POSTs { assetId } to /api/rentalPlans/{id}/items", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(samplePlan));

    const result = await rentalPlanCartApi.addItem(55, 4);

    expect(result).toEqual(samplePlan);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/rentalPlans/55/items");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({ assetId: 4 });
  });

  it("removeItem() DELETEs /api/rentalPlans/{id}/items/{itemId} with no body", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...samplePlan, items: [] }));

    const result = await rentalPlanCartApi.removeItem(55, 101);

    expect(result.items).toEqual([]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/rentalPlans/55/items/101");
    expect(init?.method).toBe("DELETE");
    expect(init?.body).toBeUndefined();
  });

  it("cancel() POSTs to /api/rentalPlans/{id}/cancel with no body", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ ...samplePlan, status: "CANCELLED", totalAmount: null }),
    );

    const result = await rentalPlanCartApi.cancel(55);

    expect(result.status).toBe("CANCELLED");
    expect(result.totalAmount).toBeNull();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/rentalPlans/55/cancel");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBeUndefined();
  });

  it("updateSiteAddress() PATCHes { siteAddress } to /api/rentalPlans/{id}", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ ...samplePlan, siteAddress: "20 Jurong Port Road, 619094" }),
    );

    const result = await rentalPlanCartApi.updateSiteAddress(
      55,
      "20 Jurong Port Road, 619094",
    );

    expect(result.siteAddress).toBe("20 Jurong Port Road, 619094");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/rentalPlans/55");
    expect(init?.method).toBe("PATCH");
    expect(JSON.parse(init?.body as string)).toEqual({
      siteAddress: "20 Jurong Port Road, 619094",
    });
  });

  it("updateSiteAddress() passes through a QUOTED→DRAFT revert as-is, unmodified", async () => {
    // Per the backend contract, PATCHing siteAddress on a QUOTED plan silently reverts it —
    // this API-client layer just needs to hand back exactly what the backend sent, with no
    // special-casing; reacting to the revert is the caller's job, not this layer's.
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        ...samplePlan,
        siteAddress: "1 Pioneer Road, 628401",
        status: "DRAFT",
        totalAmount: null,
      }),
    );

    const result = await rentalPlanCartApi.updateSiteAddress(55, "1 Pioneer Road, 628401");

    expect(result.status).toBe("DRAFT");
    expect(result.totalAmount).toBeNull();
    expect(result.siteAddress).toBe("1 Pioneer Road, 628401");
  });

  it("attaches the Authorization header once a token is set, and omits it otherwise", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([samplePlan]));
    await rentalPlanCartApi.list();
    let headers = fetchMock.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();

    setAuthToken("test-token");
    fetchMock.mockResolvedValueOnce(jsonResponse([samplePlan]));
    await rentalPlanCartApi.list();
    headers = fetchMock.mock.calls[1][1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-token");
  });

  it("rejects with a typed ApiError carrying the backend's error code and message", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: "already_converted", message: "Plan already converted" }, 409),
    );

    await expect(rentalPlanCartApi.cancel(55)).rejects.toMatchObject(
      new ApiError("already_converted", "Plan already converted"),
    );
  });
});

describe("postalCodeApi", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    setAuthToken("test-token");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setAuthToken(null);
  });

  it("lookup() GETs /api/postalCodes/{postalCode} with the Authorization header, returning VALID", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        status: "VALID",
        postalCode: "619094",
        address: "20 JURONG PORT ROAD SINGAPORE 619094",
      }),
    );

    const result = await postalCodeApi.lookup("619094");

    expect(result).toEqual({
      status: "VALID",
      postalCode: "619094",
      address: "20 JURONG PORT ROAD SINGAPORE 619094",
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/postalCodes/619094");
    expect(init?.method ?? "GET").toBe("GET");
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-token");
  });

  it("resolves (not rejects) with status: INVALID for a well-formed but nonexistent code", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        status: "INVALID",
        postalCode: "999999",
        message: "No address found for this postal code",
      }),
    );

    const result = await postalCodeApi.lookup("999999");

    expect(result.status).toBe("INVALID");
    expect(result.message).toBe("No address found for this postal code");
  });

  it("rejects with a typed ApiError for a malformed (non-6-digit) postal code", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: "bad_request", message: "Postal code must be exactly 6 digits" }, 400),
    );

    await expect(postalCodeApi.lookup("12345")).rejects.toMatchObject(
      new ApiError("bad_request", "Postal code must be exactly 6 digits"),
    );
  });
});
