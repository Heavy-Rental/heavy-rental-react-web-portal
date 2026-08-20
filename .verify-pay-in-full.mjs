import { chromium } from "playwright-core";

const shotDir = "/tmp/claude-1000/-workspaces-heavy-rental-web-portal/f26761b3-5c00-4495-b6e2-191805a8ea0d/scratchpad/shots";
await import("node:fs/promises").then((fs) => fs.mkdir(shotDir, { recursive: true }));

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await (await browser.newContext()).newPage();
page.on("console", (msg) => {
  if (msg.type() === "error") console.log("CONSOLE ERROR:", msg.text());
});
page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));

async function shot(name) {
  await page.screenshot({ path: `${shotDir}/${name}.png`, fullPage: true });
  console.log("screenshot:", name);
}

await page.goto("http://127.0.0.1:5173");
await page.getByRole("navigation").getByRole("button", { name: "Sign In" }).click();
const loginForm = page.locator("form");
await loginForm.getByPlaceholder("you@company.com").fill("alex.tan@example.sg");
await loginForm.getByPlaceholder("••••••••").fill("customer123");
await loginForm.getByRole("button", { name: "Sign In" }).click();
await page.waitForSelector("text=/i know what i want/i", { timeout: 15000 });
console.log("logged in, onboarding shown");
await page.getByText(/i know what i want/i).click();
await page.waitForSelector("text=/welcome back/i", { timeout: 15000 });
console.log("reached browse/catalogue view");

// Open the shared date bar and pick a start/end date within the second (next-month)
// calendar panel, to sidestep "today" edge cases and cross-month rollover.
await page.getByText("Select date").first().click();
const monthPanels = page.locator("div.flex-1.min-w-0");
await monthPanels.nth(1).waitFor({ timeout: 5000 });
await monthPanels.nth(1).getByRole("button", { name: "10", exact: true }).click();
await monthPanels.nth(1).getByRole("button", { name: "15", exact: true }).click();
await page.getByRole("button", { name: "Done" }).click();
console.log("dates picked");
await shot("01-dates-picked");

// Select the first equipment card (JLG 1350SJP Telescopic Boom, S$580/day).
await page.getByRole("button", { name: "Select", exact: true }).first().click();
console.log("equipment selected");
await shot("02-after-select");

await page.getByRole("button", { name: /cart/i }).first().click().catch(() => {});
await shot("03-cart-attempt");

// Landed on the Site Address modal — fill it and continue to the booking summary.
await page.getByPlaceholder(/jurong port road/i).fill("20 Jurong Port Road");
await page.waitForTimeout(500);
await shot("03b-address-filled");
const saveAddressBtn = page.getByRole("button", { name: /save address/i });
if (await saveAddressBtn.isVisible().catch(() => false)) {
  await saveAddressBtn.click();
} else {
  await page.getByRole("button", { name: /skip for now/i }).click();
}
await page.waitForTimeout(800);
await shot("04-cart-drawer");

await page.getByRole("button", { name: /proceed to deposit/i }).click();
await page.waitForTimeout(1000);
await shot("04b-after-proceed-click");
const confirmAddressBtn = page.getByRole("button", { name: /confirm address/i });
if (await confirmAddressBtn.isVisible().catch(() => false)) {
  await confirmAddressBtn.click();
}
await page.waitForSelector("text=/booking summary/i", { timeout: 10000 });
console.log("booking summary modal open");
await shot("05-summary-deposit-default");

// Toggle to "Pay in Full" and screenshot the updated breakdown.
await page.getByRole("button", { name: /pay in full/i }).click();
await page.waitForTimeout(300);
await shot("06-summary-pay-in-full");

// Continue to payment as Full, complete the mock card payment.
await page.getByRole("button", { name: /continue to payment/i }).click();
await page.waitForSelector("text=/step 2 of 2/i", { timeout: 10000 });
await shot("07-payment-step-full");

await page.getByPlaceholder("1234 5678 9012 3456").fill("4242 4242 4242 4242");
await page.getByPlaceholder("08/27").fill("12/28");
await page.getByPlaceholder("•••").fill("123");
await page.getByRole("button", { name: /pay .* in full/i }).click();
await page.waitForSelector("text=/reservation confirmed/i", { timeout: 15000 });
console.log("full payment confirmed");
await shot("08-confirmation-full-payment");

await browser.close();
