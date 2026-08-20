import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach, afterEach, type Mock } from "vitest";
import { stubEquipment } from "../../test/equipment";
import { DepositCheckout, type ApiDepositPayment } from "./DepositCheckout";
import { QuoteStaleError } from "./quoteStaleness";
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

describe("DepositCheckout — booking conversion retry", () => {
  beforeEach(() => {
    vi.stubEnv("MODE", "api");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const refreshedPlan: RentalPlanResponse = {
    ...basePlan,
    totalAmount: 2500,
    items: [{ ...basePlan.items[0], dailyRate: 500, subtotal: 2500 }],
    updatedAt: "2026-08-16T09:00:00",
  };

  const renderDeposit = (
    localOnBeginPayment: Mock<() => Promise<ApiDepositPayment>>,
  ) =>
    render(
      <DepositCheckout
        cart={[item]}
        userName="Alex Tan"
        paymentIntentId="pi_test"
        onClose={noop}
        onBeginPayment={localOnBeginPayment}
        onPaid={onPaid}
      />,
    );

  it("happy path: converts on the first attempt with no price-changed step", async () => {
    const localOnBeginPayment = vi.fn().mockResolvedValue({
      bookingId: 1,
      clientSecret: "secret",
      paymentIntentId: "pi_1",
      amountDue: 870,
      paymentOption: "DEPOSIT",
    });
    renderDeposit(localOnBeginPayment);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /continue to payment/i }));

    expect(await screen.findByText(/step 2 of 2/i)).toBeInTheDocument();
    expect(localOnBeginPayment).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/price updated/i)).not.toBeInTheDocument();
  });

  it("quote_expired: shows a price-changed step, then retries and succeeds on confirm", async () => {
    const localOnBeginPayment = vi
      .fn()
      .mockRejectedValueOnce(new QuoteStaleError(refreshedPlan, "quote_expired"))
      .mockResolvedValueOnce({
        bookingId: 2,
        clientSecret: "secret",
        paymentIntentId: "pi_2",
        amountDue: 750,
        paymentOption: "DEPOSIT",
      });
    renderDeposit(localOnBeginPayment);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /continue to payment/i }));

    expect(
      await screen.findByRole("heading", { level: 3, name: /price updated/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/your quote has expired/i)).toBeInTheDocument();
    expect(screen.getByText("Subtotal S$2,900")).toBeInTheDocument(); // previous
    expect(screen.getByText("Subtotal S$2,500")).toBeInTheDocument(); // updated

    await user.click(
      screen.getByRole("button", { name: /confirm new price & continue/i }),
    );

    expect(await screen.findByText(/step 2 of 2/i)).toBeInTheDocument();
    expect(localOnBeginPayment).toHaveBeenCalledTimes(2);
    expect(screen.getByText("S$750")).toBeInTheDocument(); // server-confirmed deposit
  });

  it("quote_not_ready: shows the not-ready-specific copy", async () => {
    const localOnBeginPayment = vi
      .fn()
      .mockRejectedValueOnce(new QuoteStaleError(refreshedPlan, "quote_not_ready"));
    renderDeposit(localOnBeginPayment);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /continue to payment/i }));

    expect(
      await screen.findByRole("heading", { level: 3, name: /price updated/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/confirm current pricing for your rental plan/i),
    ).toBeInTheDocument();
  });

  it("declining the updated price returns to the summary step, unchanged", async () => {
    const localOnBeginPayment = vi
      .fn()
      .mockRejectedValueOnce(new QuoteStaleError(refreshedPlan, "quote_expired"));
    renderDeposit(localOnBeginPayment);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /continue to payment/i }));
    expect(
      await screen.findByRole("heading", { level: 3, name: /price updated/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /back to summary/i }));

    expect(await screen.findByText(/step 1 of 2/i)).toBeInTheDocument();
    expect(screen.getByText("S$870")).toBeInTheDocument(); // original deposit, unchanged
    expect(localOnBeginPayment).toHaveBeenCalledTimes(1);
  });

  it("a generic rejection (e.g. conflict) still surfaces via the existing error message, not a price-changed step", async () => {
    const localOnBeginPayment = vi
      .fn()
      .mockRejectedValueOnce(new Error("Too many requests, please try again."));
    renderDeposit(localOnBeginPayment);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /continue to payment/i }));

    expect(
      await screen.findByText(/too many requests, please try again/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/price updated/i)).not.toBeInTheDocument();
  });
});

describe("DepositCheckout — pay in full option (HR-213)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to Deposit and updates the summary breakdown when Pay in Full is selected", async () => {
    vi.stubEnv("MODE", "mock");
    render(
      <DepositCheckout
        cart={[item]}
        userName="Alex Tan"
        paymentIntentId="pi_test"
        onClose={noop}
        onBeginPayment={onBeginPayment}
        onPaid={onPaid}
      />,
    );
    // Deposit (30% of S$2,900) is selected by default.
    expect(screen.getByRole("button", { name: /deposit \(30%\)/i })).toHaveClass(
      "bg-primary",
    );
    expect(screen.getByText("S$870")).toBeInTheDocument();
    expect(screen.getByText(/deposit due now/i)).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /pay in full/i }));

    // Full is 100% of the S$2,900 pre-GST subtotal (matching Booking.totalAmount — GST
    // is display-only, never actually charged), with S$0 balance — "S$2,900" now appears
    // three times (equipment line item + Subtotal row + Amount Due Now, all equal).
    // Total Payable (S$3,161, GST-inclusive) stays purely informational and unaffected
    // by the toggle.
    expect(screen.getByText(/amount due now/i)).toBeInTheDocument();
    expect(screen.getAllByText("S$2,900").length).toBe(3);
    expect(screen.getByText("S$3,161")).toBeInTheDocument();
    expect(screen.getByText("S$0")).toBeInTheDocument();
  });

  it("threads the selected payment option through to the mock-mode payment step", async () => {
    vi.stubEnv("MODE", "mock");
    render(
      <DepositCheckout
        cart={[item]}
        userName="Alex Tan"
        paymentIntentId="pi_test"
        onClose={noop}
        onBeginPayment={onBeginPayment}
        onPaid={onPaid}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /pay in full/i }));
    await user.click(screen.getByRole("button", { name: /continue to payment/i }));

    expect(await screen.findByText(/step 2 of 2/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /pay s\$2,900 in full/i }),
    ).toBeInTheDocument();
  });

  it("passes the chosen paymentOption to onBeginPayment in API mode", async () => {
    vi.stubEnv("MODE", "api");
    const localOnBeginPayment = vi.fn().mockResolvedValue({
      bookingId: 3,
      clientSecret: "secret",
      paymentIntentId: "pi_3",
      amountDue: 2900,
      paymentOption: "FULL",
    });
    render(
      <DepositCheckout
        cart={[item]}
        userName="Alex Tan"
        paymentIntentId="pi_test"
        onClose={noop}
        onBeginPayment={localOnBeginPayment}
        onPaid={onPaid}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /pay in full/i }));
    await user.click(screen.getByRole("button", { name: /continue to payment/i }));

    expect(await screen.findByText(/step 2 of 2/i)).toBeInTheDocument();
    expect(localOnBeginPayment).toHaveBeenCalledWith("FULL");
    // Toggle locks once the real booking + intent exist for this option — switching back
    // to Deposit here couldn't produce a matching PaymentIntent without a fresh call.
    await user.click(screen.getByRole("button", { name: /back/i }));
    expect(screen.getByRole("button", { name: /deposit \(30%\)/i })).toBeDisabled();
  });
});
