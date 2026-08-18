import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { stubEquipment } from "../../test/equipment";
import { DepositCheckout } from "./DepositCheckout";
import type { RentalPlanResponse } from "../../app/types";
import type { CartItem } from "../cart/CartContext";

const item: CartItem = {
  equipment: stubEquipment({ id: 1, baseDailyRate: 580 }),
  startDate: "2026-09-01",
  endDate: "2026-09-05",
};

const basePlan: RentalPlanResponse = {
  id: 42,
  startDate: item.startDate,
  endDate: item.endDate,
  siteAddress: "1 Jurong Port Road, 619096",
  status: "QUOTED",
  totalAmount: 2900,
  items: [
    { id: 1, assetId: 1, assetName: item.equipment.name, dailyRate: 580, subtotal: 2900 },
  ],
  updatedAt: "2026-08-15T09:00:00",
  createdAt: "2026-08-15T08:00:00",
};

const noop = vi.fn();
const onBeginPayment = vi.fn().mockResolvedValue(null);
const onPaid = vi.fn().mockResolvedValue(undefined);

describe("DepositCheckout — dynamic pricing", () => {
  beforeEach(() => {
    vi.stubEnv("MODE", "api");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not call onGetQuote or render pricing UI outside API mode", () => {
    vi.stubEnv("MODE", "mock");
    const onGetQuote = vi.fn().mockResolvedValue(basePlan);
    render(
      <DepositCheckout
        cart={[item]}
        userName="Alex Tan"
        paymentIntentId="pi_test"
        onClose={noop}
        onBeginPayment={onBeginPayment}
        onGetQuote={onGetQuote}
        onPaid={onPaid}
      />,
    );
    expect(onGetQuote).not.toHaveBeenCalled();
    expect(screen.queryByText(/checking live pricing/i)).not.toBeInTheDocument();
  });

  it("shows a loading indicator while the quote is in flight, then hides it", async () => {
    let resolveQuote!: (v: RentalPlanResponse) => void;
    const onGetQuote = vi.fn(
      () => new Promise<RentalPlanResponse>((resolve) => (resolveQuote = resolve)),
    );
    render(
      <DepositCheckout
        cart={[item]}
        userName="Alex Tan"
        paymentIntentId="pi_test"
        onClose={noop}
        onBeginPayment={onBeginPayment}
        onGetQuote={onGetQuote}
        onPaid={onPaid}
      />,
    );
    expect(onGetQuote).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/checking live pricing/i)).toBeInTheDocument();

    resolveQuote(basePlan);
    await waitFor(() =>
      expect(screen.queryByText(/checking live pricing/i)).not.toBeInTheDocument(),
    );
  });

  it("shows a Smart Priced badge when the quoted dailyRate differs from the cart's base rate", async () => {
    const onGetQuote = vi.fn().mockResolvedValue({
      ...basePlan,
      items: [{ ...basePlan.items[0], dailyRate: 640, subtotal: 3200 }],
    });
    render(
      <DepositCheckout
        cart={[item]}
        userName="Alex Tan"
        paymentIntentId="pi_test"
        onClose={noop}
        onBeginPayment={onBeginPayment}
        onGetQuote={onGetQuote}
        onPaid={onPaid}
      />,
    );
    expect(await screen.findByText(/smart priced/i)).toBeInTheDocument();
  });

  it("switches the Subtotal/item price to the quoted amount once resolved, not the client-side estimate", async () => {
    const onGetQuote = vi.fn().mockResolvedValue({
      ...basePlan,
      totalAmount: 3200,
      items: [{ ...basePlan.items[0], dailyRate: 640, subtotal: 3200 }],
    });
    render(
      <DepositCheckout
        cart={[item]}
        userName="Alex Tan"
        paymentIntentId="pi_test"
        onClose={noop}
        onBeginPayment={onBeginPayment}
        onGetQuote={onGetQuote}
        onPaid={onPaid}
      />,
    );
    expect(screen.getAllByText("S$2,900").length).toBeGreaterThanOrEqual(2); // client estimate shown while loading
    await waitFor(() =>
      expect(screen.queryByText(/checking live pricing/i)).not.toBeInTheDocument(),
    );
    expect(screen.queryByText("S$2,900")).not.toBeInTheDocument();
    // Item line (5 days × S$640) and Subtotal both read off the quote now.
    expect(screen.getAllByText("S$3,200").length).toBeGreaterThanOrEqual(2);
  });

  it("derives Subtotal from the line items even when quote.totalAmount disagrees with them", async () => {
    // Regression test: seen live, quote.totalAmount came back equal to a single item's
    // dailyRate (640) instead of dailyRate × days (3200) — Subtotal must not trust that
    // field directly, or it desyncs from the "Reserved Equipment" line item shown above it.
    const onGetQuote = vi.fn().mockResolvedValue({
      ...basePlan,
      totalAmount: 640, // deliberately wrong — should be 5 × 640 = 3200
      items: [{ ...basePlan.items[0], dailyRate: 640, subtotal: 3200 }],
    });
    render(
      <DepositCheckout
        cart={[item]}
        userName="Alex Tan"
        paymentIntentId="pi_test"
        onClose={noop}
        onBeginPayment={onBeginPayment}
        onGetQuote={onGetQuote}
        onPaid={onPaid}
      />,
    );
    await waitFor(() =>
      expect(screen.queryByText(/checking live pricing/i)).not.toBeInTheDocument(),
    );
    // Both the line item and Subtotal must read 3200 (days × quoted dailyRate) — never the
    // bogus 640 totalAmount — and GST/Total Payable must be computed off that same figure.
    expect(screen.getAllByText("S$3,200").length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText("S$640")).not.toBeInTheDocument();
    expect(screen.getByText("S$288")).toBeInTheDocument(); // GST: round(3200 × 0.09)
    expect(screen.getByText("S$3,488")).toBeInTheDocument(); // Total Payable: round(3200 × 1.09)
  });

  it("shows no badge when the quoted dailyRate equals the cart's base rate (base price or fallback)", async () => {
    const onGetQuote = vi.fn().mockResolvedValue(basePlan); // dailyRate 580 === baseDailyRate
    render(
      <DepositCheckout
        cart={[item]}
        userName="Alex Tan"
        paymentIntentId="pi_test"
        onClose={noop}
        onBeginPayment={onBeginPayment}
        onGetQuote={onGetQuote}
        onPaid={onPaid}
      />,
    );
    await waitFor(() => expect(onGetQuote).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.queryByText(/checking live pricing/i)).not.toBeInTheDocument(),
    );
    expect(screen.queryByText(/smart priced/i)).not.toBeInTheDocument();
  });

  it("does not block Continue to Payment while the quote is still loading", () => {
    const onGetQuote = vi.fn(() => new Promise<RentalPlanResponse>(() => {}));
    render(
      <DepositCheckout
        cart={[item]}
        userName="Alex Tan"
        paymentIntentId="pi_test"
        onClose={noop}
        onBeginPayment={onBeginPayment}
        onGetQuote={onGetQuote}
        onPaid={onPaid}
      />,
    );
    expect(screen.getByRole("button", { name: /continue to payment/i })).toBeEnabled();
  });
});
