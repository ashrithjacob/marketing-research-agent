import { describe, expect, it } from "vitest";

import { stagePacketSchema } from "../src/domain/index.js";
import { CompetitorPageCheck } from "../src/extract/competitor-page-check.js";

type Page = { id: string; url: string; title: string; kind?: string };
type Row = { id: string; brand: string; source: string; url?: string };

const WALMART: Page = { id: "walmart", url: "https://www.walmart.com/ip/BulkSupplements-com-Creatine-Monohydrate/1", title: "BulkSupplements Creatine Monohydrate Capsules, 210 ct, 5000mg - Walmart.com" };
const GNC_LEGION: Page = { id: "gnc", url: "https://www.gnc.com/creatine-shopall/547206.html", title: "Legion Creatine Gummies - Sour Blue Raspberry (30 Servings) | GNC" };
const LEGION: Page = { id: "legion", url: "https://legionathletics.com/products/supplements/creatine-gummies/", title: "Creatine Monohydrate Gummies | Legion" };
const SWOLY: Page = { id: "swoly", url: "https://getswoly.com/products/creatine-mono-gummies", title: "Creatine Gummies - SWOLY" };
const BULK: Page = { id: "bulk", url: "https://www.bulksupplements.com/products/creatine-monohydrate", title: "Creatine Monohydrate | Creatine Monohydrate Powder" };
const IHERB_ON: Page = { id: "iherb", url: "https://www.iherb.com/pr/optimum-nutrition-micronized-creatine-powder/1", title: "Optimum Nutrition, Micronized Creatine Powder, Unflavored, 1.32 lb (600 g)" };
const ADS: Page = { id: "ads", url: "https://www.facebook.com/ads/library/?q=creatine", title: "Meta Ad Library — keyword search 'creatine'", kind: "ad_library" };

const problems = (pages: Page[], rows: Row[]) =>
  new CompetitorPageCheck().problems(
    stagePacketSchema.parse({
      brief: { product: "creatine" },
      sources: pages.map((p) => ({ id: p.id, url: p.url, title: p.title, kind: p.kind ?? "competitor_marketing", node: "competitors" })),
      competitors: rows.map((r) => ({
        id: r.id,
        name: `${r.brand} Creatine`,
        brand: r.brand,
        url: r.url ?? pages.find((p) => p.id === r.source)!.url,
        relation: "direct",
        form: "powder",
        active_ingredients: [{ name_as_printed: "Creatine Monohydrate", name_normalised: "creatine monohydrate" }],
        shared_actives: ["creatine monohydrate"],
        source_id: r.source,
      })),
    }),
  );

describe("CompetitorPageCheck (pages from the US creatine run, 2026-09-28)", () => {
  it("rejects brands that borrowed another brand's retailer page, and keeps the brand the page is about", () => {
    const found = problems([WALMART], [
      { id: "c2", brand: "BulkSupplements.com", source: "walmart" },
      { id: "c9", brand: "Equate (Walmart store brand)", source: "walmart" },
      { id: "c10", brand: "Vitamatic", source: "walmart" },
    ]);
    expect(found).toHaveLength(2);
    expect(found.join("\n")).toMatch(/Equate.*c9.*another brand's product/);
    expect(found.join("\n")).toMatch(/Vitamatic.*c10/);
  });

  it("rejects a page that names neither brand citing it", () => {
    expect(problems([IHERB_ON], [
      { id: "c18", brand: "California Gold Nutrition", source: "iherb" },
      { id: "c22", brand: "Micro Ingredients", source: "iherb" },
    ])).toHaveLength(2);
  });

  it("rejects a retailer page that sells another brand, even when the retailer's name is in the brand", () => {
    const found = problems([GNC_LEGION], [
      { id: "c13", brand: "RYSE", source: "gnc" },
      { id: "c40", brand: "Codeage", source: "gnc" },
    ]);
    expect(found).toHaveLength(2);
  });

  it("rejects an ad-library page as a competitor's product page", () => {
    expect(problems([ADS], [{ id: "c23", brand: "Orgain", source: "ads" }])[0]).toMatch(/ad-library page.*ad_source_ids/);
  });

  it("keeps brands on their own sites: named in the title, or only in the web address", () => {
    expect(problems([LEGION, SWOLY, BULK], [
      { id: "c30", brand: "Legion Athletics", source: "legion" },
      { id: "c32", brand: "SWOLY Supplements", source: "swoly" },
      { id: "c2", brand: "BulkSupplements.com", source: "bulk" },
    ])).toEqual([]);
  });

  it("keeps the brand a shared page is about and rejects the ones that borrowed it", () => {
    const found = problems([LEGION], [
      { id: "c30", brand: "Legion Athletics", source: "legion" },
      { id: "c33", brand: "Bear Balanced", source: "legion" },
    ]);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatch(/Bear Balanced/);
  });

  it("never treats the product's own ingredient as a brand word", () => {
    expect(problems([IHERB_ON], [{ id: "c36", brand: "Omni Creatine", source: "iherb" }])[0]).toMatch(/Omni Creatine/);
  });
});
