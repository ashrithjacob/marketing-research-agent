/** A reported price must be on the page it cites. The page text is Ethale's, as the run 344caa7d agent read it on 2026-10-19, when it submitted 2246 for $22.46. */
import { describe, expect, it } from "vitest";

import { CompetitorProfiler } from "../src/agent/stages/product-market/competitor-profiler.js";
import { UrlLedger } from "../src/agent/tools/url-ledger.js";
import { PriceCheck } from "../src/extract/index.js";

const ETHALE = "https://ethale.com/products/cleansing-lung-drops";
const PAGE = "Single Bottle30-Day-Supply\n\n$22.46\n\n$29.95\n\nMost popular\n\nBuy 2 Get 1 Free90-Day-Supply\n\n$44.93\n\n$59.90";

describe("a price on the page", () => {
  it("is found as written, and a dropped decimal point is not", () => {
    expect(PriceCheck.shown(29.95, PAGE)).toBe(true);
    expect(PriceCheck.shown(22.46, PAGE)).toBe(true);
    expect(PriceCheck.shown(2246, PAGE)).toBe(false);
    expect(PriceCheck.shown(9.95, PAGE)).toBe(false);
  });

  it("is found with thousands separators, a decimal comma, or whole", () => {
    expect(PriceCheck.shown(1299, "Now $1,299.00")).toBe(true);
    expect(PriceCheck.shown(32.95, "€32,95 inkl. MwSt.")).toBe(true);
    expect(PriceCheck.shown(30, "only $30 today")).toBe(true);
    expect(PriceCheck.shown(34.95, "$134.95")).toBe(false);
  });
});

describe("a competitor profile's price", () => {
  it("is refused when the cited page does not show it", () => {
    const urls = new UrlLedger();
    urls.read(ETHALE, PAGE);
    const profile = { platform: "shopify" as const, form_factor: "liquid_drops" as const, has_key_active: true, key_active_as_listed: "Mullein", positioning: "x", sources: [ETHALE] };
    expect(CompetitorProfiler.problems({ ...profile, price: { amount: 2246, currency: "USD", source_url: ETHALE } }, urls)).toEqual([
      `price 2246 does not appear as a price on ${ETHALE}; copy the one-off price exactly as the page shows it, e.g. 29.95`,
    ]);
    expect(CompetitorProfiler.problems({ ...profile, price: { amount: 29.95, currency: "USD", source_url: ETHALE } }, urls)).toEqual([]);
  });
});
