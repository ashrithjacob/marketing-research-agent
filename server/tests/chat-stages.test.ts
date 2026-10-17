/**
 * The chat's view of a brand's research and its way to stages 2 and 3 (decided 2026-10-15):
 * the operator sees what each stage found and could not, is offered only the next step or the
 * gaps, and starts product truth or customer voice on the product's delivered stage 1. The stage
 * runs are a fake `start`: nothing here calls a model or a paid service.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { SqlResearchStore } from "../src/adapters/index.js";
import { BrandResearch, ChatReviews, ChatStages, LiveRuns, PlanDesk, PlanStages, StageBriefDesk, StageBriefTemplate, TaskEvents } from "../src/agent/index.js";
import { MARKET_TRUTH_AGENTS, PRODUCT_TRUTH_AGENTS, Scope, type Brief, type CardDraft, type RunRequest } from "../src/domain/index.js";
import { productPacket } from "./fixtures.js";
import { SqliteStores } from "./sqlite-stores.js";

let dir: string;
let store: SqlResearchStore;
let started: RunRequest[];
let chat: ChatStages;
let research: BrandResearch;

const BRIEF: Brief = { product: "", url: "https://mullevia.example/products/drops", market: "", notes: "" };
const BRAND = "site:mullevia.example";

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "mra-chat-stages-"));
  store = await SqliteStores.open(join(dir, "research.db"));
  started = [];
  const start = async (request: RunRequest, workspaceId: string) => {
    started.push(request);
    return (await store.createRun({ workspaceId, brief: request.brief as unknown as Record<string, unknown>, model: "m", rejectKinds: [], judgementIds: [], nodes: request.nodes, stage: request.nodes.includes("review_mining") ? 3 : request.nodes.includes("tam_sam") ? 4 : 2 })).id;
  };
  const stages = new PlanStages({ store, runs: new LiveRuns(store), start, reviewsPerBand: 50, reuseDays: 183 }, new TaskEvents());
  chat = new ChatStages(store, store.plans, stages, start);
  research = new BrandResearch(store);
});

afterEach(async () => {
  await store.close();
  rmSync(dir, { recursive: true, force: true });
});

async function stageRun(stage: number, status: string, packet: Record<string, unknown> = productPacket()): Promise<string> {
  const run = await store.createRun({ workspaceId: "admin", brief: BRIEF as never, model: "m", rejectKinds: [], judgementIds: [], nodes: ["product_data"], stage });
  await store.updateRun(run.id, { status, packet });
  return run.id;
}

const report = async () => JSON.parse(await research.report("admin", BRAND)) as { stages: Record<string, any>; next_steps: string[] }[];

describe("what the chat sees of a brand", () => {
  it("offers stage 1 when nothing ran, and says so in plain terms", async () => {
    expect(await research.report("admin", BRAND)).toBe("Nothing has been researched for this brand yet. The next step is stage 1, market research.");
    await stageRun(1, "failed", {});
    expect((await report())[0]!.next_steps).toEqual(["Market research (propose_stage 1)."]);
  });

  it("sees a delivered stage 1 with what it could not find, and offers its gaps and stage 2, never stage 1 again", async () => {
    await stageRun(1, "completed");
    const [product] = await report();
    expect(product!.stages["market research"]).toMatchObject({ status: "completed", figures: { not_found: productPacket().gaps.length } });
    expect(product!.stages["market research"].not_found[0]).toMatch(/^product_data: .*not published on the product page$/);
    expect(product!.stages["customer truth"]).toBe("not run");
    expect(product!.next_steps.map((s: string) => s.split(":")[0])).toEqual(["Plug market research's gaps", "Product truth (propose_stage 2)"]);
    expect(product!.next_steps.join(" ")).not.toMatch(/Market research \(propose_stage 1\)/);
  });

  it("offers market truth after product truth, then customer voice only when the gate did not say drop, then offers customer truth once customer voice delivered", async () => {
    await stageRun(1, "completed", productPacket({ gaps: [] }));
    await stageRun(2, "completed", { gaps: [] });
    expect((await report())[0]!.next_steps).toEqual(["Market truth (propose_stage 4): market size, offers, sophistication, breaking point, and the viability gate. No paid Amazon search; it decides whether customer voice is worth paying for."]);
    const verdict = (word: string) => ({ gaps: [], attributes: [{ id: "at1", node: "viability", key: "verdict", value: `${word} — because`, source_id: "s" }] });
    const four = await stageRun(4, "completed", verdict("drop"));
    expect((await report())[0]!.next_steps).toEqual(["The viability gate said drop: tell the owner why, from its criteria. Offer customer voice only if the owner asks for it anyway."]);
    await store.updateRun(four, { packet: verdict("Reposition") });
    expect((await report())[0]!.next_steps).toEqual(["Customer voice (start_customer_voice): the expensive step, paid Amazon review pulls behind the owner's approval. The gate said reposition: say what to reposition first."]);
    await stageRun(3, "completed", { gaps: [] });
    expect((await report())[0]!.next_steps).toEqual([expect.stringMatching(/^Customer truth \(propose_stage 5\)/)]);
  });

  it("waits while a stage still runs", async () => {
    await stageRun(1, "completed");
    await stageRun(2, "running", {});
    expect((await report())[0]!.next_steps).toEqual(["product truth is still running: wait for it."]);
  });
});

describe("stages 2, 3 and 4 from the chat", () => {
  it("starts market truth only on delivered product truth, as one stage-4 run, and refuses to redo it unasked", async () => {
    await stageRun(1, "completed");
    await expect(chat.start("admin", BRAND, 4)).rejects.toThrow(/gate needs product truth/);
    await stageRun(2, "completed", {});
    expect(await chat.start("admin", BRAND, 4)).toMatch(/^Started market truth for .*, run [0-9a-f]+\.$/);
    expect(started.map((r) => r.nodes)).toEqual([["tam_sam", "offers", "sophistication", "breaking_point", "viability"]]);
    await store.updateRun((await store.listRuns(Scope.of("admin"), 9)).find((r) => r.stage === 4)!.id, { status: "completed" });
    await expect(chat.start("admin", BRAND, 4)).rejects.toThrow(/already has this stage/);
  });

  it("starts product truth on the product's delivered stage 1, and refuses to redo it unasked", async () => {
    const one = await stageRun(1, "completed");
    expect(await chat.start("admin", BRAND, 2)).toMatch(/^Started product truth for https:\/\/mullevia\.example\/products\/drops, run [0-9a-f]+\.$/);
    expect(started.map((r) => r.nodes)).toEqual([["mechanism", "dose_vs_study", "claim_limits", "cogs_refills"]]);
    expect((await store.plans.list(Scope.of("admin"), 5))[0]).toMatchObject({ status: "approved", stage_one_run_id: one });
    await store.updateRun((await store.listRuns(Scope.of("admin"), 5)).find((r) => r.stage === 2)!.id, { status: "completed" });
    await expect(chat.start("admin", BRAND, 2)).rejects.toThrow(/already has this stage/);
  });

  it("puts customer voice behind product truth and the plan's own checks, and refuses what cannot run", async () => {
    await expect(chat.start("admin", BRAND, 2)).rejects.toThrow(/has no research yet/);
    await stageRun(1, "completed");
    await expect(chat.start("admin", BRAND, 3)).rejects.toThrow(/customer voice needs product truth/);
    await stageRun(2, "completed", {});
    expect(await chat.start("admin", BRAND, 3)).toBe("Customer voice for https://mullevia.example/products/drops: review mining needs the champion and the competitors stage 1 found; the plan's stage 1 has none.");
    expect(started).toEqual([]);
    await expect(chat.start("admin", BRAND, 5)).rejects.toThrow(/customer truth reads a completed/);
  });
});

describe("review analysis from the chat", () => {
  it("analyses the product's newest delivered customer voice, once it has finished mining, and nothing before it ran", async () => {
    const started: string[] = [];
    let live = "";
    const reviews = new ChatReviews(store, { start: async (run) => (started.push(run.id), { status: "running" } as never) }, (runId) => runId === live);
    await expect(reviews.analyse("admin", BRAND)).rejects.toThrow(/has no research yet/);
    await stageRun(1, "completed");
    await expect(reviews.analyse("admin", BRAND)).rejects.toThrow(/customer voice has to run first/);
    const mined = await stageRun(3, "completed", {});
    live = mined;
    await expect(reviews.analyse("admin", BRAND)).rejects.toThrow(/still mining reviews/);
    live = "";
    expect(await reviews.analyse("admin", BRAND)).toMatch(/^Analysing .*: running\./);
    expect(started).toEqual([mined]);
  });
});

describe("stage briefs", () => {
  const opened: CardDraft[] = [];
  const desk = () => new StageBriefDesk(store, {} as PlanDesk, chat, async (_ws, draft) => void opened.push(draft));

  it("writes product truth's brief from what its agents look for, refuses a stage that cannot run, and puts customer voice to its own card", async () => {
    opened.length = 0;
    await expect(desk().propose("admin", BRAND, { stage: 2 })).rejects.toThrow(/has no research yet/);
    await stageRun(1, "completed");
    await desk().propose("admin", BRAND, { stage: 2, landed_unit_cost: 4.1, currency: "USD" });
    const [card] = opened;
    expect(card!.title).toBe("Run product truth for mullevia.example/products/drops?");
    for (const section of ["## The formula", "## How each ingredient works", "## Doses against the studies", "## What ads may claim", "## Prices and refills", "## Your guidance"]) expect(card!.body).toContain(section);
    expect(card!.action).toMatchObject({ kind: "stage_brief", stage: 2, brand: BRAND, inputs: { landed_unit_cost: 4.1, currency: "USD" }, fresh: false });
    await expect(desk().propose("admin", BRAND, { stage: 3 })).rejects.toThrow(/start_customer_voice/);
  });

  it("runs product truth with the approved brief as its notes and the owner's landed cost, and opens on that brief next time", async () => {
    opened.length = 0;
    await stageRun(1, "completed");
    await desk().propose("admin", BRAND, { stage: 2, landed_unit_cost: 4.1, currency: "USD" });
    const action = opened[0]!.action as Extract<CardDraft["action"], { kind: "stage_brief" }>;
    expect(await desk().run("admin", action, "Only the US label, please.")).toMatch(/^Started product truth/);
    expect(started.at(-1)).toMatchObject({ brief: { notes: "Only the US label, please." }, inputs: { landed_unit_cost: 4.1, currency: "USD" } });
    await store.updateRun((await store.listRuns(Scope.of("admin"), 9)).find((r) => r.stage === 2)!.id, { status: "completed" });
    await expect(desk().propose("admin", BRAND, { stage: 2 })).rejects.toThrow(/already has this stage/);
    await desk().propose("admin", BRAND, { stage: 2, fresh: true });
    expect(opened.at(-1)!.body).toBe("Only the US label, please.");
  });
});

describe("the brief the owner reads", () => {
  it("is written in the owner's words for every stage: no tool names, no code formatting, no record syntax", () => {
    const briefs = [
      StageBriefTemplate.of(1, StageBriefTemplate.roles(["champion", "product", "competitors", "category"]), "x"),
      StageBriefTemplate.of(2, StageBriefTemplate.roles([...PRODUCT_TRUTH_AGENTS]), "x"),
      StageBriefTemplate.of(4, StageBriefTemplate.roles([...MARKET_TRUTH_AGENTS]), "x"),
    ];
    for (const brief of briefs) {
      expect(brief).not.toMatch(/`|record_|separated by|\\\|/);
      expect(brief).toContain("## Your guidance");
    }
  });
});
