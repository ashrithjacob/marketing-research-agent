/** Stage 5 end to end: the reader builds and revises its avatar memory batch by batch, ads are placed on the avatars, each avatar is judged, and code counts the shares. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Message } from "@earendil-works/pi-ai";

import { AmazonListingFinder, AvatarStage, Pipeline, ReviewListings, ReviewStage } from "../src/agent/index.js";
import type { AdHit, CollectedReview, ReviewListing, ReviewSource, ReviewSourceName, StoredAvatar, Storefront, StorefrontFacts } from "../src/domain/index.js";
import { App } from "../src/http/index.js";

import { Faux, FakeWeb, NoBilling, FakeVisuals, TestSettings } from "./fakes.js";
import { PAGES, PRODUCT_URL, RESOLUTION, SEARCH_HITS } from "./mullevia.js";
import { PostgresStores } from "./postgres-stores.js";
import { RunDriver } from "./run-driver.js";
import { ScriptedAgents } from "./scripted-agents.js";

const { call } = ScriptedAgents;
const text = (message: Message | undefined): string => {
  const content = message?.content ?? "";
  return typeof content === "string" ? content : content.map((part) => ("text" in part ? part.text : "")).join("");
};
const profile = { pains: ["morning cough"], desires: ["clear lungs"], triggers: [], prior_solutions: [], objections: [], outcomes: [], angles: ["Quit smoking, still coughing?"] };

class OneStore implements Storefront {
  async inspect(url: string): Promise<StorefrontFacts | null> {
    return url === PRODUCT_URL ? { shop_domain: "m.myshopify.com", product_id: "1", review_apps: ["judgeme"] } : null;
  }
}

class Reviews implements ReviewSource {
  constructor(
    readonly name: ReviewSourceName,
    private readonly count: number,
  ) {}

  async collect(listing: ReviewListing, limit: number): Promise<CollectedReview[]> {
    return Array.from({ length: Math.min(this.count, limit) }, (_, i) => ({
      source: this.name, source_review_id: `${this.name}${i}`, rating: (i % 5) + 1, title: "", body: `${this.name} review ${i} ${listing.source}`, review_date: null, verified: true, helpful_votes: 0, country: null,
    }));
  }
}

class Reader {
  refusal = "";
  batches = 0;

  readonly respond = (messages: Message[]) => {
    const prompt = text(messages.find((m) => m.role === "user"));
    const ids = [...prompt.matchAll(/<review id="([0-9a-f]+)" stars="(\d)"/g)].map((m) => ({ id: m[1]!, stars: Number(m[2]) }));
    const last = messages.at(-1);
    if (last?.role === "toolResult") this.refusal = JSON.stringify(last.content);
    const firstTry = last?.role !== "toolResult";
    const fresh = prompt.includes("No avatars yet");
    if (firstTry) this.batches += 1;
    const assign = ids.map(({ id, stars }) => ({ review_id: id, avatar: stars <= 2 ? "doubters" : "ex_smokers" }));
    const kept = fresh && firstTry ? assign.slice(1) : assign;
    const create = fresh
      ? [{ key: "ex_smokers", parent: null, name: "Ex-smokers", description: "Quit and still cough.", ...profile }, { key: "doubters", parent: null, name: "Doubters", description: "Tried everything.", ...profile }]
      : [];
    const quote = assign.find((a) => a.avatar === "doubters");
    return call("submit", { create, assign: kept, quotes: quote ? [{ avatar: "doubters", review_id: quote.review_id }] : [] });
  };
}

const ad = (id: string): AdHit => ({
  ad_id: id, advertiser: "LungClear", page_id: "1", landing_url: "https://lungclear.com/p", landing_domain: "lungclear.com", first_seen: "2026-08-01", last_seen: "", status: "active",
  countries: ["US"], body: "Still coughing after you quit? ".repeat(80), ad_reach: 10, page_reach_30d: null, page_live_ads: null, days_running: 40, duplicates: 3,
  reach_delta_7d: null, reach_delta_30d: null, current_rank: null, is_eu: false, media_url: null, thumbnail_url: null, age_min: null, age_max: null, gender: null,
});

let pg: PostgresStores;

beforeAll(async () => {
  pg = await PostgresStores.start();
});

afterAll(async () => {
  await pg.stop();
});

describe("stage 5", () => {
  it("reads every review in mixed batches into a memory of avatars, places the ads, judges each avatar, and stores the counts and quotes", async () => {
    const product = await pg.store.products.upsert("admin", PRODUCT_URL, "Mullein Drops", "Mullevia");
    const [winning, dead, sameBuyer] = await pg.store.ads.save("admin", product.id, [ad("w1"), ad("d1"), ad("b1")], new Map());
    const reading = { avatar: "ex-smokers", claim_type: "identity" as const, awareness: "problem_aware" as const, mechanism: null, proof_types: [], offer: null, objections_handled: [], emotion: "relief", risk_flags: [] };
    await pg.store.ads.saveRing(winning!.id, "same_problem", "lungs");
    await pg.store.ads.saveRing(dead!.id, "direct_competitor", "same tincture");
    await pg.store.ads.saveRing(sameBuyer!.id, "same_buyer", "joint pain, 50+");
    await pg.store.ads.saveReading(winning!.id, { ...reading, ad_id: winning!.id, bucket: "winning", bucket_why: "40 days" });
    await pg.store.ads.saveReading(dead!.id, { ...reading, ad_id: dead!.id, bucket: "dead", bucket_why: "stopped" });
    await pg.store.ads.saveReading(sameBuyer!.id, { ...reading, ad_id: sameBuyer!.id, bucket: "winning", bucket_why: "90 days" });

    const reader = new Reader();
    const faux = new Faux();
    faux.provider.setResponses(
      new ScriptedAgents()
        .on("Product url:", [call("web_fetch", { url: PRODUCT_URL }), call("web_search", { query: "x" }), call("submit", RESOLUTION)])
        .on("Product: ", [call("submit", { amazon_url: null, why: "store only" })])
        .on("The client's product:", [reader.respond, reader.respond])
        .on("ads to place:", [(messages) => call("submit", { place: [...text(messages.find((m) => m.role === "user")).matchAll(/<ad id="([0-9a-f]+)"/g)].map((m) => ({ ad_id: m[1], avatar: "ex_smokers" })) })])
        .on("placed on them", [call("submit", { verdicts: ["ex_smokers", "doubters"].map((key) => ({ key, awareness: "problem_aware", confidence: "medium", standing: key === "ex_smokers" ? "avatar" : "emerging", best_competitor_angle: key === "ex_smokers" ? "Still coughing after you quit?" : null })) })])
        .steps(400),
    );
    const sources = new Map<ReviewSourceName, ReviewSource>([["judgeme", new Reviews("judgeme", 90)]]);
    const pipeline = new Pipeline([new ReviewStage(new ReviewListings(new OneStore(), new AmazonListingFinder()), sources, 500), new AvatarStage()]);
    const { settings, traces } = TestSettings.make();
    const app = new App({ settings, traces, store: pg.store, services: new FakeWeb(PAGES, SEARCH_HITS).services(), models: faux.models, generations: new NoBilling(), visuals: new FakeVisuals(), pipeline });
    const driver = new RunDriver(app);

    const runId = await driver.start({ product_url: PRODUCT_URL });
    const done = await driver.confirmAndFinish(runId, { product_url: PRODUCT_URL, competitors: RESOLUTION.competitors.slice(0, 1).map(({ why: _why, ...pick }) => pick) });

    expect(done.run.stage_status.avatars).toMatchObject({ status: "completed", error: "" });
    expect(reader.batches).toBe(3);
    expect(reader.refusal).toContain("1 review(s) in this batch are not assigned");
    expect(done.run.stage_status.avatars.summary).toBe("2 avatars and 0 sub-avatars from 90 reviews (90 assigned, 0 about no buyer); 2 of 2 competitor and same-problem ads placed.");
    const { avatars, quotes } = await driver.json<{ avatars: StoredAvatar[]; quotes: { avatar_id: string; rating: number }[] }>(`/runs/${runId}/avatars`);
    const byKey = Object.fromEntries(avatars.map((avatar) => [avatar.key, avatar]));
    expect(byKey.ex_smokers).toMatchObject({ review_count: 54, demand_share: 0.6, supply_share: 1, win_rate: 0.5, standing: "avatar", confidence: "medium" });
    expect(byKey.ex_smokers!.profile.best_competitor_angle).toBe("Still coughing after you quit?");
    expect(byKey.doubters).toMatchObject({ review_count: 36, ad_count: 0, win_rate: null, standing: "emerging" });
    expect(quotes.filter((q) => q.avatar_id === byKey.doubters!.id).every((q) => q.rating <= 2)).toBe(true);
    const snapshots = await pg.db.all<{ batch: number }>("SELECT batch FROM avatar_memories WHERE run_id = ? ORDER BY batch", [runId]);
    expect(snapshots.map((s) => s.batch)).toEqual([1, 2, 3, 4]);
  });
});
