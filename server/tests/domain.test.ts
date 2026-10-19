/** The rules that live in the domain: what an analysis may start from, how a competitor is classified, and which urls an agent may cite. */
import { describe, expect, it } from "vitest";

import { ProductResolver } from "../src/agent/index.js";
import { UrlLedger } from "../src/agent/tools/url-ledger.js";
import { AnalysisInputSchema, CompetitorRelationship, Markets, Schemas } from "../src/domain/index.js";

import { PRODUCT_URL, RESOLUTION } from "./mullevia.js";

describe("analysis input", () => {
  it("defaults the market to US and keeps a url out of the product name", () => {
    const parsed = Schemas.parse(AnalysisInputSchema, { product_name: "mullein lung drops" });
    expect(parsed.ok && parsed.value.markets).toEqual(["US"]);
    const url = Schemas.parse(AnalysisInputSchema, { product_name: "mullevia.com/products/drops" });
    expect(url.ok).toBe(false);
  });

  it("covers the EU market with its member states when filtering by country", () => {
    const countries = Markets.countries(["US", "EU"]);
    expect(countries).toContain("US");
    expect(countries).toContain("DE");
    expect(countries).not.toContain("EU");
  });
});

describe("competitor relationship", () => {
  it("is direct on the same key active and form, indirect on another form, other without the key active", () => {
    const client = { form_factor: "liquid_drops" as const };
    expect(CompetitorRelationship.classify(client, { has_key_active: true, form_factor: "liquid_drops" })).toBe("direct");
    expect(CompetitorRelationship.classify(client, { has_key_active: true, form_factor: "capsules" })).toBe("indirect");
    expect(CompetitorRelationship.classify(client, { has_key_active: false, form_factor: "liquid_drops" })).toBe("other");
  });
});

describe("the resolver's checks", () => {
  it("refuse a product page never read and a competitor url never met, and ignore www and a trailing slash", () => {
    const urls = new UrlLedger();
    expect(ProductResolver.problems(RESOLUTION, urls).length).toBe(1 + RESOLUTION.competitors.length);
    urls.read(PRODUCT_URL.replace("https://", "https://www.") + "/");
    urls.saw(RESOLUTION.competitors.map((c) => c.url));
    expect(ProductResolver.problems(RESOLUTION, urls)).toEqual([]);
  });

  it("refuse an Amazon search page offered as a competitor's product page", () => {
    const urls = new UrlLedger();
    const search = "https://www.amazon.com/mullein-drops/s?k=mullein+drops";
    const offered = { ...RESOLUTION, competitors: [...RESOLUTION.competitors, { brand: "X", product_name: "X drops", url: search, why: "x" }] };
    urls.read(PRODUCT_URL);
    urls.saw(offered.competitors.map((c) => c.url));
    expect(ProductResolver.problems(offered, urls)).toEqual([`competitor url ${search} is an Amazon page but not a product page; use the listing's /dp/ url`]);
  });
});
