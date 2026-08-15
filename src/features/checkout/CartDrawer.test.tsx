import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { stubEquipment } from "../../test/equipment";
import { CartDrawer } from "./CartDrawer";
import type { CartItem } from "../cart/CartContext";

const item: CartItem = {
  equipment: stubEquipment(),
  startDate: "2026-09-01",
  endDate: "2026-09-21",
};

const noop = vi.fn();

describe("CartDrawer", () => {
  it("shows an empty plan and no Proceed button when the cart is empty", () => {
    render(
      <CartDrawer
        cart={[]}
        onRemoveItem={noop}
        siteAddress=""
        onEditAddress={noop}
        totalCost={0}
        onCheckout={noop}
        onClose={noop}
      />,
    );
    expect(screen.getByText("No equipment selected yet.")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /proceed to deposit/i }),
    ).not.toBeInTheDocument();
  });

  it("offers a Cancel rental plan recovery link when the cart is empty but a plan still exists", () => {
    render(
      <CartDrawer
        cart={[]}
        onRemoveItem={noop}
        siteAddress=""
        onEditAddress={noop}
        totalCost={0}
        onCancelPlan={noop}
        onCheckout={noop}
        onClose={noop}
      />,
    );
    expect(screen.getByText("No equipment selected yet.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /cancel rental plan/i }),
    ).toBeInTheDocument();
  });

  it("shows no Cancel rental plan link when the cart is empty and no plan exists (e.g. mock mode)", () => {
    render(
      <CartDrawer
        cart={[]}
        onRemoveItem={noop}
        siteAddress=""
        onEditAddress={noop}
        totalCost={0}
        onCheckout={noop}
        onClose={noop}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /cancel rental plan/i }),
    ).not.toBeInTheDocument();
  });

  it("disables Proceed and highlights Add when items exist without an address", () => {
    render(
      <CartDrawer
        cart={[item]}
        onRemoveItem={noop}
        siteAddress=""
        onEditAddress={noop}
        highlightAddAddress
        totalCost={12180}
        onCheckout={noop}
        onClose={noop}
      />,
    );
    expect(screen.getByRole("button", { name: /proceed to deposit/i })).toBeDisabled();
    const add = screen.getByRole("button", { name: /^add$/i });
    expect(add.className).toContain("border-amber-500");
  });

  it("enables Proceed once a delivery address is saved", () => {
    render(
      <CartDrawer
        cart={[item]}
        onRemoveItem={noop}
        siteAddress="20 Jurong Port Road, 619094"
        onEditAddress={noop}
        highlightAddAddress={false}
        totalCost={12180}
        onCheckout={noop}
        onClose={noop}
      />,
    );
    expect(screen.getByRole("button", { name: /proceed to deposit/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /^edit$/i }).className).not.toContain(
      "border-amber-500",
    );
  });
});
