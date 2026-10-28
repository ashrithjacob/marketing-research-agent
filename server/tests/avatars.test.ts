/** Stage 5 end to end: the reader builds and revises its avatar memory batch by batch, code holds sub-avatars to the floor, ads are placed on the avatars, each avatar is judged, gaps are found per avatar, each audience segment becomes an ad avatar, and code counts the shares. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Message, SimpleStreamOptions } from "@earendil-works/pi-ai";
import type { FauxResponseFactory } from "@earendil-works/pi-ai/providers/faux";

import { AmazonListingFinder, AvatarStage, Pipeline, ReviewListings, ReviewStage } from "../src/agent/index.js";
import { AgentRunner } from "../src/agent/kernel/agent-runner.js";
import { ToolReply } from "../src/agent/tools/tool-reply.js";
import { AvatarFloor, AvatarTally } from "../src/extract/index.js";
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
const readerOptions: Array<SimpleStreamOptions | undefined> = [];
const watched = (steps: FauxResponseFactory[]): FauxResponseFactory[] =>
  steps.map((step) => (context, options, state, model) => {
    if (text(context.messages.find((m) => m.role === "user")).startsWith("The client's product:")) readerOptions.push(options);
    return step(context, options, state, model);
  });
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
      ? [{ key: "ex_smokers", name: "Ex-smokers", description: "Quit and still cough.", ...profile }, { key: "doubters", name: "Doubters", description: "Tried everything.", ...profile }]
      : [];
    const quote = assign.find((a) => a.avatar === "doubters");
    return call("submit", { create, assign: kept, quotes: quote ? [{ avatar: "doubters", review_id: quote.review_id }] : [] });
  };
}

class Splitter {
  refusal = "";
  readonly split: string[] = [];

  readonly respond = (messages: Message[]) => {
    const prompt = text(messages.find((m) => m.role === "user"));
    const avatar = /Avatar to split: ([a-z_]+)/.exec(prompt)![1]!;
    const ids = [...prompt.matchAll(/<review id="([0-9a-f]+)" stars="(\d)"/g)].map((m) => ({ id: m[1]!, stars: Number(m[2]) }));
    const last = messages.at(-1);
    if (last?.role === "toolResult") this.refusal = JSON.stringify(last.content);
    else this.split.push(avatar);
    if (avatar === "doubters") {
      return call("submit", { create: [{ key: "one_story", name: "One story", description: "A single reviewer.", ...profile }], assign: ids.map(({ id }, i) => ({ review_id: id, avatar: i < 3 ? "one_story" : null })) });
    }
    const key = last?.role === "toolResult" ? "still_wheezing" : "doubters";
    const assign = ids.map(({ id, stars }) => ({ review_id: id, avatar: stars === 5 ? key : null }));
    return call("submit", { create: [{ key, name: "Still wheezing", description: "Quit years ago, still wheeze at night.", ...profile }], assign, quotes: [{ avatar: key, review_id: assign.find((a) => a.avatar)!.review_id }] });
  };
}

const ad = (id: string, days = 40, status = "active"): AdHit => ({
  ad_id: id, advertiser: "LungClear", page_id: "1", landing_url: "https://lungclear.com/p", landing_domain: "lungclear.com", first_seen: "2026-08-01", last_seen: "", status,
  countries: ["US"], body: "Still coughing after you quit? ".repeat(80), ad_reach: 10, page_reach_30d: null, page_live_ads: null, days_running: days, duplicates: 3,
  reach_delta_7d: null, reach_delta_30d: null, current_rank: null, is_eu: false, media_url: null, thumbnail_url: null, age_min: null, age_max: null, gender: null,
});

let pg: PostgresStores;

beforeAll(async () => {
  pg = await PostgresStores.start();
});

afterAll(async () => {
  await pg.stop();
});

describe("AvatarFloor", () => {
  const avatar = (key: string, parent: string | null, reviews: number) => ({ key, parent, name: key, description: "", ...profile, review_ids: Array.from({ length: reviews }, (_, i) => `${key}${i}`), quote_ids: [`${key}0`], ad_ids: [`ad-${key}`] });

  it("folds a sub-avatar under five reviews into its parent, with its reviews, quotes and ads, and keeps one at five", () => {
    const { memory, folded } = AvatarFloor.fold({ avatars: [avatar("smokers", null, 20), avatar("one_story", "smokers", 4), avatar("night_cough", "smokers", 5)], unassigned_review_ids: [], batches_read: 3 });
    expect(folded).toBe(1);
    expect(memory.avatars.map((a) => a.key)).toEqual(["smokers", "night_cough"]);
    expect(memory.avatars[0]).toMatchObject({ review_ids: expect.arrayContaining(["one_story3"]), quote_ids: ["smokers0", "one_story0"], ad_ids: ["ad-smokers", "ad-one_story"] });
    expect(memory.avatars[0]!.review_ids).toHaveLength(24);
  });

  it("reports an avatar under fifteen reviews as emerging whatever its verdict says", () => {
    const records = AvatarTally.records({ avatars: [avatar("small", null, 14), avatar("big", null, 15)], unassigned_review_ids: [], batches_read: 1 }, { verdicts: ["small", "big"].map((key) => ({ key, awareness: "problem_aware" as const, confidence: "high" as const, standing: "avatar" as const, best_competitor_angle: null, skepticism: 2, skepticism_review_ids: [] })) }, []);
    expect(records.map((r) => [r.avatar.key, r.avatar.standing])).toEqual([["small", "emerging"], ["big", "avatar"]]);
  });

  it("cuts an opening on whole characters, so a two-part letter is never split", () => {
    expect(ToolReply.clip("𝐈 𝐡𝐚𝐯𝐞", 3)).toBe("𝐈 𝐡…");
  });
});

describe("stage 5", () => {
  it("reads every review in mixed batches into a memory of avatars, places the ads, judges each avatar, and stores the counts and quotes", async () => {
    const product = await pg.store.products.upsert("admin", PRODUCT_URL, "Mullein Drops", "Mullevia");
    const reader = new Reader();
    const splitter = new Splitter();
    let sameBuyerRefusal = "";
    const adAvatar = (messages: Message[]) => {
      const prompt = text(messages.find((m) => m.role === "user"));
      const profile = { description: "Smokers told to quit.", pains: ["cough"], desires: ["clear lungs"], triggers: [], objections: [], angles: ["hidden layer"], quote_ad_ids: [/\[([0-9a-f]+)\]/.exec(prompt)![1]] };
      if (!prompt.includes("The client's avatars")) return call("submit", profile);
      const last = messages.at(-1);
      if (last?.role === "toolResult") sameBuyerRefusal = JSON.stringify(last.content);
      const review_avatar = last?.role === "toolResult" ? "ex_smokers" : "joint_pain";
      return call("submit", { ...profile, same_buyer: { review_avatar, shared: "Over 60 and long past quitting.", borrow: ["a doctor's story opening"] } });
    };
    const faux = new Faux();
    faux.provider.setResponses(
      watched(new ScriptedAgents()
        .on("Product url:", [call("web_fetch", { url: PRODUCT_URL }), call("web_search", { query: "x" }), call("submit", RESOLUTION)])
        .on("Product: ", [call("submit", { amazon_url: null, why: "store only" })])
        .on("The client's product:", [reader.respond, reader.respond])
        .on("Avatar to split:", [splitter.respond, splitter.respond])
        .on("ads to place:", [(messages) => call("submit", { place: [...text(messages.find((m) => m.role === "user")).matchAll(/<ad id="([0-9a-f]+)"/g)].map((m) => ({ ad_id: m[1], avatar: "ex_smokers" })) })])
        .on("Audience segment:", [adAvatar, adAvatar])
        .on("of its reviews:", [(messages) => {
          const prompt = text(messages.find((m) => m.role === "user"));
          const first = /<review id="([0-9a-f]+)"/.exec(prompt)![1];
          return call("submit", { themes: [{ kind: "pain", theme: "the night cough keeps a spouse awake", review_ids: [first] }] });
        }])
        .on("placed on them", [call("submit", { verdicts: ["ex_smokers", "doubters", "still_wheezing"].map((key) => ({ key, awareness: "problem_aware", confidence: "medium", standing: key === "ex_smokers" ? "avatar" : "emerging", best_competitor_angle: key === "ex_smokers" ? "Still coughing after you quit?" : null, skepticism: key === "ex_smokers" ? 3 : 5, skepticism_review_ids: [] })) })])
        .steps(400)),
    );
    const sources = new Map<ReviewSourceName, ReviewSource>([["judgeme", new Reviews("judgeme", 90)]]);
    const pipeline = new Pipeline([new ReviewStage(new ReviewListings(new OneStore(), new AmazonListingFinder()), sources, 500), new AvatarStage()]);
    const { settings, traces } = TestSettings.make();
    const app = new App({ settings, traces, store: pg.store, services: new FakeWeb(PAGES, SEARCH_HITS).services(), models: faux.models, generations: new NoBilling(), visuals: new FakeVisuals(), pipeline });
    const driver = new RunDriver(app);

    const runId = await driver.start({ product_url: PRODUCT_URL });
    const saved = await pg.store.ads.save("admin", runId, product.id, [
      { hit: ad("w1"), ring: "same_problem" as const, found_by: "lungs" },
      { hit: ad("d1", 4, "inactive"), ring: "direct_competitor" as const, found_by: "same tincture" },
      { hit: ad("b1", 90), ring: "same_buyer" as const, found_by: "joint pain, 50+" },
    ], new Map());
    const [winning, dead, sameBuyer] = ["w1", "d1", "b1"].map((id) => saved.find((one) => one.trendtrack_ad_id === id));
    const reading = { avatar: "ex-smokers", claim_type: "identity" as const, awareness: "problem_aware" as const, mechanism: null, proof_types: [], offer: null, objections_handled: [], emotion: "relief", risk_flags: [], proof_kinds: ["testimonial" as const], offer_kinds: ["guarantee" as const], emotion_kind: "relief" as const, landing_kind: "advertorial" as const, copy_structure: "personal_story" as const, value_prop: "root_cause" as const };
    await pg.store.ads.saveReading(winning!.id, { ...reading, ad_id: winning!.id });
    await pg.store.ads.saveReading(dead!.id, { ...reading, ad_id: dead!.id });
    await pg.store.ads.saveReading(sameBuyer!.id, { ...reading, ad_id: sameBuyer!.id });
    await pg.store.ads.setSegments(new Map([[winning!.id, "Ex-smokers who still cough"], [dead!.id, "Ex-smokers who still cough"], [sameBuyer!.id, "Joint pain over 60"]]));
    const done = await driver.confirmAndFinish(runId, { product_url: PRODUCT_URL, competitors: RESOLUTION.competitors.slice(0, 1).map(({ why: _why, ...pick }) => pick) });

    expect(done.run.stage_status.avatars).toMatchObject({ status: "completed", error: "" });
    expect(reader.batches).toBe(3);
    expect(readerOptions.length).toBeGreaterThan(0);
    expect(readerOptions.every((options) => options?.reasoning === "low" && options.maxTokens === AgentRunner.MAX_OUTPUT_TOKENS)).toBe(true);
    expect(reader.refusal).toContain("1 review(s) in this batch are not assigned");
    expect(splitter.split).toEqual(["ex_smokers", "doubters"]);
    expect(splitter.refusal).toContain("create doubters: another avatar already has that key; choose another");
    expect(done.run.stage_status.avatars.summary).toBe("From reviews: 2 avatars and 1 sub-avatars from 90 reviews (90 assigned, 0 about no buyer, 1 sub-avatar(s) under 5 reviews folded into their parent); 3 of 3 ads placed on them. From ads: 2 avatars. Gaps: 2 themes across 2 avatars.");
    const { avatars, quotes } = await driver.json<{ avatars: StoredAvatar[]; quotes: { avatar_id: string; rating: number; kind: string }[] }>(`/runs/${runId}/avatars`);
    const byKey = Object.fromEntries(avatars.map((avatar) => [avatar.key, avatar]));
    expect(byKey.ex_smokers).toMatchObject({ source: "reviews", review_count: 54, demand_share: 0.6, supply_share: 1, win_rate: 2 / 3, standing: "avatar", confidence: "medium" });
    expect(byKey.ex_smokers!.profile.gaps).toEqual([expect.objectContaining({ kind: "pain", theme: "the night cough keeps a spouse awake" })]);
    expect(quotes.filter((q) => q.kind === "gap" && q.avatar_id === byKey.ex_smokers!.id)).toHaveLength(1);
    const fromAds = avatars.filter((avatar) => avatar.source === "ads").map((avatar) => [avatar.name, avatar.ad_count, avatar.standing, avatar.profile.market, avatar.profile.quote_ad_ids!.length]);
    expect(fromAds).toEqual([["Ex-smokers who still cough", 2, "emerging", "client_market", 1], ["Joint pain over 60", 1, "emerging", "same_buyer", 1]]);
    expect(sameBuyerRefusal).toContain("review_avatar joint_pain is not one of the client's avatars");
    const jointPain = avatars.find((avatar) => avatar.source === "ads" && avatar.profile.market === "same_buyer")!;
    expect(jointPain.profile.same_buyer).toEqual({ review_avatar: "ex_smokers", shared: "Over 60 and long past quitting.", borrow: ["a doctor's story opening"] });
    expect(avatars.find((avatar) => avatar.source === "ads" && avatar.profile.market === "client_market")!.profile.same_buyer).toBeUndefined();
    expect(byKey.ex_smokers!.profile.best_competitor_angle).toBe("Still coughing after you quit?");
    expect(byKey.ex_smokers!.profile).toMatchObject({ skepticism: 3, awareness_by_channel: { meta_ads: { problem_aware: 3 } } });
    expect(byKey.doubters!.profile.skepticism).toBe(5);
    expect(byKey.doubters).toMatchObject({ review_count: 36, ad_count: 0, win_rate: null, standing: "emerging" });
    expect(byKey.one_story).toBeUndefined();
    expect(byKey.still_wheezing).toMatchObject({ parent_id: byKey.ex_smokers!.id, review_count: 18, demand_share: 0.2 });
    expect(quotes.filter((q) => q.avatar_id === byKey.still_wheezing!.id).map((q) => q.rating)).toEqual([5]);
    expect(quotes.filter((q) => q.avatar_id === byKey.doubters!.id).every((q) => q.rating <= 2)).toBe(true);
    const snapshots = await pg.db.all<{ batch: number }>("SELECT batch FROM avatar_memories WHERE run_id = ? ORDER BY batch", [runId]);
    expect(snapshots.map((s) => s.batch)).toEqual([1, 2, 3, 4, 5]);
  });

  it("stops when the run is stopped mid-read: no judge, and no avatars saved", async () => {
    let runId = "";
    let judged = false;
    const reader = new Reader();
    const driver: { current: RunDriver | null } = { current: null };
    const stopThenRead = async (messages: Message[]) => {
      if (reader.batches === 1 && messages.at(-1)?.role !== "toolResult") await driver.current!.api(`/runs/${runId}/stop`, {});
      return reader.respond(messages);
    };
    const faux = new Faux();
    faux.provider.setResponses(
      new ScriptedAgents()
        .on("Product url:", [call("web_fetch", { url: PRODUCT_URL }), call("web_search", { query: "x" }), call("submit", RESOLUTION)])
        .on("Product: ", [call("submit", { amazon_url: null, why: "store only" })])
        .on("The client's product:", [stopThenRead, stopThenRead])
        .on("placed on them", [() => ((judged = true), call("submit", { verdicts: [] }))])
        .steps(400),
    );
    const sources = new Map<ReviewSourceName, ReviewSource>([["judgeme", new Reviews("judgeme", 130)]]);
    const pipeline = new Pipeline([new ReviewStage(new ReviewListings(new OneStore(), new AmazonListingFinder()), sources, 500), new AvatarStage()]);
    const { settings, traces } = TestSettings.make();
    const app = new App({ settings, traces, store: pg.store, services: new FakeWeb(PAGES, SEARCH_HITS).services(), models: faux.models, generations: new NoBilling(), visuals: new FakeVisuals(), pipeline });
    driver.current = new RunDriver(app);

    runId = await driver.current.start({ product_url: PRODUCT_URL });
    const done = await driver.current.confirmAndFinish(runId, { product_url: PRODUCT_URL, competitors: RESOLUTION.competitors.slice(0, 1).map(({ why: _why, ...pick }) => pick) });

    expect(done.run.stage_status.avatars.status).toBe("cancelled");
    expect(judged).toBe(false);
    const { avatars } = await driver.current.json<{ avatars: StoredAvatar[] }>(`/runs/${runId}/avatars`);
    expect(avatars).toEqual([]);
  });
});
