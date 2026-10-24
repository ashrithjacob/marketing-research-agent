/** Stage 4: the market reader reads sophistication off this run's ads and a competitor's history, labels buyer evidence from every source by awareness, is refused when it cites what no tool showed it, and code counts the claims and each channel's shares. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Message } from "@earendil-works/pi-ai";

import { MarketStage, Pipeline } from "../src/agent/index.js";
import { AvatarJudge } from "../src/agent/stages/avatars/avatar-judge.js";
import type { ActorLimits, ActorRun, ActorRunner, AdHit, AdLibrary, AdPage, AdQuery, ArchivedPage, MarketAssessment, PageArchive, SearchSuggestions, SuggestionSource } from "../src/domain/index.js";
import { AvatarTally } from "../src/extract/index.js";
import { App } from "../src/http/index.js";

import { Faux, FakeVisuals, FakeWeb, NoBilling, TestSettings } from "./fakes.js";
import { DROPS_URL, PAGES, PRODUCT_URL, RESOLUTION, SEARCH_HITS } from "./mullevia.js";
import { PostgresStores } from "./postgres-stores.js";
import { RunDriver } from "./run-driver.js";
import { ScriptedAgents } from "./scripted-agents.js";

const { call } = ScriptedAgents;

class History implements AdLibrary {
  readonly queries: AdQuery[] = [];
  async search(query: AdQuery): Promise<AdPage> {
    this.queries.push(query);
    return { hits: [History.hit("h1", "2023-02-01", 400, "inactive")], total: 1, credits: 2 };
  }

  static hit(id: string, first: string, days: number, status: string): AdHit {
    return {
      ad_id: id, advertiser: "LungClear", page_id: "1", landing_url: DROPS_URL, landing_domain: "lungclear.com", first_seen: first, last_seen: "", status, countries: ["US"], body: "Mullein supports your lungs.",
      ad_reach: null, page_reach_30d: null, page_live_ads: null, days_running: days, duplicates: 1, reach_delta_7d: null, reach_delta_30d: null, current_rank: null, is_eu: false, media_url: null, thumbnail_url: null, age_min: null, age_max: null, gender: null,
    };
  }
}

class Boxes implements SearchSuggestions {
  async suggest(seed: string, source: SuggestionSource): Promise<string[]> {
    return source === "google" ? ["why do i cough every morning", "mullein for lungs"] : [`${seed} drops`];
  }
}

class Archive implements PageArchive {
  async snapshots(url: string): Promise<ArchivedPage[]> {
    return [{ url, timestamp: "20210301000000" }, { url, timestamp: "20250301000000" }];
  }
  async read(page: ArchivedPage): Promise<string> {
    return page.timestamp.startsWith("2021") ? "Mullein supports your lungs" : "Dissolves trapped mucus at the source";
  }
}

class Actors implements ActorRunner {
  readonly actors: string[] = [];
  async billed(run: ActorRun): Promise<number | null> {
    return run.id.startsWith("memo23") ? 0.3 : run.id.startsWith("apt_marble") ? 0.02 : 0.01;
  }

  async run(actor: string, input: Record<string, unknown>, _limits: ActorLimits): Promise<ActorRun> {
    this.actors.push(actor);
    const done = { id: actor, status: "SUCCEEDED", finished_at: null };
    if (actor.startsWith("memo23")) return { ...done, items: (input.keywords as string[]).map((keyword) => ({ keyword, google_search_volume: keyword.startsWith("why") ? 1000 : 9000 })) };
    if (actor.startsWith("apt_marble")) return { ...done, items: [{ asin: "B1", title: "Mullein Drops Lung Detox", url: "https://amazon.com/dp/B1", keyword: "mullein drops", rating: 4.5, ratingsCount: 300, isSponsored: false, organicPosition: 1 }] };
    return { ...done, items: [{ submissionId: "p1", submissionType: "post", submissionUrl: "https://reddit.com/p1", subreddit: "r/COPD", title: "Does mullein actually work?", bodyText: "Tried it for a month.", score: 12 }] };
  }
}

const results = (messages: Message[]): string =>
  messages.filter((m) => m.role === "toolResult").map((m) => (typeof m.content === "string" ? m.content : m.content.map((part) => ("text" in part ? part.text : "")).join(""))).join("\n");
const ids = (messages: Message[], pattern: RegExp): string[] => [...results(messages).matchAll(pattern)].map((m) => m[1]!);

let pg: PostgresStores;
beforeAll(async () => {
  pg = await PostgresStores.start();
});
afterAll(async () => {
  await pg.stop();
});

describe("stage 4", () => {
  it("reads the stage off the ads and their history, labels buyer evidence on every channel, and code counts the claims and shares", async () => {
    let refusal = "";
    const submit = (messages: Message[], bad: boolean) => {
      const ads = ids(messages, /\[([0-9a-f]{16,})\] lungclear/g);
      const [problem, solution] = ids(messages, /\[(gq-\d+)\]/g);
      const read = {
        claim_groups: [{ key: "lung_support", claim: "supports your lungs", claim_type: "plain", ad_ids: [...ads, "h1", ...(bad ? ["ghost"] : [])] }],
        sophistication: { stage: 3, why: "LungClear moved from a plain claim in 2021 to a mechanism by 2025.", claim_group_keys: ["lung_support"], snapshot_ids: [ids(messages, /\[(ws-\d+)\]/g)[0]!], confidence: "medium" },
        labels: [
          { id: problem!, awareness: "problem_aware" },
          { id: solution!, awareness: "solution_aware" },
          { id: ids(messages, /\[(al-\d+)\]/g)[0]!, awareness: "solution_aware" },
          { id: ids(messages, /\[(rd-\d+)\]/g)[0]!, awareness: "solution_aware" },
          { id: ids(messages, /\[(lp-\d+)\]/g)[0]!, awareness: "problem_aware" },
          ...(bad ? [{ id: "h1", awareness: "product_aware" }] : []),
        ],
      };
      return call("submit", read);
    };
    const faux = new Faux();
    faux.provider.setResponses(
      new ScriptedAgents()
        .on("Product url:", [call("web_fetch", { url: PRODUCT_URL }), call("web_search", { query: "x" }), call("submit", RESOLUTION)])
        .on("The client:", [
          call("list_ads", {}),
          call("search_ad_history", { domain: "lungclear.com", sort_by: "longestRunning", created_before: "2024-01-01" }),
          call("page_history", { url: "lungclear.com" }),
          (messages) => call("read_snapshot", { snapshot_id: ids(messages, /\[(ws-\d+)\]/g)[0]! }),
          call("search_suggestions", { seed: "mullein for", source: "google" }),
          (messages) => call("search_volume", { query_ids: ids(messages, /\[(gq-\d+)\]/g) }),
          call("search_amazon", { keywords: ["mullein drops"] }),
          call("search_reddit", { keywords: ["mullein cough"] }),
          (messages) => call("read_landing", { ad_id: ids(messages, /\[([0-9a-f]{16,})\] lungclear/g)[0]! }),
          (messages) => submit(messages, true),
          (messages) => {
            refusal = JSON.stringify(messages.at(-1)?.content ?? "");
            return submit(messages, false);
          },
        ])
        .steps(),
    );
    const web = new FakeWeb(PAGES, SEARCH_HITS);
    const history = new History();
    const actors = new Actors();
    const { settings, traces } = TestSettings.make();
    const stage = new MarketStage({ ads: history, pages: web, suggestions: new Boxes(), archive: new Archive(), actors }, settings.prices, { historySearches: 4, paidCalls: 2 });
    const app = new App({ settings, traces, store: pg.store, services: web.services(), models: faux.models, generations: new NoBilling(), visuals: new FakeVisuals(), pipeline: new Pipeline([stage]) });
    const driver = new RunDriver(app);

    const product = await pg.store.products.upsert("admin", PRODUCT_URL, "Mullein Drops", "Mullevia");
    const runId = await driver.start({ product_url: PRODUCT_URL });
    const [ad] = await pg.store.ads.save("admin", runId, product.id, [History.hit("s1", "2025-04-01", 90, "active")], new Map());
    await pg.store.ads.saveRing(ad!.id, "direct_competitor", "same tincture");
    await pg.store.ads.saveReading(ad!.id, { ad_id: ad!.id, avatar: "ex-smokers", claim_type: "mechanism", awareness: "problem_aware", mechanism: "dissolves mucus", proof_types: [], offer: null, objections_handled: [], emotion: "relief", risk_flags: [], proof_kinds: ["testimonial"], offer_kinds: ["guarantee"], emotion_kind: "relief", landing_kind: "advertorial", copy_structure: "personal_story", bucket: "winning", bucket_why: "90 days" });
    const done = await driver.confirmAndFinish(runId, { product_url: PRODUCT_URL, competitors: RESOLUTION.competitors.slice(0, 1).map(({ why: _why, ...pick }) => pick) });

    expect(done.run.stage_status.sophistication).toMatchObject({ status: "completed", error: "" });
    expect(done.run.stage_status.sophistication.summary).toBe("Sophistication stage 3 of 5 (mechanism), medium confidence, from 1 claims across 1 brands. Awareness measured on 5 channels from 5 labelled items; 1 ad history searches, 3 Apify calls.");
    expect(refusal).toContain("cites ghost, which is not an ad from list_ads or search_ad_history");
    expect(refusal).toContain("h1 is an ad and takes no awareness label");
    expect(history.queries[0]).toMatchObject({ terms: ["lungclear.com"], searchIn: "domain", createdBefore: "2024-01-01" });
    const { market } = await driver.json<{ market: MarketAssessment }>(`/runs/${runId}/market`);
    expect(market.claims).toEqual([{ key: "lung_support", claim: "supports your lungs", claim_type: "plain", ads: 2, brands: ["lungclear.com"], first_seen: "2023-02-01", longest_days: 400, active: 1 }]);
    const channel = (name: string) => market.awareness.find((entry) => entry.channel === name);
    expect(channel("google_search")).toEqual({ channel: "google_search", items: 2, weighted_by_volume: true, shares: { problem_aware: 0.1, solution_aware: 0.9 } });
    expect(channel("meta_ads")).toMatchObject({ items: 1, weighted_by_volume: false, shares: { problem_aware: 1 } });
    expect(market.awareness.map((entry) => entry.channel).sort()).toEqual(["amazon_listings", "google_search", "landing_pages", "meta_ads", "reddit"]);
    const { charges } = await driver.json<{ charges: { service: string; item: string; usd: number | null; basis: string }[] }>(`/runs/${runId}/charges`);
    expect(charges.filter((c) => c.service === "apify").map((c) => [c.item, c.usd, c.basis])).toEqual([["memo23/keyword-metrics", 0.3, "billed"], ["apt_marble/amazon-search-results-scraper", 0.02, "billed"], ["coding-doctor-omar/reddit-scraper-pro", 0.01, "billed"]]);
  });
});

describe("stage 5's use of stage 4", () => {
  it("counts each avatar's reviews by the awareness stage 4 gave them, and refuses a skepticism verdict citing another avatar's review", () => {
    const awareness = AvatarTally.awareness([], ["r1", "r2", "r3"], [], new Map([["r1", "problem_aware"], ["r2", "problem_aware"], ["r9", "most_aware"]]));
    expect(awareness).toEqual({ reviews: { problem_aware: 2 } });
    const avatar = (key: string, reviews: string[]) => ({ key, parent: null, name: key, description: "", review_ids: reviews, quote_ids: [], ad_ids: [], pains: [], desires: [], triggers: [], prior_solutions: [], objections: [], outcomes: [], angles: [] });
    const memory = { batches_read: 1, avatars: [avatar("ex_smokers", ["r1"]), avatar("doubters", ["r2"])], unassigned_review_ids: [] };
    const verdict = (key: string, cited: string[]) => ({ key, awareness: "problem_aware" as const, confidence: "low" as const, standing: "emerging" as const, best_competitor_angle: null, skepticism: 4, skepticism_review_ids: cited });
    expect(AvatarJudge.problems({ verdicts: [verdict("ex_smokers", ["r2"]), verdict("doubters", ["r2"])] }, memory as never)).toEqual(["avatar ex_smokers cites review r2, which is not one of its reviews"]);
  });
});
