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

import { createModels, getCurrentSystemPrompt, getCurrentTools, type JsonValue, type MutableModels } from "@earendil-works/pi-ai";
import { fauxAssistantMessage, fauxProvider, fauxToolCall, type FauxResponseStep } from "@earendil-works/pi-ai/providers/faux";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { OpenRouterPrices } from "../src/adapters/index.js";
import { RunSupervisor } from "../src/agent/index.js";
import { RejectKinds } from "../src/domain/index.js";
import { DEFAULT_RETRY, Retries } from "../src/agent/retry.js";
import {
  type Judgement,
  type RunRequest,
  runRequestSchema,
} from "../src/domain/index.js";
import { SqliteResearchStore } from "../src/adapters/index.js";
import { Env, type Settings } from "../src/config/index.js";
import { minimalPacket, recordCalls, recorded, reviewPacket, services } from "./fixtures.js";
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
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

function request(overrides: Partial<RunRequest> = {}): RunRequest {
  return runRequestSchema.parse({ brief: { product: "MagnaCalm 400mg" }, ...overrides });
}

/** Start a run scripted by `steps`, and wait for it to settle. */
async function runWith(steps: FauxResponseStep[], req: RunRequest = request()): Promise<string> {
  faux.setResponses(steps);
  const runId = supervisor.start(req, "admin");
  await supervisor.waitFor(runId);
  return runId;
}

/** The text of the tool result that answered `toolCallId`, as the model saw it. */
function toolAnswer(runId: string, name: string): string[] {
  return store
    .listLlmCalls(runId)
    .flatMap((call) => call.input as any[])
    .filter((m) => m.role === "toolResult" && m.toolName === name)
    .map((m) => m.content.map((c: any) => c.text).join(""));
}

describe("settling a run", () => {
  it("stores the packet assembled from the ledger and completes", async () => {
    const runId = await runWith(recorded(minimalPacket()));
    const run = store.getRun(runId)!;
    expect(run.status).toBe("completed");
    expect((run.packet as any).attributes[0].key).toBe("dose_per_serving");
    expect(run.error).toBe("");
    expect(run.packet_source).toBe("finish");
    expect(store.listEvents(runId).map((e) => e.kind)).toContain("packet.ready");
  });

  it("marks a run whose ledger breaks the contract `invalid`, not `failed`", async () => {
    // The agent finished and produced something, and what it produced broke the
    // contract. That is the most informative failure there is.
    const runId = await runWith([...recorded(minimalPacket({ gaps: [] })), fauxAssistantMessage("Done.")]);
    const run = store.getRun(runId)!;
    expect(run.status).toBe("invalid");
    expect(run.error).toMatch(/gap list is empty/);
    expect(store.listEvents(runId).map((e) => e.kind)).toContain("packet.invalid");
  });

  it("marks a prose-only run invalid", async () => {
    const runId = await runWith([fauxAssistantMessage("I looked into it and I think the market is crowded.")]);
    const run = store.getRun(runId)!;
    expect(run.status).toBe("invalid");
    expect(run.error).toMatch(/gap list is empty/);
  });

  it("settles from the ledger a run that stopped without calling finish", async () => {
    // A DeepSeek run at 208k input tokens wrote "let me write the JSON now" 56
    // times and ended its turn without it. Its findings are in the ledger now.
    const runId = await runWith([
      fauxAssistantMessage(recordCalls(minimalPacket()), { stopReason: "toolUse" }),
      fauxAssistantMessage("I have enough. Let me finalize."),
    ]);
    const run = store.getRun(runId)!;
    expect(run.status).toBe("completed");
    expect(run.packet_source).toBe("ledger");
    expect(store.listLlmCalls(runId)).toHaveLength(2);
  });

  it("refuses a bad record on its own small turn, and records the corrected one", async () => {
    const packet = minimalPacket();
    const bad = { ...packet.sources[0], kind: "marketplace" };
    const runId = await runWith([
      fauxAssistantMessage(fauxToolCall("record_source", { item: bad }), { stopReason: "toolUse" }),
      ...recorded(packet),
    ]);
    expect(toolAnswer(runId, "record_source")[0]).toMatch(/^NOT RECORDED — kind: .*received 'marketplace'/);
    expect(toolAnswer(runId, "record_source")[1]).toMatch(/^RECORDED src\d+/);
    expect(store.getRun(runId)!.status).toBe("completed");
  });

  it("records a champion with no ranking on a url brief (run 8a02bed6)", async () => {
    // The prompt says a url brief needs no ranking; the schema used to refuse
    // the null runner-up that instruction produces.
    const reference = {
      name: "Mullein Drops",
      form: "liquid",
      actives: ["mullein"],
      source_id: "sha256:aaa",
      runner_up_name: null,
      runner_up_reviews: null,
    };
    const packet = minimalPacket({
      competitor_reference: reference,
      gaps: [{ node: "competitors", missing: "no competitor researched", would_need: "time" }],
      nodes: [{ node: "competitors", status: "incomplete", done_criterion_met: false, why: "test" }],
    });
    packet.sources[0].node = "competitors";
    delete packet.attributes;
    const runId = await runWith(
      recorded(packet),
      request({ brief: { product: "", url: "https://mullevia.com/products/mullein-drops", market: "", notes: "" }, nodes: ["competitors"] }),
    );
    expect(toolAnswer(runId, "record_reference")[0]).toMatch(/^RECORDED ref\d+/);
    const run = store.getRun(runId)!;
    expect(run.status).toBe("completed");
    expect((run.packet as any).competitor_reference.runner_up_name).toBeNull();
    expect((run.packet as any).brief.product).toBe("Mullein Drops");
  });

  it("takes the packet's brief from the run, not from the model", async () => {
    const runId = await runWith(recorded(minimalPacket()), request({ brief: { product: "mullein", url: "", market: "", notes: "" } }));
    expect((store.getRun(runId)!.packet as any).brief.product).toBe("mullein");
  });

  it("refuses a row recorded against a node outside the run's scope", async () => {
    const runId = await runWith(
      [...recorded(minimalPacket()), fauxAssistantMessage("Done.")],
      request({ nodes: ["category_data"] }),
    );
    expect(toolAnswer(runId, "record_source")[0]).toMatch(/NOT RECORDED — this belongs to product_data, which is outside this run's scope/);
  });

  it("sums usage across every turn rather than reporting only the last", async () => {
    // §11 asks what a run costs; a run is dozens of turns and the final message
    // carries only its own.
    const runId = await runWith(recorded(minimalPacket()));
    const usage = store.getRun(runId)!.usage as any;
    expect(usage.totalTokens).toBeGreaterThan(0);
  });

  it("fails the run when the model in .env is not one the provider has", async () => {
    await supervisor.close();
    supervisor = new RunSupervisor({ store, settings: { ...settings, model: "no-such-model" }, models, retry: FAST_RETRY });
    expect(() => supervisor.start(request(), "admin")).toThrow(/unknown model "no-such-model"/);
    const run = store.listRuns(Scope.everything)[0]!;
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
      ...recorded(minimalPacket()),
    ]);
    const runId = supervisor.start(request(), "admin");
    await supervisor.waitFor(runId);

    const resumed = store.listEvents(runId).find((e) => e.kind === "run.resumed")!.payload as any;
    expect(resumed).toMatchObject({ from: MODEL_ID, to: backup, attempt: 1 });
    expect(store.listLlmCalls(runId).map((c) => c.model)).toEqual([MODEL_ID, backup, backup]);
    expect(store.getRun(runId)!.status).toBe("completed");
  });

  it("fails the run when a backup in .env is not a model the provider has", async () => {
    await supervisor.close();
    supervisor = new RunSupervisor({ store, settings: { ...settings, backupModels: ["no/such-backup"] }, models, retry: FAST_RETRY });
    expect(() => supervisor.start(request(), "admin")).toThrow(/unknown model "no\/such-backup"/);
  });

  it("takes the model from .env only: a run request cannot name one", () => {
    expect(() => runRequestSchema.parse({ brief: { product: "x" }, model: "other/model" })).toThrow(/model/);
    const runId = supervisor.start(request(), "admin");
    expect(store.getRun(runId)!.model).toBe(MODEL_ID);
  });
});

describe("finish", () => {
  it("stores the packet the moment finish passes, and ends the loop there", async () => {
    const runId = await runWith([...recorded(minimalPacket()), fauxAssistantMessage("never reached")]);
    const run = store.getRun(runId)!;
    expect(run.status).toBe("completed");
    expect(run.packet_source).toBe("finish");
    const ready = store.listEvents(runId).find((e) => e.kind === "packet.ready")!;
    expect(ready.payload.via).toBe("finish");
    expect(store.listLlmCalls(runId)).toHaveLength(2);
    expect(store.listPacketChecks(runId).map((c) => c.valid)).toEqual([true]);
  });

  it("completes from the ledger a run that died after recording everything", async () => {
    // Run 8a02bed6 had its research in hand when the provider cut it at ~300s,
    // four times. The findings are the ledger's now, not the lost turn's.
    const runId = await runWith([
      fauxAssistantMessage(recordCalls(minimalPacket()), { stopReason: "toolUse" }),
      ...Array.from({ length: 5 }, () =>
        fauxAssistantMessage("", { stopReason: "error", errorMessage: "terminated" }),
      ),
    ]);
    const run = store.getRun(runId)!;
    expect(run.status).toBe("completed");
    expect(run.packet_source).toBe("ledger");
    const early = store.listEvents(runId).find((e) => e.kind === "run.ended_early")!;
    expect(early.payload.error).toBe("terminated");
  });

  it("hands back the problems, and the run carries on to a fixed finish", async () => {
    const packet = minimalPacket();
    const runId = await runWith([
      ...recorded({ ...packet, gaps: [] }),
      fauxAssistantMessage(fauxToolCall("record_gap", { item: packet.gaps[0] }), { stopReason: "toolUse" }),
      fauxAssistantMessage(fauxToolCall("finish", {}), { stopReason: "toolUse" }),
    ]);
    expect(toolAnswer(runId, "finish")[0]).toMatch(/^NOT FINISHED — 1 problem\. [\s\S]*1\. gap list is empty/);
    const checks = store.listPacketChecks(runId);
    expect(checks.map((c) => c.valid)).toEqual([false, true]);
    expect(store.listEvents(runId).filter((e) => e.kind === "packet.checked")).toHaveLength(2);
    expect(store.getRun(runId)!.status).toBe("completed");
  });

  it("stops at five checks, and settles the ledger as it stands", async () => {
    // An agent that cannot fix a cross-row problem would otherwise resend its
    // whole context after every failed finish until it stopped of its own accord.
    const finishTurn = () => fauxAssistantMessage(fauxToolCall("finish", {}), { stopReason: "toolUse" });
    const runId = await runWith([
      fauxAssistantMessage(recordCalls({ ...minimalPacket(), gaps: [] }), { stopReason: "toolUse" }),
      ...Array.from({ length: 6 }, finishTurn),
      fauxAssistantMessage("never reached"),
    ]);
    const answers = toolAnswer(runId, "finish");
    expect(answers).toHaveLength(5);
    expect(answers[4]).toMatch(/Checks used: 5 of 5\.$/);
    expect(store.listLlmCalls(runId)).toHaveLength(7);
    const run = store.getRun(runId)!;
    expect(run.status).toBe("invalid");
    expect(run.error).toMatch(/gap list is empty/);
    expect(store.listPacketChecks(runId).map((c) => c.valid)).toEqual([false, false, false, false, false, false]);
  });

  it("leaves a retracted row out of the packet", async () => {
    const packet = minimalPacket();
    const extra = { ...packet.attributes[0], key: "colour", value: "blue" };
    const runId = await runWith([
      fauxAssistantMessage([fauxToolCall("record_attribute", { item: extra })], { stopReason: "toolUse" }),
      fauxAssistantMessage(fauxToolCall("retract", { id: "at1", why: "misread" }), { stopReason: "toolUse" }),
      ...recorded(packet),
    ]);
    expect(toolAnswer(runId, "retract")[0]).toBe("RETRACTED at1");
    const keys = (store.getRun(runId)!.packet as any).attributes.map((a: any) => a.key);
    expect(keys).toEqual(["dose_per_serving"]);
  });

  it("replaces a row recorded again under the same key", async () => {
    const packet = minimalPacket();
    const runId = await runWith([
      fauxAssistantMessage(fauxToolCall("record_source", { item: { ...packet.sources[0], title: "old" } }), { stopReason: "toolUse" }),
      ...recorded(packet),
    ]);
    expect(toolAnswer(runId, "record_source")[1]).toMatch(/replaces src1/);
    expect((store.getRun(runId)!.packet as any).sources).toHaveLength(1);
    expect(store.findings.list(runId).find((row) => row.id === "src1")!.retracted_why).toMatch(/replaced by/);
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

  it("hands pi-ai the live rates, and records which rates priced the run", async () => {
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
        return recorded(minimalPacket())[0]!;
      },
      recorded(minimalPacket())[1]!,
    ]);
    const runId = supervisor.start(request(), "admin");
    await supervisor.waitFor(runId);
    expect(seen.input).toBeCloseTo(1, 10);
    expect(seen.output).toBeCloseTo(2, 10);
    const usage = store.getRun(runId)!.usage as any;
    expect(usage.pricing.source).toBe("openrouter-live");
    expect(usage.totalTokens).toBeGreaterThan(0);
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
      fauxAssistantMessage(recordCalls(minimalPacket()), { responseId: "gen-1", stopReason: "toolUse" }),
      fauxAssistantMessage(fauxToolCall("finish", {}), { responseId: "gen-2", stopReason: "toolUse" }),
    ]);
    const runId = supervisor.start(request(), "admin");
    await supervisor.waitFor(runId);
    const run = store.getRun(runId)!;
    expect(run.status).toBe("completed");
    const usage = run.usage as any;
    expect(usage.billed.total).toBeCloseTo(0.03, 10);
    expect(usage.billed).toMatchObject({ turns: 2, resolved: 2 });
    // The calculated side survives the billed merge.
    expect(usage.totalTokens).toBeGreaterThan(0);
    expect(usage.pricing.source).toBe("pi-ai-snapshot");
    const kinds = store.listEvents(runId).map((e) => e.kind);
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
      faux.setResponses(recorded(minimalPacket(), { responseId: "gen-1" }));
      const runId = supervisor.start(request(), "admin");
      while (store.getRun(runId)!.status === "running") await new Promise((r) => setTimeout(r, 5));
      expect(store.getRun(runId)!.status).toBe("completed");
      expect(supervisor.isLive(runId)).toBe(true); // the window this is about
      return { runId, release };
    }

    it("refuses a stop, and the run stays completed", async () => {
      // It used to be overwritten with `stopping` and never settled again.
      const { runId, release } = await settledButLive();
      expect(() => supervisor.stop(runId)).toThrow(/already finished \(completed\)/);
      release();
      await supervisor.waitFor(runId);
      expect(store.getRun(runId)!.status).toBe("completed");
      const kinds = store.listEvents(runId).map((e) => e.kind);
      expect(kinds).not.toContain("run.stopping");
      expect(kinds).toContain("run.billed");
    });

    it("refuses a steer rather than reporting it applied mid-run", async () => {
      const { runId, release } = await settledButLive();
      const judgement = store.addJudgement("admin", { kind: "custom", text: "prefer UK", rejects_kinds: [] });
      expect(() => supervisor.steer(runId, judgement)).toThrow(/already finished/);
      release();
      await supervisor.waitFor(runId);
      expect(store.listEvents(runId).map((e) => e.kind)).not.toContain("run.steered");
    });
  });

  it("records no billed cost when no turn had a generation id", async () => {
    supervisor = new RunSupervisor({ store, settings, models, costs: costsFrom(() => ({ status: 500 })) });
    const runId = await runWith(recorded(minimalPacket()));
    expect((store.getRun(runId)!.usage as any).billed).toBeUndefined();
  });
});

describe("events", () => {
  const recordThenSay = () => [
    fauxAssistantMessage(recordCalls(minimalPacket()), { stopReason: "toolUse" }),
    fauxAssistantMessage("Everything is recorded."),
  ];

  it("emits the kinds the cockpit renders", async () => {
    const runId = await runWith(recordThenSay());
    const kinds = store.listEvents(runId).map((e) => e.kind);
    expect(kinds[0]).toBe("run.started");
    expect(kinds).toContain("message.delta");
    expect(kinds).toContain("run.completed");
  });

  it("streams assistant text once, not once per update", async () => {
    // The agent re-emits the whole message on each update; appending deltas
    // blindly multiplies the output by the number of updates.
    const runId = await runWith(recordThenSay());
    const deltas = store
      .listEvents(runId)
      .filter((e) => e.kind === "message.delta")
      .map((e) => String((e.payload as any).delta))
      .join("");
    expect(deltas).toBe("Everything is recorded.");
    expect(deltas).toBe(store.getRun(runId)!.output);
  });

  it("replays every event to a subscriber that arrives late", async () => {
    const runId = await runWith(recorded(minimalPacket()));
    expect(store.listEvents(runId).length).toBeGreaterThan(2);
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
    const judgement = store.addJudgement("admin", {
      kind: "source_rule",
      text: "no listicles",
      rejects_kinds: ["seo_listicle"],
    });
    const packet = minimalPacket();
    packet.sources.push({
      id: "sha256:ddd",
      url: "https://top10.example/best",
      kind: "seo_listicle",
      admitted: false,
      admission_reason: "rejected by policy",
      node: "competitors",
    });
    await runWith(recorded(packet));
    expect(store.listJudgements(Scope.everything).find((j) => j.id === judgement.id)!.applied_count).toBe(1);
  });

  it("reaches the instructions of a run started after it", async () => {
    store.addJudgement("admin", { kind: "custom", text: "prefer UK sources", rejects_kinds: [] });
    faux.setResponses([
      (context) => {
        const turn = JSON.stringify(context.messages);
        expect(turn).toContain("prefer UK sources");
        return recorded(minimalPacket())[0]!;
      },
      recorded(minimalPacket())[1]!,
    ]);
    const runId = supervisor.start(request(), "admin");
    await supervisor.waitFor(runId);
    expect(store.getRun(runId)!.status).toBe("completed");
  });
});

describe("recovery", () => {
  it("settles a run the process stopped watching", () => {
    // The agent lives in this process now, so a run that was `running` at
    // shutdown is dead, not resumable. Saying so beats a row stuck on `running`.
    const run = store.createRun({
      workspaceId: "admin",
      brief: { product: "x" },
      model: MODEL_ID,
      rejectKinds: [],
      judgementIds: [],
    });
    store.updateRun(run.id, { status: "running" });
    supervisor.recoverRunsKilledByRestart();
    const settled = store.getRun(run.id)!;
    expect(settled.status).toBe("failed");
    expect(settled.error).toMatch(/restarted/);
  });

  it("leaves finished runs alone", async () => {
    const runId = await runWith(recorded(minimalPacket()));
    supervisor.recoverRunsKilledByRestart();
    expect(store.getRun(runId)!.status).toBe("completed");
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
    const runId = supervisor.start(request(), "admin");
    await started;

    supervisor.stop(runId);
    expect(store.getRun(runId)!.status).toBe("stopping");
    await supervisor.waitFor(runId);

    expect(store.getRun(runId)!.status).toBe("cancelled");
    const kinds = store.listEvents(runId).map((e) => e.kind);
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
    const runId = supervisor.start(request(), "admin");
    await supervisor.waitFor(runId);

    const calls = store.listLlmCalls(runId);
    expect(calls.map((c) => c.seq)).toEqual([1, 2]);
    const [first, second] = calls as [any, any];

    // Call 1 carries the whole prompt: system, tools and the instructions.
    expect(first.system_prompt).toMatch(/stage-1 researcher/);
    expect(first.tools.map((t: any) => t.name)).toContain("web_fetch");
    expect(first.input).toHaveLength(1);
    expect(first.input[0].role).toBe("user");
    expect(JSON.stringify(first.input[0].content)).toContain("## Recording what you find");
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

    const kinds = store.listEvents(runId).map((e) => e.kind);
    expect(kinds.filter((k) => k === "llm.call")).toHaveLength(2);
    const summaryEvent = store.listEvents(runId).find((e) => e.kind === "llm.call")!;
    expect(summaryEvent.payload).toMatchObject({ seq: 1, tool_calls: 1, stop_reason: "toolUse" });
    // The prompt stays out of the event stream.
    expect(JSON.stringify(summaryEvent.payload)).not.toContain("## Recording");
  });

  it("leaves a tool result's details out, because the model never sees them", async () => {
    twoTurns();
    const runId = supervisor.start(request(), "admin");
    await supervisor.waitFor(runId);
    const toolResult = (store.listLlmCalls(runId)[1]!.input as any[]).find(
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
    const runId = supervisor.start(request(), "admin");
    await supervisor.waitFor(runId);
    const calls = store.listLlmCalls(runId);
    expect(calls.map((c) => c.billed_cost)).toEqual([0.01, 0.02]);
    expect(calls.map((c) => c.generation?.latency_ms)).toEqual([900, 900]);
    expect(calls[1]!.generation).toMatchObject({ generation_ms: 30000, reasoning_tokens: 1200 });
  });

  it("tags each tool event with the id of the tool call that asked for it", async () => {
    faux.setResponses([
      fauxAssistantMessage(fauxToolCall("record_source", { item: minimalPacket().sources[0] }), {
        responseId: "gen-1",
        stopReason: "toolUse",
      }),
      fauxAssistantMessage("Recorded.", { responseId: "gen-2" }),
    ]);
    const runId = supervisor.start(request(), "admin");
    await supervisor.waitFor(runId);

    const [first, second] = store.listLlmCalls(runId) as [any, any];
    const asked = first.output.content.find((b: any) => b.type === "toolCall").id;
    const answered = second.input.find((m: any) => m.role === "toolResult").toolCallId;
    const tagged = store
      .listEvents(runId)
      .filter((e) => e.kind === "tool.started" || e.kind === "tool.completed")
      .map((e) => (e.payload as any).tool_call_id);
    expect(asked).toBeTruthy();
    expect(answered).toBe(asked);
    expect(tagged).toEqual([asked, asked]);
    const completed = store.listEvents(runId).find((e) => e.kind === "tool.completed")!.payload as any;
    expect(completed.inside.map((s: any) => s.name)).toContain("RecordTool.tool.execute");
  });

  it("records a call the provider failed, with its error", async () => {
    // 502 is retryable, so the run spends its budget before settling.
    faux.setResponses(
      Array.from({ length: 4 }, () =>
        fauxAssistantMessage("", { stopReason: "error", errorMessage: "upstream 502" }),
      ),
    );
    const runId = supervisor.start(request(), "admin");
    await supervisor.waitFor(runId);
    const [call] = store.listLlmCalls(runId);
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
      ...recorded(minimalPacket()),
    ]);
    const runId = supervisor.start(request(), "admin");
    await supervisor.waitFor(runId);

    const run = store.getRun(runId)!;
    expect(run.status).toBe("completed");
    expect(run.error).toBe("");
    const resumed = store.listEvents(runId).find((e) => e.kind === "run.resumed");
    expect(resumed?.payload.error).toBe("terminated");
    // The continuation says the turn was lost, so tools are not re-run.
    expect(JSON.stringify(store.listLlmCalls(runId)[1]!.input)).toContain("dropped part-way");
  });

  it("keeps trying to the end of its budget, then fails", async () => {
    faux.setResponses([
      fauxAssistantMessage("", { stopReason: "error", errorMessage: "terminated" }),
      fauxAssistantMessage("", { stopReason: "error", errorMessage: "socket hang up" }),
      fauxAssistantMessage("", { stopReason: "error", errorMessage: "502 bad gateway" }),
      fauxAssistantMessage("", { stopReason: "error", errorMessage: "terminated, again" }),
      recorded(minimalPacket())[0]!, // never reached: budget is 3
    ]);
    const runId = supervisor.start(request(), "admin");
    await supervisor.waitFor(runId);

    const run = store.getRun(runId)!;
    expect(run.status).toBe("failed");
    expect(run.error).toBe("terminated, again");
    const resumed = store.listEvents(runId).filter((e) => e.kind === "run.resumed");
    expect(resumed).toHaveLength(3);
    expect(resumed.map((e) => e.payload.attempt)).toEqual([1, 2, 3]);
  });

  it("recovers on a later attempt when the provider comes back", async () => {
    faux.setResponses([
      fauxAssistantMessage("", { stopReason: "error", errorMessage: "terminated" }),
      fauxAssistantMessage("", { stopReason: "error", errorMessage: "503 service unavailable" }),
      ...recorded(minimalPacket()),
    ]);
    const runId = supervisor.start(request(), "admin");
    await supervisor.waitFor(runId);

    expect(store.getRun(runId)!.status).toBe("completed");
    expect(store.listEvents(runId).filter((e) => e.kind === "run.resumed")).toHaveLength(2);
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
      fauxAssistantMessage(recordCalls(minimalPacket()), { stopReason: "toolUse" }),
      ...Array.from({ length: 4 }, () =>
        fauxAssistantMessage("", { stopReason: "error", errorMessage: "Upstream error from Relace" }),
      ),
    ]);
    const runId = supervisor.start(request(), "admin");
    await supervisor.waitFor(runId);

    const kinds = store.listEvents(runId).map((e) => e.kind);
    expect(kinds.filter((k) => k === "run.resumed")).toHaveLength(3);
    expect(store.getRun(runId)!.status).toBe("completed");
    expect(store.listLlmCalls(runId)).toHaveLength(5);
  });

  it("does not retry an error that waiting cannot fix", async () => {
    // pi-ai's classifier: quota and billing exhaustion are terminal, and a
    // retry on a 93k-token transcript is a real charge for a certain failure.
    faux.setResponses([
      fauxAssistantMessage("", {
        stopReason: "error",
        errorMessage: "402 insufficient_quota: your account is out of credit",
      }),
      recorded(minimalPacket())[0]!,
    ]);
    const runId = supervisor.start(request(), "admin");
    await supervisor.waitFor(runId);

    expect(store.getRun(runId)!.status).toBe("failed");
    expect(store.listEvents(runId).some((e) => e.kind === "run.resumed")).toBe(false);
  });

  it("does not resume a run the operator stopped", async () => {
    faux.setResponses([
      () => {
        // Stop lands while the turn is in flight, which is the real shape of it.
        supervisor.stop(runId);
        return fauxAssistantMessage("", { stopReason: "error", errorMessage: "aborted" });
      },
      recorded(minimalPacket())[0]!,
    ]);
    const runId = supervisor.start(request(), "admin");
    await supervisor.waitFor(runId);

    expect(store.getRun(runId)!.status).toBe("cancelled");
    expect(store.listEvents(runId).some((e) => e.kind === "run.resumed")).toBe(false);
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
    const runId = supervisor.start(request({ nodes: ["product_data"] }), "admin");
    await supervisor.waitFor(runId);

    expect(store.getRun(runId)!.nodes).toEqual(["product_data"]);
    expect(seen!.system).toMatch(/This run covers only `product_data`/);
    expect(seen!.prompt).toContain("## Scope of this run");
    expect(seen!.tools).toEqual([
      "web_search",
      "web_fetch",
      "record_source",
      "record_excerpt",
      "record_measurement",
      "record_attribute",
      "record_saturation",
      "record_node_status",
      "record_gap",
      "retract",
      "finish",
    ]);
    const started = store.listEvents(runId).find((e) => e.kind === "run.started")!;
    expect(started.payload.nodes).toEqual(["product_data"]);
  });

  it("refuses a row for another node of the stage, and keeps the rest", async () => {
    // A category_data entry in a product_data run: same stage, wrong node.
    const packet = minimalPacket();
    packet.gaps.push({ node: "category_data", missing: "no three-year trend" });
    const runId = await runWith(recorded(packet), request({ nodes: ["product_data"] }));
    expect(toolAnswer(runId, "record_gap")[1]).toMatch(/NOT RECORDED — this belongs to category_data, which is outside this run's scope \(product_data\)/);
    const run = store.getRun(runId)!;
    expect(run.status).toBe("completed");
    expect((run.packet as any).gaps).toHaveLength(1);
  });

  it("refuses every row of the other stage's work", async () => {
    // Review mining is stage 2 (2026-09-21). A stage-1 run that records review
    // excerpts is doing a different run's work.
    const runId = await runWith([...recorded(reviewPacket()), fauxAssistantMessage("Done.")]);
    expect(toolAnswer(runId, "record_excerpt")[0]).toMatch(/this belongs to review_mining, which is outside this run's scope/);
    const run = store.getRun(runId)!;
    expect(run.status).toBe("invalid");
    expect(store.findings.list(runId)).toHaveLength(0);
  });

  it("offers a competitors run Amazon search for discovery, but not the review tools", async () => {
    let tools: string[] = [];
    faux.setResponses([
      (context) => {
        tools = getCurrentTools(context.messages).map((t) => t.name);
        return fauxAssistantMessage("Nothing found.");
      },
    ]);
    supervisor = new RunSupervisor({ store, settings: { ...settings, apifyToken: "t" }, models });
    const runId = supervisor.start(request({ nodes: ["competitors"] }), "admin");
    await supervisor.waitFor(runId);
    expect(tools.slice(0, 3)).toEqual(["web_search", "web_fetch", "amazon_find_product"]);
    expect(tools).toContain("record_reference");
    expect(tools).toContain("record_competitor");
    expect(tools).not.toContain("mine_reviews");
  });
});

describe("the Amazon listings of a completed stage-1 run", () => {
  const brief = { product: "", url: "https://mullevia.com/products/mullein-drops", market: "", notes: "" };
  const packet = () =>
    minimalPacket({
      brief,
      sources: [{ ...minimalPacket().sources[0], node: "competitors" }],
      attributes: [],
      competitor_reference: { name: "Mullevia Mullein Drops", form: "liquid", actives: ["mullein"], source_id: "sha256:aaa" },
      competitors: [
        {
          id: "c1", name: "Herb Pharm Mullein Blend", brand: "Herb Pharm", url: "https://herb-pharm.com/mullein",
          relation: "direct", form: "liquid", shared_actives: ["mullein"], source_id: "sha256:aaa",
          active_ingredients: [{ name_as_printed: "Mullein", name_normalised: "mullein" }],
        },
      ],
      nodes: [{ node: "competitors", status: "incomplete", done_criterion_met: false, why: "one competitor" }],
      gaps: [{ node: "competitors", missing: "no ad library entries" }],
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
    const runId = await competitorsRun(recorded(packet()));
    expect(store.getRun(runId)!.status).toBe("completed");
    expect(searches).toHaveLength(2);
    const rows = store.listings.list(runId);
    expect(rows.find((r) => r.target_id === "c1")).toMatchObject({ matches: true, mismatch: "" });
    expect(rows.find((r) => r.target_id === "product")).toMatchObject({ matches: false, mismatch: "brand" });
    const events = store.listEvents(runId);
    expect(events.find((e) => e.kind === "packet.listings")!.payload).toEqual({ total: 2, matched: 1 });
    expect(events.filter((e) => e.kind === "apify.charged")).toHaveLength(2);
  });

  it("reads the Trustpilot score only of a target that will be mined there", async () => {
    // The champion has no matched listing and its own site, so stage 2 mines it on
    // Trustpilot; c1 is matched on Amazon and is not read.
    const runId = await competitorsRun(recorded(packet()));
    expect(read).toEqual(["https://www.trustpilot.com/review/mullevia.com"]);
    const rows = store.listings.list(runId);
    expect(rows.find((r) => r.target_id === "product")!.trustpilot).toMatchObject({ domain: "mullevia.com", stars: 4.2, reviews: 29447, error: "" });
    expect(rows.find((r) => r.target_id === "c1")!.trustpilot).toBeUndefined();
  });

  it("looks nothing up for a run that ended invalid", async () => {
    const runId = await competitorsRun([...recorded({ ...packet(), gaps: [] }), fauxAssistantMessage("Done.")]);
    expect(store.getRun(runId)!.status).toBe("invalid");
    expect(searches).toHaveLength(0);
  });

  it("stays completed when the lookup fails", async () => {
    const failing = packet();
    failing.competitors[0].name = "fail";
    failing.competitor_reference.name = "fail too";
    const runId = await competitorsRun(recorded(failing));
    expect(store.getRun(runId)!.status).toBe("completed");
    expect(store.listings.list(runId)).toHaveLength(0);
  });
});
