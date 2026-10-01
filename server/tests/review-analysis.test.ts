import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createModels } from "@earendil-works/pi-ai";
import { fauxAssistantMessage, fauxProvider, fauxToolCall } from "@earendil-works/pi-ai/providers/faux";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SqliteResearchStore } from "../src/adapters/index.js";
import { IssueSlices, IssueTally, ReviewAnalyst, ReviewCleaner, RunSupervisor } from "../src/agent/index.js";
import { Env } from "../src/config/index.js";
import type { AnalysedReview, Issue, LedgerReview, MiningTarget, ReviewAnalysis, ReviewTag, StoredRunReview } from "../src/domain/index.js";

const stored = (ref: string, star: number, text: string, target_id = "product"): StoredRunReview => ({
  run_id: "r",
  ref,
  target_id,
  source_id: "s",
  band_requested: star,
  platform: "amazon",
  review_key: ref,
  listing: "https://amazon.com/dp/B000000000",
  star,
  title: "",
  text,
  posted_at: "",
  verified: true,
  locator: "",
});

const analysed = (ref: string, star: number, target_id = "product"): AnalysedReview => ({
  ref,
  target_id,
  platform: "amazon",
  star,
  title: "",
  text: `review ${ref}`,
  locator: "",
});

const ISSUES: Issue[] = [
  { id: "too_big", label: "Pill too big", kind: "complaint", description: "" },
  { id: "no_effect", label: "No effect felt", kind: "complaint", description: "" },
  { id: "easy", label: "Easy to take", kind: "praise", description: "" },
];

describe("ReviewCleaner", () => {
  it("drops bodies under three words and the same review met on two listings", () => {
    const result = ReviewCleaner.clean([
      stored("a", 5, "Good product"),
      stored("b", 3, "The pill is far too big to swallow", "product"),
      stored("c", 3, "The pill is far too BIG to swallow!", "c1"),
      stored("d", 1, "The pill is far too big to swallow", "c1"),
    ]);
    expect(result.empty).toBe(1);
    expect(result.duplicates).toBe(1);
    expect(result.kept.map((r) => r.ref)).toEqual(["b", "d"]);
  });
});

describe("IssueTally", () => {
  const tag = (issues: string[], severity = 2): ReviewTag => ({ n: 0, issues, severity, off_product: false, new_label: "", new_kind: "complaint" });

  it("ranks a 3-star complaint above the same count of 1-star ones, and quotes the 3-star first", () => {
    const reviews = [analysed("a", 3), analysed("b", 1), analysed("c", 1), analysed("d", 1)];
    const tags = new Map([
      ["a", tag(["no_effect"])],
      ["b", tag(["too_big"])],
      ["c", tag(["no_effect"], 3)],
      ["d", tag(["too_big"])],
    ]);
    const [product] = new IssueTally(ISSUES, tags).products(reviews, [], "all");
    expect(product!.issues.map((i) => [i.issue_id, i.mentions, i.score])).toEqual([
      ["no_effect", 2, 7],
      ["too_big", 2, 4],
    ]);
    expect(product!.issues[0]!.quotes).toEqual(["a", "c"]);
  });

  it("gives each complaint its share of the product's complaints, and counts stars", () => {
    const reviews = [analysed("a", 3), analysed("b", 2), analysed("c", 5), analysed("d", 4, "c1")];
    const tags = new Map([["a", tag(["too_big"])], ["b", tag(["too_big", "no_effect"])], ["c", tag(["easy"], 1)], ["d", tag(["no_effect"])]]);
    const [product, rival] = new IssueTally(ISSUES, tags).products(
      reviews,
      [{ id: "product", name: "Ours", relation: "product", form: "tablet", actives: ["d3"], url: "", brand: "", amazon_url: "", trustpilot: "", note: "" }],
      "all",
    );
    expect(product!.name).toBe("Ours");
    expect(product!.stars).toEqual([0, 1, 1, 0, 1]);
    expect(product!.complaints).toBe(3);
    expect(product!.issues.find((i) => i.issue_id === "too_big")!.share).toBeCloseTo(2 / 3);
    expect(product!.issues.find((i) => i.issue_id === "easy")!.share).toBeCloseTo(1 / 3);
    expect(rival!.target_id).toBe("c1");
  });
});

const everything = (analysis: ReviewAnalysis) =>
  analysis.slices.find((slice) => slice.source === "all" && slice.group === "product")!.ranked;

describe("IssueSlices", () => {
  it("ranks Amazon apart from other sites, and direct competitors apart from indirect", () => {
    const review = (ref: string, target_id: string, platform: "amazon" | "trustpilot"): AnalysedReview => ({ ...analysed(ref, 3, target_id), platform });
    const tag = (issues: string[]): ReviewTag => ({ n: 0, issues, severity: 2, off_product: false, new_label: "", new_kind: "complaint" });
    const roster: MiningTarget[] = [
      { id: "c1", name: "Direct", relation: "direct", form: "tablet", actives: ["d3"], url: "", brand: "", amazon_url: "", trustpilot: "", note: "" },
      { id: "c2", name: "Indirect", relation: "indirect", form: "gummy", actives: ["d3"], url: "", brand: "", amazon_url: "", trustpilot: "", note: "" },
    ];
    const tags = new Map([["a", tag(["too_big"])], ["b", tag(["no_effect"])], ["c", tag(["too_big"])]]);
    const built = new IssueSlices(new IssueTally(ISSUES, tags), roster).build([
      review("a", "c1", "amazon"),
      review("b", "c1", "trustpilot"),
      review("c", "c2", "amazon"),
    ]);
    const ids = (source: string, group: string) =>
      built.slices.find((s) => s.source === source && s.group === group)!.ranked.map((r) => [r.issue_id, r.mentions]);
    expect(built.slices).toHaveLength(9);
    expect(ids("all", "direct")).toEqual([["too_big", 1], ["no_effect", 1]]);
    expect(ids("amazon", "direct")).toEqual([["too_big", 1]]);
    expect(ids("other", "direct")).toEqual([["no_effect", 1]]);
    expect(ids("all", "product")).toEqual([]);
    expect(ids("amazon", "indirect")).toEqual([["too_big", 1]]);
    expect(built.products.filter((p) => p.source === "other").map((p) => p.target_id)).toEqual(["c1"]);
    expect(Object.keys(built.quotes).sort()).toEqual(["a", "b", "c"]);
  });
});

describe("ReviewAnalyst", () => {
  let dir: string;
  let store: SqliteResearchStore;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "mra-analysis-"));
    store = new SqliteResearchStore(join(dir, "research.db"));
  });

  afterEach(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });

  const catalogue = () =>
    fauxAssistantMessage(fauxToolCall("record_issue_catalogue", { issues: ISSUES }), { stopReason: "toolUse" });
  const spiral = () => fauxAssistantMessage("", { stopReason: "length" });

  function setup(backups: string[] = []) {
    const faux = fauxProvider({ provider: "openrouter", models: [{ id: "faux-model" }, ...backups.map((id) => ({ id }))] });
    const models = createModels();
    models.setProvider(faux.provider);
    const settings = { ...Env.settings(), model: "faux-model", backupModels: backups };
    const supervisor = new RunSupervisor({ store, settings, models });
    const run = store.createRun({ workspaceId: "admin", brief: { product: "Vitamin D" }, model: "faux-model", rejectKinds: [], judgementIds: [], nodes: ["review_mining"], stage: 3 });
    const review = (ref: string, star: number, text: string): LedgerReview => ({ ref, pull: "p", platform: "amazon", review_key: ref, listing: "", star, title: "", text, posted_at: "", verified: true, locator: "" });
    store.saveRunReviews(run.id, {
      pulls: [{ handle: "p", source_id: "s", target_id: "product", platform: "amazon", listing: "", band_requested: null, fetched_at: "", archived: false, total_reviews: null, total_ratings: null, gap: null }],
      reviews: [review("r1", 3, "The capsule is huge and hard to swallow"), review("r2", 1, "I got a bottle of fish oil instead"), review("r3", 5, "ok")],
    });
    const analyst = new ReviewAnalyst(store, settings, supervisor.models, supervisor.costs);
    const analyse = async () => {
      analyst.start(store.getRun(run.id)!);
      await analyst.waitFor(run.id);
      await supervisor.close();
      return analyst.read(run.id)!;
    };
    return { faux, analyse };
  }

  it("catalogues, tags in bulk, drops off-product reviews, and stores the result", async () => {
    const { faux, analyse } = setup();
    const tagged: string[] = [];
    faux.setResponses([
      catalogue(),
      (context) => {
        tagged.push(JSON.stringify(context));
        return fauxAssistantMessage(
          fauxToolCall("record_review_tags", { tags: [{ n: 0, issues: ["too_big"], severity: 2, off_product: false, new_label: "", new_kind: "complaint" }, { n: 1, issues: [], severity: 1, off_product: true, new_label: "", new_kind: "complaint" }] }),
          { stopReason: "toolUse" },
        );
      },
    ]);
    const result = await analyse();
    expect(result.error).toBe("");
    expect(result.status).toBe("done");
    expect(result.llm_calls).toBe(2);
    expect(tagged).toHaveLength(1);
    expect(result.cleaning).toEqual({ fetched: 3, duplicates: 0, empty: 1, off_product: 1, untagged: 0, kept: 1 });
    expect(everything(result).map((i) => i.issue_id)).toEqual(["too_big"]);
    expect(result.quotes[everything(result)[0]!.quotes[0]!]!.text).toContain("huge");
  });

  it("retries a reply that ran out of tokens on the next model in the chain", async () => {
    const { faux, analyse } = setup(["backup-model"]);
    const asked: string[] = [];
    faux.setResponses([
      catalogue(),
      spiral(),
      (_context, _options, _state, model) => {
        asked.push(model.id);
        return fauxAssistantMessage(fauxToolCall("record_review_tags", { tags: [{ n: 0, issues: ["too_big"], severity: 2, off_product: false, new_label: "", new_kind: "complaint" }] }), { stopReason: "toolUse" });
      },
    ]);
    const result = await analyse();
    expect(result.status).toBe("done");
    expect(asked).toEqual(["backup-model"]);
    expect(result.cleaning.untagged).toBe(0);
  });

  it("counts a batch that fails every attempt as unread instead of failing the analysis", async () => {
    const { faux, analyse } = setup();
    faux.setResponses([catalogue(), spiral(), spiral(), spiral()]);
    const result = await analyse();
    expect(result.status).toBe("done");
    expect(result.cleaning).toEqual({ fetched: 3, duplicates: 0, empty: 1, off_product: 0, untagged: 2, kept: 0 });
  });

  it("keeps a point the catalogue missed: the tagger names it, one merge call makes it an issue", async () => {
    const { faux, analyse } = setup();
    const merged: string[] = [];
    faux.setResponses([
      catalogue(),
      fauxAssistantMessage(
        fauxToolCall("record_review_tags", {
          tags: [{ n: 0, issues: ["too_big"], severity: 2, off_product: false, new_label: "Smells fishy", new_kind: "complaint" }],
        }),
        { stopReason: "toolUse" },
      ),
      (context) => {
        merged.push(JSON.stringify(context));
        return fauxAssistantMessage(
          fauxToolCall("record_issue_merge", {
            new_issues: [{ id: "fishy_smell", label: "Fishy smell", kind: "complaint", description: "Says it smells of fish." }],
            mapping: [{ proposed: "Smells fishy", issue_id: "fishy_smell" }],
          }),
          { stopReason: "toolUse" },
        );
      },
    ]);
    const result = await analyse();
    expect(result.status).toBe("done");
    expect(merged[0]).toContain("Smells fishy (complaint, 1 review)");
    expect(result.issues.map((i) => i.id)).toContain("fishy_smell");
    expect(everything(result).map((i) => i.issue_id).sort()).toEqual(["fishy_smell", "too_big"]);
  });

  it("skips the merge call when every point fit the catalogue", async () => {
    const { faux, analyse } = setup();
    faux.setResponses([
      catalogue(),
      fauxAssistantMessage(fauxToolCall("record_review_tags", { tags: [{ n: 0, issues: ["too_big"], severity: 2, off_product: false, new_label: "", new_kind: "complaint" }] }), { stopReason: "toolUse" }),
    ]);
    const result = await analyse();
    expect(result.llm_calls).toBe(2);
    expect(result.issues).toHaveLength(ISSUES.length);
  });
});
