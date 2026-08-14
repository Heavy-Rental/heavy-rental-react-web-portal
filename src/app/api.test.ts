import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rentalPlanCartApi, setAuthToken, type CreateRentalPlanRequest } from "./api";
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

  it("rejects with an Error carrying the status when the backend returns a non-2xx response", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: "already_converted", message: "Plan already converted" }, 409),
    );

    await expect(rentalPlanCartApi.cancel(55)).rejects.toThrow(/409/);
  });
});
