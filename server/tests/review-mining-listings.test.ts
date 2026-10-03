import { describe, expect, it } from "vitest";

import { AmazonListingLookup } from "../src/adapters/apify/index.js";
import type { ActorRunner } from "../src/adapters/apify/index.js";
import { ListingMatch, ReviewMiningListings } from "../src/agent/index.js";
import type { AmazonListing, AmazonListingSource, MiningTarget, TargetListing, TargetListings } from "../src/domain/index.js";
import { MULLEIN_LISTINGS } from "./mullein-listings.js";
import { HERB_PHARM_PAGE, HUEL_PAGE } from "./trustpilot-pages.js";
import { TrustpilotProfiles } from "../src/adapters/index.js";

const target = (id: string, name: string, brand = ""): MiningTarget => ({
  id,
  name,
  brand,
  relation: "direct",
  form: "powder",
  actives: ["creatine monohydrate"],
  url: `https://example.com/${id}`,
  amazon_url: "",
  trustpilot: "",
  note: "",
});

const listing = (brand: string, title = "Creatine Monohydrate Powder"): AmazonListing => ({
  asin: "B002DYIZEE",
  title,
  url: "https://www.amazon.com/dp/B002DYIZEE",
  brand,
  marketplace: "www.amazon.com",
  price: 17.97,
  currency: "$",
  stars: 4.6,
  stars_breakdown: null,
  reviews_count: 82438,
  bought_past_month: "60K+ bought in past month",
  bestseller_ranks: [],
  amazon_choice: false,
  thumbnail: "",
});

class MemoryListings implements TargetListings {
  readonly rows = new Map<string, TargetListing>();
  async save(row: TargetListing): Promise<void> {
    this.rows.set(`${row.source_run_id}/${row.target_id}`, row);
  }
  async list(sourceRunId: string): Promise<TargetListing[]> {
    return [...this.rows.values()].filter((row) => row.source_run_id === sourceRunId);
  }
}

describe("ReviewMiningListings", () => {
  it("searches by brand and name, without the '(Amazon: …)' wrapper", () => {
    expect(ReviewMiningListings.query(target("c1", "Creatine Monohydrate Powder", "Myprotein"))).toBe("Myprotein Creatine Monohydrate Powder");
    expect(ReviewMiningListings.query(target("p", "Optimum Nutrition Creatine (Amazon: Creatine Powder, 120 Servings)"))).toBe(
      "Optimum Nutrition Creatine Creatine Powder, 120 Servings",
    );
  });

  it("flags an Amazon hit from another brand, so it is shown as a warning and never mined", () => {
    expect(ListingMatch.mismatch(target("p", "Optimum Nutrition Micronized Creatine"), listing("Optimum Nutrition"))).toBe("");
    expect(ListingMatch.mismatch(target("c1", "Creatine Monohydrate Powder", "Myprotein"), listing("Optimum Nutrition"))).toBe("brand");
    expect(ListingMatch.mismatch(target("c2", "Creatine", "THORNE"), listing("Thorne"))).toBe("");
    expect(ListingMatch.mismatch(target("c9", "Creatine", "Acme"), listing(""))).toBe("brand");
  });

  it("judges the 23 listings of the mullein roster as §4.2 requires", () => {
    for (const row of MULLEIN_LISTINGS) {
      const mined: MiningTarget = { id: row.id, name: row.name, brand: row.brand, relation: "direct", form: row.form, actives: row.actives, url: "", amazon_url: "", trustpilot: "", note: "" };
      expect([row.id, ListingMatch.mismatch(mined, listing(row.listingBrand, row.title))]).toEqual([row.id, row.expected]);
    }
  });

  it("refuses a listing whose title names another form, and names a powder by its weight (titles from the creatine run)", () => {
    const bulk = target("c2", "Creatine Monohydrate Powder", "Bulk");
    expect(ListingMatch.mismatch(bulk, listing("Bulk", "Bulk Creatine Monohydrate Tablets, Pack of 270"))).toBe("form");
    const sw = target("c5", "Creatine Monohydrate", "Switch Nutrition");
    expect(ListingMatch.mismatch(sw, listing("SWITCH NUTRITION", "Switch Nutrition Purest Creatine 500gm Unflavoured"))).toBe("");
    const gummies = { ...target("c8", "Creatine Gummies", "Bulk"), form: "gummy" as const };
    expect(ListingMatch.mismatch(gummies, listing("Bulk", "Bulk Creatine Gummies | 60 Blue Raspberry Flavour"))).toBe("");
    expect(ListingMatch.formMatches(bulk, "Creatine Powder or Capsules")).toBe(true);
  });

  it("re-judges a stored verdict on every read, so an older rule's match is neither shown nor mined (c16, run 99002ee8)", async () => {
    const store = new MemoryListings();
    const spray = { ...target("c16", "A.Vogel Mullein & Marshmallow Spray", "A.Vogel"), form: "spray" as const, actives: ["mullein"] };
    const sinuforce = listing("A.Vogel", "A.Vogel Sinuforce Nasal Spray + Menthol");
    await store.save({ source_run_id: "r", target_id: "c16", query: "", strategy: "", listing: sinuforce, matches: true, mismatch: "", error: "", fetched_at: "" });
    const [row] = (await new ReviewMiningListings(store, null, 1).judged("r", [spray]));
    expect([row!.matches, row!.mismatch]).toEqual([false, "active"]);
    expect((await store.list("r"))[0]!.matches).toBe(false);
  });

  it("re-checks a saved listing against the rule without searching again", async () => {
    const store = new MemoryListings();
    const asked: string[] = [];
    const source: AmazonListingSource = { lookup: async (q) => (asked.push(q), []) };
    const bulk = { ...target("c2", "Creatine Monohydrate Powder", "Bulk"), url: "https://www.bulk.com/uk/p" };
    const listings = new ReviewMiningListings(store, source, 2);
    await store.save({ source_run_id: "r", target_id: "c2", query: "", strategy: ReviewMiningListings.strategy(bulk), listing: listing("Bulk", "Bulk Creatine Monohydrate Tablets"), matches: true, mismatch: "", fetched_at: "", error: "" });
    const [row] = await listings.ensure("r", [bulk]);
    expect([row!.matches, row!.mismatch]).toEqual([false, "form"]);
    expect(asked).toEqual([]);
  });

  it("looks each target up once: a second open is free, and a failed lookup is retried rather than cached", async () => {
    const asked: string[] = [];
    let fail = true;
    const source: AmazonListingSource = {
      lookup: async (query) => {
        asked.push(query);
        if (query.startsWith("Bulk") && fail) throw new Error("actor timed out");
        return [listing(query.split(" ")[0]!)];
      },
    };
    const store = new MemoryListings();
    const listings = new ReviewMiningListings(store, source, 4);
    const roster = [target("c1", "Creatine", "Thorne"), target("c2", "Creatine Powder", "Bulk")];
    expect((await listings.ensure("run1", roster)).map((row) => row.target_id)).toEqual(["c1"]);
    fail = false;
    expect((await listings.ensure("run1", roster)).map((row) => row.target_id)).toEqual(["c1", "c2"]);
    await listings.ensure("run1", roster);
    expect(asked).toEqual(["Thorne Creatine", "Bulk Creatine Powder", "Bulk Creatine Powder"]);
  });

  it("searches the brand's home Amazon store, worked out from its site", () => {
    const at = (url: string) => ReviewMiningListings.marketplace({ ...target("c", "Creatine"), url });
    expect(at("https://switchnutrition.com.au/products/creatine-monohydrate")).toBe("www.amazon.com.au");
    expect(at("https://kyro.co.nz/products/creatine")).toBe("www.amazon.com.au");
    expect(at("https://www.bulk.com/uk/products/creatine-monohydrate/bpb-cmon-0000")).toBe("www.amazon.co.uk");
    expect(at("https://www.thorne.com/products/dp/creatine")).toBe("www.amazon.com");
  });

  it("keeps the first of several hits that is this brand, and redoes a row made under an older rule", async () => {
    const asked: string[] = [];
    const source: AmazonListingSource = {
      lookup: async (_query, marketplace, max) => {
        asked.push(`${marketplace} ${max}`);
        return [listing("Optimum Nutrition"), listing("Switch Nutrition", "Switch Creatine Powder"), listing("Switch Nutrition")];
      },
    };
    const store = new MemoryListings();
    const switchTarget = { ...target("c5", "Creatine Monohydrate", "Switch Nutrition"), url: "https://switchnutrition.com.au/p" };
    await store.save({ source_run_id: "r", target_id: "c5", query: "", strategy: "", listing: listing("Optimum Nutrition"), matches: false, mismatch: "brand", error: "", fetched_at: "" });
    const [row] = await new ReviewMiningListings(store, source, 2).ensure("r", [switchTarget]);
    expect(row!.matches).toBe(true);
    expect(row!.listing!.title).toBe("Switch Creatine Powder");
    await new ReviewMiningListings(store, source, 2).ensure("r", [switchTarget]);
    expect(asked).toEqual(["www.amazon.com.au 5"]);
    await store.save({ source_run_id: "r", target_id: "c3", query: "", strategy: "", listing: listing("Thorne"), matches: true, mismatch: "", error: "", fetched_at: "" });
    await new ReviewMiningListings(store, source, 2).ensure("r", [{ ...target("c3", "Creatine", "Thorne"), url: "https://thorne.com/p" }]);
    expect(asked).toHaveLength(1);
  });
});

describe("AmazonListingLookup", () => {
  it("reads the traction fields the product-detail scrape returns", async () => {
    const runner: ActorRunner = {
      run: async () => ({
        status: "SUCCEEDED",
        usageUsd: 0.01,
        items: [
          {
            asin: "B002DYIZEE",
            title: "Optimum Nutrition Creatine Monohydrate Powder",
            url: "https://www.amazon.com/dp/B002DYIZEE",
            brand: "Optimum Nutrition",
            price: { value: 17.97, currency: "$" },
            stars: 4.6,
            starsBreakdown: { "5star": 0.81, "4star": 0.1, "3star": 0.05, "2star": 0.01, "1star": 0.03 },
            reviewsCount: 82438,
            monthlyPurchaseVolume: "60K+ bought in past month",
            bestsellerRanks: [{ rank: 51, category: "Health & Household", url: "x" }, { rank: 3, category: "Creatine Nutritional Supplements" }],
            isAmazonChoice: false,
            thumbnailImage: "https://m.media-amazon.com/images/I/712VrHndy5L.jpg",
          },
        ],
      }),
    };
    const found = (await new AmazonListingLookup(runner).lookup("Optimum Nutrition Creatine", "www.amazon.com", 5))[0];
    expect(found).toMatchObject({
      asin: "B002DYIZEE",
      price: 17.97,
      reviews_count: 82438,
      bought_past_month: "60K+ bought in past month",
      stars_breakdown: { "3": 0.05, "5": 0.81 },
      bestseller_ranks: [{ rank: 51, category: "Health & Household" }, { rank: 3, category: "Creatine Nutritional Supplements" }],
    });
  });
});

describe("TrustpilotProfiles", () => {
  it("reads the score and review count from the company's own header, not the sidebar's other companies", () => {
    expect(TrustpilotProfiles.parse(HUEL_PAGE)).toEqual({ stars: 4.2, reviews: 29447, error: "" });
  });

  it("says a company with no reviews has none, and no score", () => {
    expect(TrustpilotProfiles.parse(HERB_PHARM_PAGE)).toEqual({ stars: null, reviews: 0, error: "" });
  });

  it("says so when the page is not a company profile", () => {
    expect(TrustpilotProfiles.parse("# Search results\n\nNo companies found")).toMatchObject({ reviews: null, error: "no Trustpilot page for this domain" });
  });

  it("keeps a failed read as an error rather than a zero", async () => {
    const failing = new TrustpilotProfiles({ scrape: async () => { throw new Error("Firecrawl returned 502"); } });
    expect(await failing.read("huel.com")).toMatchObject({ reviews: null, stars: null, error: "Firecrawl returned 502" });
  });
});
