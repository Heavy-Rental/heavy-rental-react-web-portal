import { describe, it, expect } from "vitest";
import { isQuoteStaleCode, QuoteStaleError } from "./quoteStaleness";
import type { RentalPlanResponse } from "../../app/types";

describe("isQuoteStaleCode", () => {
  it("returns true for quote_not_ready", () => {
    expect(isQuoteStaleCode("quote_not_ready")).toBe(true);
  });

  it("returns true for quote_expired", () => {
    expect(isQuoteStaleCode("quote_expired")).toBe(true);
  });

  it("returns false for conflict", () => {
    expect(isQuoteStaleCode("conflict")).toBe(false);
  });

  it("returns false for already_converted", () => {
    expect(isQuoteStaleCode("already_converted")).toBe(false);
  });

  it("returns false for an arbitrary code", () => {
    expect(isQuoteStaleCode("something_else")).toBe(false);
  });
});

describe("QuoteStaleError", () => {
  const plan: RentalPlanResponse = {
    id: 1,
    startDate: "2026-09-01",
    endDate: "2026-09-05",
    siteAddress: null,
    status: "QUOTED",
    totalAmount: 1000,
    items: [],
    updatedAt: "2026-08-20T00:00:00",
    createdAt: "2026-08-19T00:00:00",
  };

  it("carries the refreshed quote and reason through unchanged", () => {
    const err = new QuoteStaleError(plan, "quote_expired");
    expect(err.refreshedQuote).toBe(plan);
    expect(err.reason).toBe("quote_expired");
    expect(err.name).toBe("QuoteStaleError");
  });

  it("uses expiry-specific copy for quote_expired", () => {
    const err = new QuoteStaleError(plan, "quote_expired");
    expect(err.message).toMatch(/expired/i);
  });

  it("uses not-ready-specific copy for quote_not_ready", () => {
    const err = new QuoteStaleError(plan, "quote_not_ready");
    expect(err.message).toMatch(/confirm current pricing/i);
  });
});
