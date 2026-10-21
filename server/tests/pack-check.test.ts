/** The Mullevia label as the 2026-10-19 run read it: 60 mL, 2 mL a serving, 30 servings. The brief had nowhere to put them. */
import { describe, expect, it } from "vitest";

import { ProductBriefAgent } from "../src/agent/stages/product-market/product-brief-agent.js";
import { UrlLedger } from "../src/agent/tools/url-ledger.js";
import type { Pack } from "../src/domain/index.js";
import { PackCheck } from "../src/extract/index.js";
import { BRIEF, PRODUCT_URL } from "./mullevia.js";

const LABEL = "https://cdn.shopify.com/files/pdp-supplement-facts.jpg";
const PANEL = "Supplement Facts. Serving Size: 2 mL. Servings Per Container: 30. Net contents 60 mL (2 fl oz). Take 2 mL daily.";
const PACK: Pack = {
  net_contents: { amount: 60, unit: "mL" },
  serving_size: { amount: 2, unit: "ml" },
  servings_per_container: 30,
  servings_per_day: 1,
  directions_as_printed: "Take 2 mL daily.",
  source_url: LABEL,
};
const textOf = (url: string) => (url === LABEL ? PANEL : "");

describe("a product's pack", () => {
  it("is accepted when it adds up and its servings are printed", () => {
    expect(PackCheck.problems(PACK, textOf)).toEqual([]);
  });

  it("is refused when net contents over serving size disagrees with servings per container", () => {
    expect(PackCheck.problems({ ...PACK, servings_per_container: 60, source_url: PRODUCT_URL }, textOf)).toEqual([
      "pack: net_contents 60 mL / serving_size 2 ml is 30 servings, but servings_per_container is 60; read the label again",
    ]);
  });

  it("is refused when the servings count is not on the cited page", () => {
    expect(PackCheck.problems({ ...PACK, net_contents: null, servings_per_container: 20 }, textOf)).toEqual([
      `pack.servings_per_container 20 does not appear on ${LABEL}; copy it as the label prints it, or null`,
    ]);
  });

  it("leaves units it cannot compare alone", () => {
    expect(PackCheck.problems({ ...PACK, net_contents: { amount: 2, unit: "fl oz" } }, textOf)).toEqual([]);
  });
});

describe("a product brief's price points", () => {
  it("are refused when the cited page does not show the price", () => {
    const urls = new UrlLedger();
    urls.read(PRODUCT_URL, "Mullevia Mullein Drops. $32.95. Buy 2 Get 1 Free $65.90.");
    const bundle = { label: "Buy 2 Get 1 Free", amount: 6590, currency: "USD", units: 3, subscription: false, source_url: PRODUCT_URL };
    expect(ProductBriefAgent.problems({ ...BRIEF, pack: null, price_points: [bundle] }, urls)).toEqual([
      `price_points[0] 6590 does not appear as a price on ${PRODUCT_URL}; copy the one-off price exactly as the page shows it, e.g. 29.95`,
    ]);
    expect(ProductBriefAgent.problems({ ...BRIEF, pack: null, price_points: [{ ...bundle, amount: 65.9 }] }, urls)).toEqual([]);
  });
});
