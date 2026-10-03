/**
 * The run lifecycle.
 *
 * Driven by pi's faux provider rather than a live model: the thing under test is
 * what the supervisor does with what comes back, and a real model would make
 * that non-deterministic and slow.
 */
import { Scope } from "../src/domain/index.js";

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createModels, getCurrentSystemPrompt, getCurrentTools, type AssistantMessage, type JsonValue, type MutableModels } from "@earendil-works/pi-ai";
import { fauxAssistantMessage, fauxProvider, fauxToolCall, type FauxResponseStep } from "@earendil-works/pi-ai/providers/faux";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { OpenRouterPrices } from "../src/adapters/index.js";
import { RunSupervisor } from "../src/agent/index.js";
import { COMPETITORS_DELIVERABLE, CheckProblems, RejectKinds, Roles, StageOnePlans } from "../src/domain/index.js";
import { DEFAULT_RETRY, Retries } from "../src/agent/retry.js";
import { RoleChecks } from "../src/agent/role-checks.js";
import { DeliverableChecks } from "../src/extract/index.js";
import { LimitClose } from "../src/agent/limit-close.js";
import { RowRepair } from "../src/agent/row-repair.js";
import { RunFindings } from "../src/agent/run-findings.js";
import {
  type Judgement,
  type RunRequest,
  runRequestSchema,
} from "../src/domain/index.js";
import { SqliteResearchStore } from "../src/adapters/index.js";
import { Env, type Settings } from "../src/config/index.js";
import { minimalPacket, recordCalls, recorded, reviewPacket, services, productPacket } from "./fixtures.js";
import { HUEL_PAGE } from "./trustpilot-pages.js";

const MODEL_ID = "faux-model";
const FAST_RETRY = { attempts: 3, baseMs: 0, capMs: 0 };

let dir: string;
let store: SqliteResearchStore;
let settings: Settings;
let models: MutableModels;
let faux: ReturnType<typeof fauxProvider>;
let supervisor: RunSupervisor;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "mra-runner-"));
  store = new SqliteResearchStore(join(dir, "research.db"));
  settings = { ...Env.settings(), model: MODEL_ID, corpusPath: join(dir, "corpus") };
  faux = fauxProvider({ provider: "openrouter", models: [{ id: MODEL_ID }] });
  models = createModels();
  models.setProvider(faux.provider);
  // Fast retries: the real policy waits 2s, 4s, 8s, and a test that drives a
  // provider error would sit through it.
  supervisor = new RunSupervisor({ store, settings, models, retry: FAST_RETRY });
});

afterEach(async () => {
  await supervisor.close();
  await store.close();
  rmSync(dir, { recursive: true, force: true });
});

/** A url brief scoped to product_data: no champion step, one agent, so a scripted run is deterministic. */
function request(overrides: Partial<RunRequest> = {}): RunRequest {
  return runRequestSchema.parse({
    brief: { product: "MagnaCalm 400mg", url: "https://magnacalm.example/products/glycinate-400" },
    nodes: ["product_data"],
    ...overrides,
  });
}

/** Start a run scripted by `steps`, and wait for it to settle. */
async function runWith(steps: FauxResponseStep[], req: RunRequest = request()): Promise<string> {
  faux.setResponses(steps);
  const runId = (await supervisor.start(req, "admin"));
  await supervisor.waitFor(runId);
  return runId;
}

/** The text of the tool result that answered `toolCallId`, as the model saw it. */
async function toolAnswer(runId: string, name: string): Promise<string[]> {
  return (await store
    .listLlmCalls(runId))
    .flatMap((call) => call.input as any[])
    .filter((m) => m.role === "toolResult" && m.toolName === name)
    .map((m) => m.content.map((c: any) => c.text).join(""));
}

/** A run with a champion step: the champion agent records the source and the reference, then the competitors agent records the rest. */
function championThen(packet: Record<string, any>): FauxResponseStep[] {
  const { sources, competitor_reference, ...rest } = packet;
  return [...recorded({ sources, competitor_reference }), ...recorded({ ...rest, sources: [] })];
}

/** Scripts keyed by agent, answered by whichever agent asks: the step-2 agents run side by side, so one shared queue would interleave. */
function byAgent(scripts: Record<string, FauxResponseStep[]>): FauxResponseStep[] {
  const total = Object.values(scripts).reduce((n, steps) => n + steps.length, 0);
  const answer: FauxResponseStep = async (context, options, state, model) => {
    const agent = /You are the `(\w+)` agent/.exec(getCurrentSystemPrompt(context.messages) ?? "")?.[1] ?? "";
    const next = scripts[agent]?.shift();
    if (!next) return fauxAssistantMessage(`no script left for ${agent}`);
    return typeof next === "function" ? (await next(context, options, state, model)) : next;
  };
  return Array.from({ length: total }, () => answer);
}

describe("settling a run", () => {
  it("stores the packet assembled from the ledger and completes", async () => {
    const runId = await runWith(recorded(productPacket()));
    const run = (await store.getRun(runId))!;
    expect(run.status).toBe("completed");
    expect((run.packet as any).attributes[0].key).toBe("dose_per_serving");
    expect(run.error).toBe("");
    expect(run.packet_source).toBe("ledger");
    expect((await store.listEvents(runId)).map((e) => e.kind)).toContain("packet.ready");
  });

  it("marks a run whose ledger breaks the contract `invalid`, not `failed`", async () => {
    // The agent finished and produced something, and what it produced broke the
    // contract. That is the most informative failure there is.
    const runId = await runWith([...recorded(productPacket({ gaps: [] })), fauxAssistantMessage("Done.")]);
    const run = (await store.getRun(runId))!;
    expect(run.status).toBe("invalid");
    expect(run.error).toMatch(/gap list is empty/);
    expect((await store.listEvents(runId)).map((e) => e.kind)).toContain("packet.invalid");
  });

  it("keeps and shows the packet of an `invalid` run, so what passed is not lost to what did not", async () => {
    const runId = await runWith([...recorded(productPacket({ gaps: [] })), fauxAssistantMessage("Done.")]);
    const run = (await store.getRun(runId))!;
    expect(run.status).toBe("invalid");
    expect((run.packet as any).attributes.map((a: any) => a.key)).toEqual(["dose_per_serving"]);
    expect(run.packet_source).toBe("ledger");
  });

  it("at settlement, retracts a row that breaks the contract into a gap and completes with the rest", async () => {
    const stray = { node: "product_data", key: "price", value: "£14.99", source_id: "sha256:never-recorded" };
    const runId = await runWith([
      fauxAssistantMessage(recordCalls(productPacket({ attributes: [...minimalPacket().attributes, stray] })), { stopReason: "toolUse" }),
      fauxAssistantMessage("Done."),
    ]);
    const run = (await store.getRun(runId))!;
    expect(run.status).toBe("completed");
    const price = (await store.findings.list(runId)).find((row) => row.kind === "attribute" && row.payload.key === "price")!;
    expect(price.retracted_at).not.toBe("");
    expect((run.packet as any).attributes.map((a: any) => a.key)).toEqual(["dose_per_serving"]);
    expect((run.packet as any).gaps.map((g: any) => g.missing)).toContainEqual(
      expect.stringMatching(new RegExp(`^attribute ${price.id} retracted when the run settled: .*sha256:never-recorded`)),
    );
  });

  it("marks a prose-only run invalid", async () => {
    const runId = await runWith([fauxAssistantMessage("I looked into it and I think the market is crowded.")]);
    const run = (await store.getRun(runId))!;
    expect(run.status).toBe("invalid");
    expect(run.error).toMatch(/gap list is empty/);
  });

  it("settles from the ledger a run that stopped without calling finish", async () => {
    // A DeepSeek run at 208k input tokens wrote "let me write the JSON now" 56
    // times and ended its turn without it. Its findings are in the ledger now.
    const runId = await runWith([
      fauxAssistantMessage(recordCalls(productPacket()), { stopReason: "toolUse" }),
      fauxAssistantMessage("I have enough. Let me finalize."),
    ]);
    const run = (await store.getRun(runId))!;
    expect(run.status).toBe("completed");
    expect(run.packet_source).toBe("ledger");
    expect((await store.listLlmCalls(runId))).toHaveLength(2);
  });

  it("refuses a bad record on its own small turn, and records the corrected one", async () => {
    const packet = productPacket();
    const bad = { ...packet.sources[0], kind: "marketplace" };
    const runId = await runWith([
      fauxAssistantMessage(fauxToolCall("record_source", { item: bad }), { stopReason: "toolUse" }),
      ...recorded(packet),
    ]);
    expect((await toolAnswer(runId, "record_source"))[0]).toMatch(/^NOT RECORDED — kind: .*received 'marketplace'/);
    expect((await toolAnswer(runId, "record_source"))[1]).toMatch(/^RECORDED src\d+/);
    expect((await store.getRun(runId))!.status).toBe("completed");
  });

  it("records a champion with no ranking on a url brief (run 8a02bed6)", async () => {
    // The prompt says a url brief needs no ranking; the schema used to refuse
    // the null runner-up that instruction produces.
    const reference = {
      name: "Mullein Drops",
      form: "liquid",
      actives: ["mullein"],
      icp: "adults with a cough",
      source_id: "sha256:aaa",
      runner_up_name: null,
      runner_up_reviews: null,
    };
    const packet = productPacket({
      competitor_reference: reference,
      gaps: [
        { node: "competitors", missing: "no competitor researched", would_need: "time" },
        { node: "competitors", missing: "saturation: direct: no competitor researched", would_need: "time" },
        { node: "competitors", missing: "saturation: indirect_form: no competitor researched", would_need: "time" },
        { node: "competitors", missing: "saturation: indirect_active: no competitor researched", would_need: "time" },
      ],
      nodes: [{ node: "competitors", status: "incomplete", done_criterion_met: false, why: "test" }],
    });
    packet.sources[0].node = "competitors";
    delete packet.attributes;
    const runId = await runWith(
      championThen(packet),
      request({ brief: { product: "", url: "https://mullevia.com/products/mullein-drops", market: "", notes: "" }, nodes: ["competitors"] }),
    );
    expect((await toolAnswer(runId, "record_reference"))[0]).toMatch(/^RECORDED ref\d+/);
    const run = (await store.getRun(runId))!;
    expect(run.status).toBe("completed");
    expect((run.packet as any).competitor_reference.runner_up_name).toBeNull();
    expect((run.packet as any).brief.product).toBe("Mullein Drops");
  });

  it("takes the packet's brief from the run, not from the model", async () => {
    const runId = await runWith(recorded(productPacket()), request({ brief: { product: "mullein", url: "https://x.example", market: "", notes: "" } }));
    expect(((await store.getRun(runId))!.packet as any).brief.product).toBe("mullein");
  });

  it("refuses a row recorded against a node outside the run's scope", async () => {
    const runId = await runWith(
      [...recorded(productPacket()), fauxAssistantMessage("Done.")],
      request({ nodes: ["category_data"] }),
    );
    expect((await toolAnswer(runId, "record_source"))[0]).toMatch(/NOT RECORDED — this belongs to product_data, which is outside this run's scope/);
  });

  it("sums usage across every turn rather than reporting only the last", async () => {
    // §11 asks what a run costs; a run is dozens of turns and the final message
    // carries only its own.
    const runId = await runWith(recorded(productPacket()));
    const usage = (await store.getRun(runId))!.usage as any;
    expect(usage.totalTokens).toBeGreaterThan(0);
  });

  it("fails the run when the model in .env is not one the provider has", async () => {
    await supervisor.close();
    supervisor = new RunSupervisor({ store, settings: { ...settings, model: "no-such-model" }, models, retry: FAST_RETRY });
    await expect(supervisor.start(request(), "admin")).rejects.toThrow(/unknown model "no-such-model"/);
    const run = (await store.listRuns(Scope.everything))[0]!;
    expect(run.status).toBe("failed");
    expect(run.error).toMatch(/unknown model/);
  });

  it("moves to the next backup in .env when the stream dies mid-answer", async () => {
    const backup = "backup/model";
    await supervisor.close();
    faux = fauxProvider({ provider: "openrouter", models: [{ id: MODEL_ID }, { id: backup }] });
    models = createModels();
    models.setProvider(faux.provider);
    supervisor = new RunSupervisor({ store, settings: { ...settings, backupModels: [backup] }, models, retry: FAST_RETRY });
    faux.setResponses([
      fauxAssistantMessage("", { stopReason: "error", errorMessage: "Upstream idle timeout exceeded" }),
      ...recorded(productPacket()),
    ]);
    const runId = (await supervisor.start(request(), "admin"));
    await supervisor.waitFor(runId);

    const resumed = (await store.listEvents(runId)).find((e) => e.kind === "run.resumed")!.payload as any;
    expect(resumed).toMatchObject({ from: MODEL_ID, to: backup, attempt: 1 });
    expect((await store.listLlmCalls(runId)).map((c) => c.model)).toEqual([MODEL_ID, backup, backup]);
    expect((await store.getRun(runId))!.status).toBe("completed");
  });

  it("fails the run when a backup in .env is not a model the provider has", async () => {
    await supervisor.close();
    supervisor = new RunSupervisor({ store, settings: { ...settings, backupModels: ["no/such-backup"] }, models, retry: FAST_RETRY });
    await expect(supervisor.start(request(), "admin")).rejects.toThrow(/unknown model "no\/such-backup"/);
  });

  it("takes the model from .env only: a run request cannot name one", async () => {
    expect(() => runRequestSchema.parse({ brief: { product: "x" }, model: "other/model" })).toThrow(/model/);
    const runId = (await supervisor.start(request(), "admin"));
    expect((await store.getRun(runId))!.model).toBe(MODEL_ID);
  });
});

describe("finish", () => {
  it("ends the agent the moment finish passes, and settles the run from the ledger", async () => {
    const runId = await runWith([...recorded(productPacket()), fauxAssistantMessage("never reached")]);
    const run = (await store.getRun(runId))!;
    expect(run.status).toBe("completed");
    expect(run.packet_source).toBe("ledger");
    const ended = (await store.listEvents(runId)).find((e) => e.kind === "agent.ended")!;
    expect(ended.payload).toMatchObject({ agent_id: "product", status: "complete" });
    expect((await store.listLlmCalls(runId))).toHaveLength(2);
    expect((await store.listPacketChecks(runId)).map((c) => c.valid)).toEqual([true]);
  });

  it("completes from the ledger a run that died after recording everything", async () => {
    // Run 8a02bed6 had its research in hand when the provider cut it at ~300s,
    // four times. The findings are the ledger's now, not the lost turn's.
    const runId = await runWith([
      fauxAssistantMessage(recordCalls(productPacket()), { stopReason: "toolUse" }),
      ...Array.from({ length: 5 }, () =>
        fauxAssistantMessage("", { stopReason: "error", errorMessage: "terminated" }),
      ),
    ]);
    const run = (await store.getRun(runId))!;
    expect(run.status).toBe("completed");
    expect(run.packet_source).toBe("ledger");
    const early = (await store.listEvents(runId)).find((e) => e.kind === "run.ended_early")!;
    expect(early.payload.error).toBe("product: terminated");
  });

  it("hands back the problems, and the run carries on to a fixed finish", async () => {
    const packet = productPacket();
    const runId = await runWith([
      ...recorded({ ...packet, gaps: [] }),
      fauxAssistantMessage(packet.gaps.map((item: JsonValue) => fauxToolCall("record_gap", { item })), { stopReason: "toolUse" }),
      fauxAssistantMessage(fauxToolCall("finish", {}), { stopReason: "toolUse" }),
    ]);
    expect((await toolAnswer(runId, "finish"))[0]).toMatch(/^NOT FINISHED — 10 problems\. [\s\S]*1\. `name` is neither recorded nor gapped[\s\S]*10\. gap list is empty/);
    const checks = (await store.listPacketChecks(runId));
    expect(checks.map((c) => c.valid)).toEqual([false, true]);
    expect((await store.listEvents(runId)).filter((e) => e.kind === "packet.checked")).toHaveLength(2);
    expect((await store.getRun(runId))!.status).toBe("completed");
  });

  it("stops at five checks, and settles the ledger as it stands", async () => {
    // An agent that cannot fix a cross-row problem would otherwise resend its
    // whole context after every failed finish until it stopped of its own accord.
    const finishTurn = () => fauxAssistantMessage(fauxToolCall("finish", {}), { stopReason: "toolUse" });
    const runId = await runWith([
      fauxAssistantMessage(recordCalls({ ...productPacket(), gaps: [] }), { stopReason: "toolUse" }),
      ...Array.from({ length: 6 }, finishTurn),
      fauxAssistantMessage("never reached"),
    ]);
    const answers = (await toolAnswer(runId, "finish"));
    expect(answers).toHaveLength(5);
    expect(answers[4]).toMatch(/Checks used: 5 of 5\.$/);
    expect((await store.listLlmCalls(runId))).toHaveLength(7);
    const run = (await store.getRun(runId))!;
    expect(run.status).toBe("invalid");
    expect(run.error).toMatch(/gap list is empty/);
    expect((await store.listPacketChecks(runId)).map((c) => c.valid)).toEqual([false, false, false, false, false, false]);
  });

  it("leaves a retracted row out of the packet", async () => {
    const packet = productPacket();
    const extra = { ...packet.attributes[0], key: "price", value: "£9.99" };
    const runId = await runWith([
      fauxAssistantMessage([fauxToolCall("record_attribute", { item: extra })], { stopReason: "toolUse" }),
      fauxAssistantMessage(fauxToolCall("retract", { id: "at1", why: "misread" }), { stopReason: "toolUse" }),
      ...recorded(packet),
    ]);
    expect((await toolAnswer(runId, "retract"))[0]).toBe("RETRACTED at1");
    const keys = ((await store.getRun(runId))!.packet as any).attributes.map((a: any) => a.key);
    expect(keys).toEqual(["dose_per_serving"]);
  });

  it("replaces a row recorded again under the same key", async () => {
    const packet = productPacket();
    const runId = await runWith([
      fauxAssistantMessage(fauxToolCall("record_source", { item: { ...packet.sources[0], title: "old" } }), { stopReason: "toolUse" }),
      ...recorded(packet),
    ]);
    expect((await toolAnswer(runId, "record_source"))[1]).toMatch(/replaces src1/);
    expect(((await store.getRun(runId))!.packet as any).sources).toHaveLength(1);
    expect((await store.findings.list(runId)).find((row) => row.id === "src1")!.retracted_why).toMatch(/replaced by/);
  });
});

describe("cost", () => {
  function costsFrom(replies: (url: string) => { status: number; body?: unknown }) {
    const fetch = (async (input: string | URL | Request) => {
      const { status, body } = replies(String(input));
      return new Response(JSON.stringify(body ?? {}), { status });
    }) as typeof globalThis.fetch;
    return new OpenRouterPrices({ apiKey: "k", fetch, lookupDelaysMs: [] });
  }

  it("hands pi-ai the live rates, and keeps no calculated dollar figure on the run or its calls", async () => {
    const costs = costsFrom(() => ({
      status: 200,
      body: { data: [{ id: MODEL_ID, pricing: { prompt: "0.000001", completion: "0.000002" } }] },
    }));
    await costs.refreshPrices();
    supervisor = new RunSupervisor({ store, settings, models, costs });
    let seen: any;
    faux.setResponses([
      (_context, _options, _state, model) => {
        seen = model.cost;
        return recorded(productPacket())[0]!;
      },
      recorded(productPacket())[1]!,
    ]);
    const runId = (await supervisor.start(request(), "admin"));
    await supervisor.waitFor(runId);
    expect(seen.input).toBeCloseTo(1, 10);
    expect(seen.output).toBeCloseTo(2, 10);
    const usage = (await store.getRun(runId))!.usage as any;
    expect(usage.totalTokens).toBeGreaterThan(0);
    expect(usage.cost).toBeUndefined();
    expect(usage.pricing).toBeUndefined();
    expect((await store.listLlmCalls(runId)).map((call) => (call.usage as any).cost)).toEqual([undefined, undefined]);
  });

  it("records what OpenRouter billed for every turn, after the run settles", async () => {
    const costs = costsFrom((url) => ({
      status: 200,
      body: { data: { total_cost: url.includes("gen-2") ? 0.02 : 0.01 } },
    }));
    supervisor = new RunSupervisor({ store, settings, models, costs });
    faux.setResponses([
      // A tool call keeps the loop going; a text-only reply would end the run
      // after one turn.
      fauxAssistantMessage(recordCalls(productPacket()), { responseId: "gen-1", stopReason: "toolUse" }),
      fauxAssistantMessage(fauxToolCall("finish", {}), { responseId: "gen-2", stopReason: "toolUse" }),
    ]);
    const runId = (await supervisor.start(request(), "admin"));
    await supervisor.waitFor(runId);
    const run = (await store.getRun(runId))!;
    expect(run.status).toBe("completed");
    const usage = run.usage as any;
    expect(usage.billed.total).toBeCloseTo(0.03, 10);
    expect(usage.billed).toMatchObject({ turns: 2, resolved: 2 });
    expect(usage.totalTokens).toBeGreaterThan(0);
    const kinds = (await store.listEvents(runId)).map((e) => e.kind);
    expect(kinds.indexOf("run.billed")).toBeGreaterThan(kinds.indexOf("run.completed"));
  });

  describe("after the run settles, while its billing is still being read", () => {
    /**
     * A run stays in the supervisor's live map until its `/generation` lookups
     * answer — up to ~30s in production, where they 404 for ~4s. Here they are
     * held open until `release()`, so the window is as long as the test needs.
     */
    function heldBilling() {
      let release!: () => void;
      const released = new Promise<void>((r) => (release = r));
      const fetch = (async (_input: unknown, init?: RequestInit) => {
        // Also ends on abort: if an assertion fails before `release()`, the
        // supervisor's `close()` in afterEach must still be able to finish.
        const aborted = new Promise<void>((r) =>
          init?.signal?.addEventListener("abort", () => r(), { once: true }),
        );
        await Promise.race([released, aborted]);
        init?.signal?.throwIfAborted();
        return new Response(JSON.stringify({ data: { total_cost: 0.01 } }), { status: 200 });
      }) as typeof globalThis.fetch;
      return { costs: new OpenRouterPrices({ apiKey: "k", fetch, lookupDelaysMs: [] }), release };
    }

    async function settledButLive(): Promise<{ runId: string; release: () => void }> {
      const { costs, release } = heldBilling();
      supervisor = new RunSupervisor({ store, settings, models, costs });
      faux.setResponses(recorded(productPacket(), { responseId: "gen-1" }));
      const runId = (await supervisor.start(request(), "admin"));
      while ((await store.getRun(runId))!.status === "running") await new Promise((r) => setTimeout(r, 5));
      expect((await store.getRun(runId))!.status).toBe("completed");
      expect(supervisor.isLive(runId)).toBe(true); // the window this is about
      return { runId, release };
    }

    it("refuses a stop, and the run stays completed", async () => {
      // It used to be overwritten with `stopping` and never settled again.
      const { runId, release } = await settledButLive();
      await expect(supervisor.stop(runId)).rejects.toThrow(/already finished \(completed\)/);
      release();
      await supervisor.waitFor(runId);
      expect((await store.getRun(runId))!.status).toBe("completed");
      const kinds = (await store.listEvents(runId)).map((e) => e.kind);
      expect(kinds).not.toContain("run.stopping");
      expect(kinds).toContain("run.billed");
    });

    it("refuses a steer rather than reporting it applied mid-run", async () => {
      const { runId, release } = await settledButLive();
      const judgement = (await store.addJudgement("admin", { kind: "custom", text: "prefer UK", rejects_kinds: [] }));
      await expect(supervisor.steer(runId, judgement)).rejects.toThrow(/already finished/);
      release();
      await supervisor.waitFor(runId);
      expect((await store.listEvents(runId)).map((e) => e.kind)).not.toContain("run.steered");
    });
  });

  it("records no billed cost when no turn had a generation id", async () => {
    supervisor = new RunSupervisor({ store, settings, models, costs: costsFrom(() => ({ status: 500 })) });
    const runId = await runWith(recorded(productPacket()));
    expect(((await store.getRun(runId))!.usage as any).billed).toBeUndefined();
  });
});

describe("events", () => {
  const recordThenSay = () => [
    fauxAssistantMessage(recordCalls(productPacket()), { stopReason: "toolUse" }),
    fauxAssistantMessage("Everything is recorded."),
  ];

  it("emits the kinds the cockpit renders", async () => {
    const runId = await runWith(recordThenSay());
    const kinds = (await store.listEvents(runId)).map((e) => e.kind);
    expect(kinds[0]).toBe("run.started");
    expect(kinds).toContain("message.delta");
    expect(kinds).toContain("run.completed");
  });

  it("streams assistant text once, not once per update", async () => {
    // The agent re-emits the whole message on each update; appending deltas
    // blindly multiplies the output by the number of updates.
    const runId = await runWith(recordThenSay());
    const deltas = (await store
      .listEvents(runId))
      .filter((e) => e.kind === "message.delta")
      .map((e) => String((e.payload as any).delta))
      .join("");
    expect(deltas).toBe("Everything is recorded.");
    expect((await store.getRun(runId))!.output).toBe(`[product]\n${deltas}`);
  });

  it("replays every event to a subscriber that arrives late", async () => {
    const runId = await runWith(recorded(productPacket()));
    expect((await store.listEvents(runId)).length).toBeGreaterThan(2);
    expect(supervisor.isLive(runId)).toBe(false);
  });
});

describe("judgements", () => {
  it("only ever widens the rejection set", () => {
    // A standing rule must never quietly make the corpus wider (spec.md §6.2-4).
    const judgement: Judgement = {
      id: "j1",
      workspace_id: "admin",
      kind: "source_rule",
      text: "no competitor marketing",
      rejects_kinds: ["competitor_marketing"],
      active: true,
      applied_count: 0,
      created_at: "",
    };
    const kinds = RejectKinds.effective(request(), [judgement]);
    expect(kinds).toEqual(
      expect.arrayContaining(["seo_listicle", "review_roundup", "ai_generated", "competitor_marketing"]),
    );
  });

  it("lets an explicit reject_kinds replace the defaults", () => {
    expect(RejectKinds.effective(request({ reject_kinds: ["ai_generated"] }), [])).toEqual([
      "ai_generated",
    ]);
  });

  it("counts applications from the packet, not from the prompt", async () => {
    const judgement = (await store.addJudgement("admin", {
      kind: "source_rule",
      text: "no listicles",
      rejects_kinds: ["seo_listicle"],
    }));
    const packet = productPacket();
    packet.sources.push({
      id: "sha256:ddd",
      url: "https://top10.example/best",
      kind: "seo_listicle",
      admitted: false,
      admission_reason: "rejected by policy",
      node: "product_data",
    });
    await runWith(recorded(packet));
    expect((await store.listJudgements(Scope.everything)).find((j) => j.id === judgement.id)!.applied_count).toBe(1);
  });

  it("reaches the instructions of a run started after it", async () => {
    await store.addJudgement("admin", { kind: "custom", text: "prefer UK sources", rejects_kinds: [] });
    faux.setResponses([
      (context) => {
        const turn = JSON.stringify(context.messages);
        expect(turn).toContain("prefer UK sources");
        return recorded(productPacket())[0]!;
      },
      recorded(productPacket())[1]!,
    ]);
    const runId = (await supervisor.start(request(), "admin"));
    await supervisor.waitFor(runId);
    expect((await store.getRun(runId))!.status).toBe("completed");
  });
});

describe("recovery", () => {
  it("settles a run the process stopped watching", async () => {
    // The agent lives in this process now, so a run that was `running` at
    // shutdown is dead, not resumable. Saying so beats a row stuck on `running`.
    const run = (await store.createRun({
      workspaceId: "admin",
      brief: { product: "x" },
      model: MODEL_ID,
      rejectKinds: [],
      judgementIds: [],
    }));
    await store.updateRun(run.id, { status: "running" });
    await supervisor.recoverRunsKilledByRestart();
    const settled = (await store.getRun(run.id))!;
    expect(settled.status).toBe("failed");
    expect(settled.error).toMatch(/restarted/);
  });

  it("leaves finished runs alone", async () => {
    const runId = await runWith(recorded(productPacket()));
    await supervisor.recoverRunsKilledByRestart();
    expect((await store.getRun(runId))!.status).toBe("completed");
  });
});

describe("stopping a run", () => {
  it("cancels a run that is still working", async () => {
    // The guard against stopping a settled run must not block the real thing.
    let turnStarted!: () => void;
    const started = new Promise<void>((r) => (turnStarted = r));
    faux.setResponses([
      // A turn that is still in flight when Stop arrives, and ends only on abort.
      async (_context, options) => {
        turnStarted();
        await new Promise<void>((resolve) => {
          if (options?.signal?.aborted) return resolve();
          options?.signal?.addEventListener("abort", () => resolve(), { once: true });
        });
        return fauxAssistantMessage("interrupted");
      },
    ]);
    const runId = (await supervisor.start(request(), "admin"));
    await started;

    await supervisor.stop(runId);
    expect((await store.getRun(runId))!.status).toBe("stopping");
    await supervisor.waitFor(runId);

    expect((await store.getRun(runId))!.status).toBe("cancelled");
    const kinds = (await store.listEvents(runId)).map((e) => e.kind);
    expect(kinds).toContain("run.stopping");
    expect(kinds).toContain("run.cancelled");
  });
});

describe("the LLM call trace", () => {
  /** A two-turn run: a tool call, then a closing reply. */
  function twoTurns() {
    faux.setResponses([
      fauxAssistantMessage(fauxToolCall("no_such_tool", { q: "x" }), {
        responseId: "gen-1",
        stopReason: "toolUse",
      }),
      fauxAssistantMessage("Nothing more to add.", { responseId: "gen-2" }),
    ]);
  }

  it("records every call, storing only what is new since the previous one", async () => {
    twoTurns();
    const runId = (await supervisor.start(request(), "admin"));
    await supervisor.waitFor(runId);

    const calls = (await store.listLlmCalls(runId));
    expect(calls.map((c) => c.seq)).toEqual([1, 2]);
    const [first, second] = calls as [any, any];

    // Call 1 carries the whole prompt: system, tools and the instructions.
    expect(first.system_prompt).toMatch(/You are the `product` agent/);
    expect(first.agent_id).toBe("product");
    expect(first.tools.map((t: any) => t.name)).toContain("web_fetch");
    expect(first.input).toHaveLength(1);
    expect(first.input[0].role).toBe("user");
    expect(JSON.stringify(first.input[0].content)).toContain("## Your task: the product's fact sheet");
    expect(first.output.content.some((c: any) => c.type === "toolCall")).toBe(true);
    expect(first.stop_reason).toBe("toolUse");

    // Call 2 stores only its own new messages: the answer it is continuing
    // from, and the tool's result — not the instructions again.
    expect(second.system_prompt).toBeNull();
    expect(second.tools).toBeNull();
    expect(second.context_reset).toBe(false);
    expect(second.context_messages).toBe(3);
    expect(second.input.map((m: any) => m.role)).toEqual(["assistant", "toolResult"]);
    expect(second.output.content[0].text).toBe("Nothing more to add.");
    expect(second.duration_ms).toBeGreaterThanOrEqual(0);
    expect(second.usage.totalTokens).toBeGreaterThan(0);

    const kinds = (await store.listEvents(runId)).map((e) => e.kind);
    expect(kinds.filter((k) => k === "llm.call")).toHaveLength(2);
    const summaryEvent = (await store.listEvents(runId)).find((e) => e.kind === "llm.call")!;
    expect(summaryEvent.payload).toMatchObject({ seq: 1, tool_calls: 1, stop_reason: "toolUse" });
    // The prompt stays out of the event stream.
    expect(JSON.stringify(summaryEvent.payload)).not.toContain("## Your task");
  });

  it("leaves a tool result's details out, because the model never sees them", async () => {
    twoTurns();
    const runId = (await supervisor.start(request(), "admin"));
    await supervisor.waitFor(runId);
    const toolResult = ((await store.listLlmCalls(runId))[1]!.input as any[]).find(
      (m) => m.role === "toolResult",
    );
    expect(toolResult).toBeDefined();
    expect(toolResult).not.toHaveProperty("details");
    expect(toolResult.content.length).toBeGreaterThan(0);
  });

  it("attaches what OpenRouter billed, and where the time went, to each call", async () => {
    const fetch = (async (input: string | URL | Request) =>
      new Response(
        JSON.stringify({
          data: {
            total_cost: String(input).includes("gen-2") ? 0.02 : 0.01,
            latency: 900,
            generation_time: 30000,
            native_tokens_reasoning: 1200,
            provider_name: "Parasail",
          },
        }),
        { status: 200 },
      )) as typeof globalThis.fetch;
    const costs = new OpenRouterPrices({ apiKey: "k", fetch, lookupDelaysMs: [] });
    supervisor = new RunSupervisor({ store, settings, models, costs });
    twoTurns();
    const runId = (await supervisor.start(request(), "admin"));
    await supervisor.waitFor(runId);
    const calls = (await store.listLlmCalls(runId));
    expect(calls.map((c) => c.billed_cost)).toEqual([0.01, 0.02]);
    expect(calls.map((c) => c.generation?.latency_ms)).toEqual([900, 900]);
    expect(calls[1]!.generation).toMatchObject({ generation_ms: 30000, reasoning_tokens: 1200 });
  });

  it("tags each tool event with the id of the tool call that asked for it", async () => {
    faux.setResponses([
      fauxAssistantMessage(fauxToolCall("record_source", { item: productPacket().sources[0] }), {
        responseId: "gen-1",
        stopReason: "toolUse",
      }),
      fauxAssistantMessage("Recorded.", { responseId: "gen-2" }),
    ]);
    const runId = (await supervisor.start(request(), "admin"));
    await supervisor.waitFor(runId);

    const [first, second] = (await store.listLlmCalls(runId)) as [any, any];
    const asked = first.output.content.find((b: any) => b.type === "toolCall").id;
    const answered = second.input.find((m: any) => m.role === "toolResult").toolCallId;
    const tagged = (await store
      .listEvents(runId))
      .filter((e) => e.kind === "tool.started" || e.kind === "tool.completed")
      .map((e) => (e.payload as any).tool_call_id);
    expect(asked).toBeTruthy();
    expect(answered).toBe(asked);
    expect(tagged).toEqual([asked, asked]);
    const completed = (await store.listEvents(runId)).find((e) => e.kind === "tool.completed")!.payload as any;
    expect(completed.inside.map((s: any) => s.name)).toContain("RecordTool.tool.execute");
  });

  it("records a call the provider failed, with its error", async () => {
    // 502 is retryable, so the run spends its budget before settling.
    faux.setResponses(
      Array.from({ length: 4 }, () =>
        fauxAssistantMessage("", { stopReason: "error", errorMessage: "upstream 502" }),
      ),
    );
    const runId = (await supervisor.start(request(), "admin"));
    await supervisor.waitFor(runId);
    const [call] = (await store.listLlmCalls(runId));
    expect(call!.stop_reason).toBe("error");
    expect(call!.error).toBe("upstream 502");
  });
});

describe("a stream that drops mid-run", () => {
  it("spaces its attempts with exponential backoff and jitter", () => {
    const policy = { attempts: 3, baseMs: 2000, capMs: 30000 };
    for (const [attempt, low, high] of [
      [1, 1000, 2000],
      [2, 2000, 4000],
      [3, 4000, 8000],
    ] as const) {
      const waits = Array.from({ length: 40 }, () => Retries.backoffMs(attempt, policy));
      expect(Math.min(...waits)).toBeGreaterThanOrEqual(low);
      expect(Math.max(...waits)).toBeLessThanOrEqual(high);
      // Jitter, not a constant: two runs that drop together must not retry in step.
      expect(new Set(waits).size).toBeGreaterThan(1);
    }
    // The cap binds before the exponent runs away.
    expect(Retries.backoffMs(20, policy)).toBeLessThanOrEqual(30000);
  });

  it("carries on from the transcript rather than losing the run", async () => {
    // Measured: a HappyWags run lost five completed turns and 15 tool calls to
    // a socket that closed 98s into turn 6 (undici reports `terminated`).
    faux.setResponses([
      fauxAssistantMessage("", { stopReason: "error", errorMessage: "terminated" }),
      ...recorded(productPacket()),
    ]);
    const runId = (await supervisor.start(request(), "admin"));
    await supervisor.waitFor(runId);

    const run = (await store.getRun(runId))!;
    expect(run.status).toBe("completed");
    expect(run.error).toBe("");
    const resumed = (await store.listEvents(runId)).find((e) => e.kind === "run.resumed");
    expect(resumed?.payload.error).toBe("terminated");
    // The continuation says the turn was lost, so tools are not re-run.
    expect(JSON.stringify((await store.listLlmCalls(runId))[1]!.input)).toContain("dropped part-way");
  });

  it("keeps trying to the end of its budget, then fails", async () => {
    faux.setResponses([
      fauxAssistantMessage("", { stopReason: "error", errorMessage: "terminated" }),
      fauxAssistantMessage("", { stopReason: "error", errorMessage: "socket hang up" }),
      fauxAssistantMessage("", { stopReason: "error", errorMessage: "502 bad gateway" }),
      fauxAssistantMessage("", { stopReason: "error", errorMessage: "terminated, again" }),
      recorded(productPacket())[0]!, // never reached: budget is 3
    ]);
    const runId = (await supervisor.start(request(), "admin"));
    await supervisor.waitFor(runId);

    const run = (await store.getRun(runId))!;
    expect(run.status).toBe("failed");
    expect(run.error).toBe("product: terminated, again");
    const resumed = (await store.listEvents(runId)).filter((e) => e.kind === "run.resumed");
    expect(resumed).toHaveLength(3);
    expect(resumed.map((e) => e.payload.attempt)).toEqual([1, 2, 3]);
  });

  it("recovers on a later attempt when the provider comes back", async () => {
    faux.setResponses([
      fauxAssistantMessage("", { stopReason: "error", errorMessage: "terminated" }),
      fauxAssistantMessage("", { stopReason: "error", errorMessage: "503 service unavailable" }),
      ...recorded(productPacket()),
    ]);
    const runId = (await supervisor.start(request(), "admin"));
    await supervisor.waitFor(runId);

    expect((await store.getRun(runId))!.status).toBe("completed");
    expect((await store.listEvents(runId)).filter((e) => e.kind === "run.resumed")).toHaveLength(2);
  });

  it("retries a wording it has never seen", () => {
    // The second live failure, and the reason the policy is a deny-list: pi-ai's
    // classifier does not recognise this one, and refusing it threw away 140k
    // tokens of research without a single retry.
    expect(
      Retries.isRetryable("Upstream error from Relace: The model stopped before completing the response."),
    ).toBe(true);
    for (const transient of [
      "terminated",
      "socket hang up",
      "502 bad gateway",
      "Provider returned error",
      "stream ended before message_stop",
      "something nobody has written down yet",
    ]) {
      expect(Retries.isRetryable(transient)).toBe(true);
    }
  });

  it("knows the errors that waiting cannot fix", () => {
    for (const terminal of [
      "402 insufficient_quota: your account is out of credit",
      "Quota exceeded for this month",
      "401 Unauthorized: invalid api key",
      "403 Forbidden",
      "This model's maximum context length is 128000 tokens",
      "invalid_request_error: unknown model",
      "flagged by the content policy",
    ]) {
      expect(Retries.isRetryable(terminal)).toBe(false);
    }
    expect(Retries.isRetryable("")).toBe(false);
  });

  it("settles from what it recorded when the retries run out, with no extra ask", async () => {
    // A run that recorded 30 pages' findings and then lost the provider has
    // them in the ledger; nothing needs asking for again.
    faux.setResponses([
      fauxAssistantMessage(recordCalls(productPacket()), { stopReason: "toolUse" }),
      ...Array.from({ length: 4 }, () =>
        fauxAssistantMessage("", { stopReason: "error", errorMessage: "Upstream error from Relace" }),
      ),
    ]);
    const runId = (await supervisor.start(request(), "admin"));
    await supervisor.waitFor(runId);

    const kinds = (await store.listEvents(runId)).map((e) => e.kind);
    expect(kinds.filter((k) => k === "run.resumed")).toHaveLength(3);
    expect((await store.getRun(runId))!.status).toBe("completed");
    expect((await store.listLlmCalls(runId))).toHaveLength(5);
  });

  it("does not retry an error that waiting cannot fix", async () => {
    // pi-ai's classifier: quota and billing exhaustion are terminal, and a
    // retry on a 93k-token transcript is a real charge for a certain failure.
    faux.setResponses([
      fauxAssistantMessage("", {
        stopReason: "error",
        errorMessage: "402 insufficient_quota: your account is out of credit",
      }),
      recorded(productPacket())[0]!,
    ]);
    const runId = (await supervisor.start(request(), "admin"));
    await supervisor.waitFor(runId);

    expect((await store.getRun(runId))!.status).toBe("failed");
    expect((await store.listEvents(runId)).some((e) => e.kind === "run.resumed")).toBe(false);
  });

  it("does not resume a run the operator stopped", async () => {
    faux.setResponses([
      async () => {
        // Stop lands while the turn is in flight, which is the real shape of it.
        await supervisor.stop(runId);
        return fauxAssistantMessage("", { stopReason: "error", errorMessage: "aborted" });
      },
      recorded(productPacket())[0]!,
    ]);
    const runId = (await supervisor.start(request(), "admin"));
    await supervisor.waitFor(runId);

    expect((await store.getRun(runId))!.status).toBe("cancelled");
    expect((await store.listEvents(runId)).some((e) => e.kind === "run.resumed")).toBe(false);
  });
});

describe("a run that covers part of the stage", () => {
  it("stores its scope, is prompted for it, and is not handed the review tools", async () => {
    let seen: { system?: string; tools: string[]; prompt: string } | undefined;
    faux.setResponses([
      (context) => {
        seen = {
          system: getCurrentSystemPrompt(context.messages),
          tools: getCurrentTools(context.messages).map((t) => t.name),
          prompt: JSON.stringify(context.messages.find((m) => m.role === "user")),
        };
        return fauxAssistantMessage("Nothing found.");
      },
    ]);
    // The token is set, so without the scope the review tools would be offered.
    supervisor = new RunSupervisor({ store, settings: { ...settings, apifyToken: "t" }, models });
    const runId = (await supervisor.start(request({ nodes: ["product_data"] }), "admin"));
    await supervisor.waitFor(runId);

    expect((await store.getRun(runId))!.nodes).toEqual(["product_data"]);
    expect(seen!.system).toMatch(/You are the `product` agent/);
    expect(seen!.prompt).toContain("## Your task: the product's fact sheet");
    expect(seen!.prompt).not.toContain("## Your task: the category's numbers");
    expect(seen!.tools).toEqual([
      "web_search",
      "web_fetch",
      "record_source",
      "record_attribute",
      "record_node_status",
      "record_gap",
      "retract",
      "read_ledger",
      "wait_for",
      "finish",
    ]);
    const started = (await store.listEvents(runId)).find((e) => e.kind === "run.started")!;
    expect(started.payload.nodes).toEqual(["product_data"]);
  });

  it("refuses a row for another node of the stage, and keeps the rest", async () => {
    // A category_data entry in a product_data run: same stage, wrong node.
    const packet = productPacket();
    packet.gaps.push({ node: "category_data", missing: "no three-year trend" });
    const runId = await runWith(recorded(packet), request({ nodes: ["product_data"] }));
    expect((await toolAnswer(runId, "record_gap")).at(-1)).toMatch(/NOT RECORDED — this belongs to category_data, which is outside this run's scope \(product_data\)/);
    const run = (await store.getRun(runId))!;
    expect(run.status).toBe("completed");
    expect((run.packet as any).gaps.every((gap: any) => gap.node === "product_data")).toBe(true);
  });

  it("refuses every row of the other stage's work", async () => {
    // Review mining is stage 2 (2026-09-21). A stage-1 agent has no excerpt tool
    // at all since 2026-09-30, and a review source is outside its node.
    const runId = await runWith([...recorded(reviewPacket()), fauxAssistantMessage("Done.")]);
    expect((await toolAnswer(runId, "record_excerpt"))[0]).toMatch(/Tool record_excerpt not found/);
    expect((await toolAnswer(runId, "record_source"))[0]).toMatch(/this belongs to review_mining, which is outside this run's scope/);
    const run = (await store.getRun(runId))!;
    expect(run.status).toBe("invalid");
    expect((await store.findings.list(runId))).toHaveLength(0);
  });

  it("offers the champion and competitors agents Amazon search, and neither the review tools", async () => {
    const tools: Record<string, string[]> = {};
    const note = (agent: string): FauxResponseStep => (context) => {
      tools[agent] = getCurrentTools(context.messages).map((t) => t.name);
      return fauxAssistantMessage("Nothing found.");
    };
    faux.setResponses(byAgent({ champion: [note("champion")], competitors: [note("competitors")] }));
    supervisor = new RunSupervisor({ store, settings: { ...settings, apifyToken: "t" }, models });
    const runId = (await supervisor.start(request({ nodes: ["competitors"] }), "admin"));
    await supervisor.waitFor(runId);
    expect(tools.champion!.slice(0, 3)).toEqual(["web_search", "web_fetch", "amazon_find_product"]);
    expect(tools.champion).toContain("record_reference");
    expect(tools.champion).not.toContain("wait_for");
    expect(tools.competitors!.slice(0, 3)).toEqual(["web_search", "web_fetch", "amazon_find_product"]);
    expect(tools.competitors).toContain("record_competitor");
    expect(tools.competitors).not.toContain("record_reference");
    expect(Object.values(tools).flat()).not.toContain("mine_reviews");
  });
});

describe("the two steps of a stage-1 run", () => {
  const genre = { product: "magnesium glycinate", url: "", market: "", notes: "" };
  const championPart = () => ({
    sources: [{ ...productPacket().sources[0], node: "product_data" }],
    competitor_reference: { name: "MagnaCalm Glycinate", form: "capsule", actives: ["magnesium glycinate"], icp: "adults with a cough", source_id: "sha256:aaa" },
    gaps: [{ node: "product_data", missing: "champion ranking unavailable: no Amazon search in this test" }],
  });
  const categoryPart = () => ({
    sources: [{ ...productPacket().sources[0], id: "sha256:cat", node: "category_data" }],
    measurements: [{ node: "category_data", metric: "category_size: respiratory supplements", value: 2.1, unit: "USD billion", period: "2025", source_id: "sha256:cat" }],
    nodes: [{ node: "category_data", status: "incomplete", done_criterion_met: false, why: "trend and seasonality gapped" }],
    gaps: [
      { node: "category_data", missing: "search_volume: no page publishes three years" },
      { node: "category_data", missing: "seasonality: no source states a peak" },
    ],
  });

  it("finds the champion first, then runs one agent per node side by side on the same ledger", async () => {
    let productPrompt = "";
    const product: FauxResponseStep[] = recorded(productPacket());
    const first = product[0] as AssistantMessage;
    product[0] = (context) => {
      productPrompt = JSON.stringify(context.messages.find((m: { role: string }) => m.role === "user"));
      return first;
    };
    const runId = await runWith(
      byAgent({ champion: recorded(championPart()), product, category: recorded(categoryPart()) }),
      request({ brief: genre, nodes: ["product_data", "category_data"] }),
    );
    const run = (await store.getRun(runId))!;
    expect(run.status).toBe("completed");
    const started = (await store.listEvents(runId)).filter((e) => e.kind === "agent.started").map((e) => e.payload.agent_id);
    expect(started).toEqual(["champion", "product", "category"]);
    const championEnded = (await store.listEvents(runId)).findIndex((e) => e.kind === "agent.ended" && e.payload.agent_id === "champion");
    const productStarted = (await store.listEvents(runId)).findIndex((e) => e.kind === "agent.started" && e.payload.agent_id === "product");
    expect(championEnded).toBeLessThan(productStarted);
    expect(productPrompt).toContain("MagnaCalm Glycinate");
    const packet = run.packet as any;
    expect(packet.competitor_reference.name).toBe("MagnaCalm Glycinate");
    expect(packet.attributes.map((a: any) => a.key)).toEqual(["dose_per_serving"]);
    expect(packet.measurements.map((m: any) => m.metric)).toEqual(["category_size: respiratory supplements"]);
    expect(packet.sources.map((x: any) => x.id).sort()).toEqual(["sha256:aaa", "sha256:cat"]);
    const agents = new Set((await store.findings.list(runId)).map((row) => row.agent_id));
    expect([...agents].sort()).toEqual(["category", "champion", "product"]);
    const calls = (await store.listLlmCalls(runId));
    expect(calls.map((c) => c.seq)).toEqual(calls.map((_, i) => i + 1));
    expect(new Set(calls.map((c) => c.agent_id))).toEqual(new Set(["champion", "product", "category"]));
  });

  it("skips the champion on a url brief without competitors, and runs it whenever competitors is in scope", () => {
    const url = { product: "", url: "https://mullevia.com", market: "", notes: "" };
    expect(StageOnePlans.of(url, ["product_data", "category_data"])).toEqual({ champion: false, parallel: ["product", "category"] });
    expect(StageOnePlans.of(url, ["competitors"])).toEqual({ champion: true, parallel: ["competitors"] });
    expect(StageOnePlans.of(genre, ["product_data"])).toEqual({ champion: true, parallel: ["product"] });
    expect(StageOnePlans.of(genre, ["product_data", "competitors", "category_data"]).parallel).toEqual(["product", "competitors", "category"]);
  });

  it("settles invalid when one agent's part breaks the contract, and names which", async () => {
    const runId = await runWith(
      byAgent({
        champion: recorded(championPart()),
        product: recorded(productPacket()),
        category: [...recorded({ ...categoryPart(), gaps: [] }), fauxAssistantMessage("Done.")],
      }),
      request({ brief: genre, nodes: ["product_data", "category_data"] }),
    );
    expect((await store.getRun(runId))!.status).toBe("invalid");
    expect((await store.getRun(runId))!.error).toMatch(/gap list is empty/);
    const ended = (await store.listEvents(runId)).filter((e) => e.kind === "agent.ended").map((e) => [e.payload.agent_id, e.payload.status]);
    expect(ended).toEqual(expect.arrayContaining([["product", "complete"], ["category", "incomplete"]]));
  });

  it("ends an agent at its turn limit and records what it left open as gaps", async () => {
    // workings_stage1.md 14: a limit on model turns, then gaps rather than more tries.
    const turn = () => fauxAssistantMessage(fauxToolCall("read_ledger", {}), { stopReason: "toolUse" });
    const runId = await runWith([...Array.from({ length: 15 }, turn), fauxAssistantMessage("never reached")]);
    expect((await store.listLlmCalls(runId))).toHaveLength(15);
    const limit = (await store.listEvents(runId)).find((e) => e.kind === "agent.limit_reached")!.payload as any;
    expect(limit).toMatchObject({ agent_id: "product", limit: 15 });
    expect(limit.gapped).toHaveLength(10);
    const run = (await store.getRun(runId))!;
    expect(run.status).toBe("completed");
    expect((run.packet as any).gaps.map((g: any) => g.missing)).toContain("price: not found within the 15-turn limit");
    expect((run.packet as any).nodes[0]).toMatchObject({ node: "product_data", status: "incomplete" });
  });

  it("at the turn limit, retracts the agent's rows that fail its check and keeps the rest, instead of rejecting the part", async () => {
    const stray = { node: "product_data", key: "price", value: "£14.99", source_id: "sha256:never-recorded" };
    const recordAll = fauxAssistantMessage(recordCalls(productPacket({ attributes: [...minimalPacket().attributes, stray] })), {
      stopReason: "toolUse",
    });
    const turn = () => fauxAssistantMessage(fauxToolCall("read_ledger", {}), { stopReason: "toolUse" });
    const runId = await runWith([recordAll, ...Array.from({ length: 14 }, turn), fauxAssistantMessage("never reached")]);
    const limit = (await store.listEvents(runId)).find((e) => e.kind === "agent.limit_reached")!.payload as any;
    const price = (await store.findings.list(runId)).find((row) => row.kind === "attribute" && row.payload.key === "price")!;
    expect(limit.retracted).toEqual([price.id]);
    expect(price.retracted_at).not.toBe("");
    const run = (await store.getRun(runId))!;
    expect(run.status).toBe("completed");
    const packet = run.packet as any;
    expect(packet.attributes.map((a: any) => a.key)).toEqual(["dose_per_serving"]);
    expect(packet.gaps.map((g: any) => g.missing)).toContainEqual(
      expect.stringMatching(new RegExp(`^attribute ${price.id} retracted at the 15-turn limit: .*sha256:never-recorded`)),
    );
  });

  it("at the turn limit, also retracts a `complete` status that a retracted row was holding up", async () => {
    const statusRow = { node: "competitors", status: "complete", done_criterion_met: true, why: "every kind saturated" };
    const curve = (cls: string) => ({
      node: "competitors",
      class: cls,
      curve: [{ source_id: "sha256:never-recorded", new_themes: 0, cumulative_themes: 1 }],
    });
    const runId = (await store.createRun({ workspaceId: "admin", brief: genre, model: "m", rejectKinds: [], judgementIds: [] })).id;
    const findings = new RunFindings(store.findings, runId, "competitors", ["competitors"]);
    await findings.record("saturation", curve("direct"));
    await findings.record("saturation", curve("indirect_form"));
    await findings.record("saturation", curve("indirect_active"));
    await findings.record("node_status", statusRow);
    const check = RoleChecks.done(Roles.of("competitors"), findings, { brief: genre, nodes: ["competitors"], markets: [] });
    const closed = (await new LimitClose(findings, new RowRepair(store.findings, runId, ["competitors"]), check, DeliverableChecks.of(COMPETITORS_DELIVERABLE, []), { node: "competitors", limit: 20, reports: true }).close());
    expect(closed.retracted.map((id) => id.replace(/\d+$/, ""))).toEqual(["sat", "sat", "sat", "ns"]);
    expect((await findings.own()).find((row) => row.kind === "node_status")!.payload).toMatchObject({ status: "incomplete" });
    expect(CheckProblems.texts((await check.problems())).filter((p) => /saturation|complete with no/.test(p))).toEqual([]);
  });

  it("puts an incomplete status in place of a retracted one, so a repaired node is never left unreported", async () => {
    const runId = (await store.createRun({ workspaceId: "admin", brief: genre, model: "m", rejectKinds: [], judgementIds: [] })).id;
    const findings = new RunFindings(store.findings, runId, "competitors", ["competitors"]);
    await findings.record("saturation", { node: "competitors", class: "direct", curve: [{ source_id: "sha256:never-recorded", new_themes: 0, cumulative_themes: 1 }] });
    await findings.record("node_status", { node: "competitors", status: "complete", done_criterion_met: true, why: "saturated" });
    const check = RoleChecks.done(Roles.of("competitors"), findings, { brief: genre, nodes: ["competitors"], markets: [] });
    await new RowRepair(store.findings, runId, ["competitors"]).repair(() => check.problems(), "when the run settled");
    expect((await findings.own()).filter((row) => row.kind === "node_status").map((row) => row.payload)).toEqual([
      expect.objectContaining({ status: "incomplete", why: "its status was retracted when the run settled" }),
    ]);
  });

  it("re-settles an old invalid run with no packet from its ledger, so a refresh shows what it found", async () => {
    const runId = (await store.createRun({ workspaceId: "admin", brief: { product: "MagnaCalm 400mg", url: "https://x", market: "UK", notes: "" }, model: "m", rejectKinds: [], judgementIds: [], nodes: ["product_data"] })).id;
    const product = new RunFindings(store.findings, runId, "product", ["product_data"]);
    const stray = { node: "product_data", key: "price", value: "£14.99", source_id: "sha256:never-recorded" };
    const packet = productPacket({ attributes: [...minimalPacket().attributes, stray] });
    for (const kind of ["source", "attribute", "node_status", "gap"] as const) {
      for (const item of packet[{ source: "sources", attribute: "attributes", node_status: "nodes", gap: "gaps" }[kind]]) await product.record(kind, item);
    }
    await store.updateRun(runId, { status: "invalid", error: "attribute cites source 'sha256:never-recorded', which is not in the packet" });
    expect((await store.getRun(runId))!.packet).toBeNull();
    const empty = (await store.createRun({ workspaceId: "admin", brief: genre, model: "m", rejectKinds: [], judgementIds: [] })).id;
    await store.updateRun(empty, { status: "invalid", error: "from before the ledger", output: "the raw output is all it has" });
    expect((await supervisor.resettleInvalidRuns())).toEqual([runId]);
    expect((await store.getRun(empty))!).toMatchObject({ status: "invalid", packet: null });
    const run = (await store.getRun(runId))!;
    expect(run.status).toBe("completed");
    expect((run.packet as any).attributes.map((a: any) => a.key)).toEqual(["dose_per_serving"]);
    expect((await supervisor.resettleInvalidRuns())).toEqual([]);
  });

  it("stops every agent at once, and starts no step-2 agent after a stop", async () => {
    let turnStarted!: () => void;
    const started = new Promise<void>((r) => (turnStarted = r));
    const hang: FauxResponseStep = async (_context, options) => {
      turnStarted();
      await new Promise<void>((resolve) => {
        if (options?.signal?.aborted) return resolve();
        options?.signal?.addEventListener("abort", () => resolve(), { once: true });
      });
      return fauxAssistantMessage("interrupted");
    };
    faux.setResponses(byAgent({ champion: [hang] }));
    const runId = (await supervisor.start(request({ brief: genre, nodes: ["product_data"] }), "admin"));
    await started;
    await supervisor.stop(runId);
    await supervisor.waitFor(runId);
    expect((await store.getRun(runId))!.status).toBe("cancelled");
    const agents = (await store.listEvents(runId)).filter((e) => e.kind === "agent.started").map((e) => e.payload.agent_id);
    expect(agents).toEqual(["champion"]);
  });
});

describe("the Amazon listings of a completed stage-1 run", () => {
  const brief = { product: "", url: "https://mullevia.com/products/mullein-drops", market: "", notes: "" };
  const packet = () =>
    productPacket({
      brief,
      sources: [{ ...productPacket().sources[0], node: "competitors" }],
      attributes: [],
      competitor_reference: { name: "Mullevia Mullein Drops", form: "liquid", actives: ["mullein"], icp: "adults with a cough", source_id: "sha256:aaa" },
      competitors: [
        {
          id: "c1", name: "Herb Pharm Mullein Blend", brand: "Herb Pharm", url: "https://herb-pharm.com/mullein",
          relation: "direct", form: "liquid", shared_actives: ["mullein"], form_as_printed: "as printed", icp_as_printed: "for coughs and chest congestion", source_id: "sha256:aaa",
          active_ingredients: [{ name_as_printed: "Mullein", name_normalised: "mullein" }],
        },
      ],
      nodes: [{ node: "competitors", status: "incomplete", done_criterion_met: false, why: "one competitor" }],
      gaps: [
        { node: "competitors", missing: "no ad library entries" },
        { node: "competitors", missing: "saturation: direct: one competitor only" },
        { node: "competitors", missing: "saturation: indirect_form: one competitor only" },
        { node: "competitors", missing: "saturation: indirect_active: one competitor only" },
      ],
    });
  const searches: string[] = [];
  const actors = {
    async run(_actorId: string, input: Record<string, any>) {
      const url: string = input.categoryUrls[0].url;
      searches.push(url);
      if (url.includes("fail")) throw new Error("Apify down");
      const herb = url.includes("Herb");
      return {
        status: "SUCCEEDED",
        usageUsd: 0.01,
        items: [
          herb
            ? { asin: "B000S86S3M", brand: "Herb Pharm", title: "Herb Pharm Mullein Blend Liquid Extract 1 oz" }
            : { asin: "B00028LNAQ", brand: "Nature's Answer", title: "Nature's Answer Mullein Leaf Herbal Supplement - 1oz" },
        ],
      };
    },
  };
  const read: string[] = [];
  const competitorsRun = async (steps: FauxResponseStep[]) => {
    searches.length = 0;
    read.length = 0;
    await supervisor.close();
    const pages = { scrape: async (url: string) => (read.push(url), { text: HUEL_PAGE, title: "" }) };
    supervisor = new RunSupervisor({ store, settings, models, retry: FAST_RETRY, services: services(settings, actors, pages) });
    return runWith(steps, request({ brief, nodes: ["competitors"] }));
  };

  it("looks every target up once, stores the matches, and charges the run", async () => {
    const runId = await competitorsRun(championThen(packet()));
    expect((await store.getRun(runId))!.status).toBe("completed");
    expect(searches).toHaveLength(2);
    const rows = (await store.listings.list(runId));
    expect(rows.find((r) => r.target_id === "c1")).toMatchObject({ matches: true, mismatch: "" });
    expect(rows.find((r) => r.target_id === "product")).toMatchObject({ matches: false, mismatch: "brand" });
    const events = (await store.listEvents(runId));
    expect(events.find((e) => e.kind === "packet.listings")!.payload).toEqual({ total: 2, matched: 1 });
    expect((await store.charges.list(runId)).map((c) => [c.agent_id, c.service, c.usd])).toEqual([[null, "apify", 0.01], [null, "apify", 0.01]]);
  });

  it("reads the Trustpilot score only of a target that will be mined there", async () => {
    // The champion has no matched listing and its own site, so stage 2 mines it on
    // Trustpilot; c1 is matched on Amazon and is not read.
    const runId = await competitorsRun(championThen(packet()));
    expect(read).toEqual(["https://www.trustpilot.com/review/mullevia.com"]);
    const rows = (await store.listings.list(runId));
    expect(rows.find((r) => r.target_id === "product")!.trustpilot).toMatchObject({ domain: "mullevia.com", stars: 4.2, reviews: 29447, error: "" });
    expect(rows.find((r) => r.target_id === "c1")!.trustpilot).toBeUndefined();
  });

  it("looks nothing up for a run that ended invalid", async () => {
    const runId = await competitorsRun([...championThen({ ...packet(), gaps: [] }), fauxAssistantMessage("Done.")]);
    expect((await store.getRun(runId))!.status).toBe("invalid");
    expect(searches).toHaveLength(0);
  });

  it("stays completed when the lookup fails", async () => {
    const failing = packet();
    failing.competitors[0].name = "fail";
    failing.competitor_reference.name = "fail too";
    const runId = await competitorsRun(championThen(failing));
    expect((await store.getRun(runId))!.status).toBe("completed");
    expect((await store.listings.list(runId))).toHaveLength(0);
  });
});
