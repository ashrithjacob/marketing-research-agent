/**
 * The run lifecycle.
 *
 * Driven by pi's faux provider rather than a live model: the thing under test is
 * what the supervisor does with what comes back, and a real model would make
 * that non-deterministic and slow.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createModels, type MutableModels } from "@earendil-works/pi-ai";
import { fauxAssistantMessage, fauxProvider, fauxToolCall } from "@earendil-works/pi-ai/providers/faux";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { OpenRouterCosts } from "../src/costs.js";
import { RunSupervisor, effectiveRejectKinds } from "../src/runner.js";
import { runRequestSchema, type RunRequest } from "../src/schema.js";
import { loadSettings, type Settings } from "../src/settings.js";
import { SqliteResearchStore, type Judgement } from "../src/store.js";
import { fenced, minimalPacket } from "./fixtures.js";

const MODEL_ID = "faux-model";

let dir: string;
let store: SqliteResearchStore;
let settings: Settings;
let models: MutableModels;
let faux: ReturnType<typeof fauxProvider>;
let supervisor: RunSupervisor;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "mra-runner-"));
  store = new SqliteResearchStore(join(dir, "research.db"));
  settings = { ...loadSettings(), model: MODEL_ID, corpusPath: join(dir, "corpus") };
  faux = fauxProvider({ provider: "openrouter", models: [{ id: MODEL_ID }] });
  models = createModels();
  models.setProvider(faux.provider);
  supervisor = new RunSupervisor({ store, settings, models });
});

afterEach(async () => {
  await supervisor.close();
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

function request(overrides: Partial<RunRequest> = {}): RunRequest {
  return runRequestSchema.parse({ brief: { product: "MagnaCalm 400mg" }, ...overrides });
}

/** Start a run whose single assistant turn is `text`, and wait for it to settle. */
async function runWith(text: string): Promise<string> {
  faux.setResponses([fauxAssistantMessage(text)]);
  const runId = supervisor.start(request());
  await supervisor.waitFor(runId);
  return runId;
}

describe("settling a run", () => {
  it("stores a validated packet and completes", async () => {
    const runId = await runWith(fenced(minimalPacket()));
    const run = store.getRun(runId)!;
    expect(run.status).toBe("completed");
    expect((run.packet as any).excerpts[0].star_rating).toBe(3);
    expect(run.error).toBe("");
    expect(store.listEvents(runId).map((e) => e.kind)).toContain("packet.ready");
  });

  it("marks a run that concludes `invalid`, not `failed`", async () => {
    // The agent finished and produced something, and what it produced broke the
    // contract. That is the most informative failure there is.
    const packet = minimalPacket();
    packet.findings = ["buyers want sleep"];
    const runId = await runWith(fenced(packet));
    const run = store.getRun(runId)!;
    expect(run.status).toBe("invalid");
    expect(run.error).toMatch(/not in the stage-1 contract/);
    expect(store.listEvents(runId).map((e) => e.kind)).toContain("packet.invalid");
  });

  it("marks a prose-only run invalid", async () => {
    const runId = await runWith("I looked into it and I think the market is crowded.");
    expect(store.getRun(runId)!.status).toBe("invalid");
  });

  it("records the output it read the packet from", async () => {
    const runId = await runWith(fenced(minimalPacket()));
    expect(store.getRun(runId)!.output).toContain("MagnaCalm 400mg");
  });

  it("sums usage across every turn rather than reporting only the last", async () => {
    // §11 asks what a run costs; a run is dozens of turns and the final message
    // carries only its own.
    const packet = fenced(minimalPacket());
    faux.setResponses([
      fauxAssistantMessage("looking into it"),
      fauxAssistantMessage("still going"),
      fauxAssistantMessage(packet),
    ]);
    const runId = supervisor.start(request());
    // Two nudges, so the agent takes three turns instead of stopping at one.
    await supervisor.waitFor(runId);
    const usage = store.getRun(runId)!.usage as any;
    expect(usage.totalTokens).toBeGreaterThan(0);
  });

  it("fails the run when the model is not one the provider has", async () => {
    expect(() => supervisor.start(request({ model: "no-such-model" }))).toThrow(/unknown model/);
    const run = store.listRuns()[0]!;
    expect(run.status).toBe("failed");
    expect(run.error).toMatch(/unknown model/);
  });
});

describe("cost", () => {
  function costsFrom(replies: (url: string) => { status: number; body?: unknown }) {
    const fetch = (async (input: string | URL | Request) => {
      const { status, body } = replies(String(input));
      return new Response(JSON.stringify(body ?? {}), { status });
    }) as typeof globalThis.fetch;
    return new OpenRouterCosts({ apiKey: "k", fetch, lookupDelaysMs: [] });
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
        return fauxAssistantMessage(fenced(minimalPacket()));
      },
    ]);
    const runId = supervisor.start(request());
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
      // after one turn. An unknown tool is enough: it comes back as an error.
      fauxAssistantMessage(fauxToolCall("no_such_tool", {}), {
        responseId: "gen-1",
        stopReason: "toolUse",
      }),
      fauxAssistantMessage(fenced(minimalPacket()), { responseId: "gen-2" }),
    ]);
    const runId = supervisor.start(request());
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
      return { costs: new OpenRouterCosts({ apiKey: "k", fetch, lookupDelaysMs: [] }), release };
    }

    async function settledButLive(): Promise<{ runId: string; release: () => void }> {
      const { costs, release } = heldBilling();
      supervisor = new RunSupervisor({ store, settings, models, costs });
      faux.setResponses([fauxAssistantMessage(fenced(minimalPacket()), { responseId: "gen-1" })]);
      const runId = supervisor.start(request());
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
      const judgement = store.addJudgement({ kind: "custom", text: "prefer UK", rejects_kinds: [] });
      expect(() => supervisor.steer(runId, judgement)).toThrow(/already finished/);
      release();
      await supervisor.waitFor(runId);
      expect(store.listEvents(runId).map((e) => e.kind)).not.toContain("run.steered");
    });
  });

  it("records no billed cost when no turn had a generation id", async () => {
    supervisor = new RunSupervisor({ store, settings, models, costs: costsFrom(() => ({ status: 500 })) });
    const runId = await runWith(fenced(minimalPacket()));
    expect((store.getRun(runId)!.usage as any).billed).toBeUndefined();
  });
});

describe("events", () => {
  it("emits the kinds the cockpit renders", async () => {
    const runId = await runWith(fenced(minimalPacket()));
    const kinds = store.listEvents(runId).map((e) => e.kind);
    expect(kinds[0]).toBe("run.started");
    expect(kinds).toContain("message.delta");
    expect(kinds).toContain("run.completed");
  });

  it("streams assistant text once, not once per update", async () => {
    // The agent re-emits the whole message on each update; appending deltas
    // blindly multiplies the output by the number of updates.
    const runId = await runWith(fenced(minimalPacket()));
    const deltas = store
      .listEvents(runId)
      .filter((e) => e.kind === "message.delta")
      .map((e) => String((e.payload as any).delta))
      .join("");
    expect(deltas).toBe(store.getRun(runId)!.output);
  });

  it("replays every event to a subscriber that arrives late", async () => {
    const runId = await runWith(fenced(minimalPacket()));
    expect(store.listEvents(runId).length).toBeGreaterThan(2);
    expect(supervisor.isLive(runId)).toBe(false);
  });
});

describe("judgements", () => {
  it("only ever widens the rejection set", () => {
    // A standing rule must never quietly make the corpus wider (spec.md §6.2-4).
    const judgement: Judgement = {
      id: "j1",
      kind: "source_rule",
      text: "no competitor marketing",
      rejects_kinds: ["competitor_marketing"],
      active: true,
      applied_count: 0,
      created_at: "",
    };
    const kinds = effectiveRejectKinds(request(), [judgement]);
    expect(kinds).toEqual(
      expect.arrayContaining(["seo_listicle", "review_roundup", "ai_generated", "competitor_marketing"]),
    );
  });

  it("lets an explicit reject_kinds replace the defaults", () => {
    expect(effectiveRejectKinds(request({ reject_kinds: ["ai_generated"] }), [])).toEqual([
      "ai_generated",
    ]);
  });

  it("counts applications from the packet, not from the prompt", async () => {
    const judgement = store.addJudgement({
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
    await runWith(fenced(packet));
    expect(store.listJudgements().find((j) => j.id === judgement.id)!.applied_count).toBe(1);
  });

  it("reaches the instructions of a run started after it", async () => {
    store.addJudgement({ kind: "custom", text: "prefer UK sources", rejects_kinds: [] });
    faux.setResponses([
      (context) => {
        const turn = JSON.stringify(context.messages);
        expect(turn).toContain("prefer UK sources");
        return fauxAssistantMessage(fenced(minimalPacket()));
      },
    ]);
    const runId = supervisor.start(request());
    await supervisor.waitFor(runId);
    expect(store.getRun(runId)!.status).toBe("completed");
  });
});

describe("recovery", () => {
  it("settles a run the process stopped watching", () => {
    // The agent lives in this process now, so a run that was `running` at
    // shutdown is dead, not resumable. Saying so beats a row stuck on `running`.
    const run = store.createRun({
      brief: { product: "x" },
      model: MODEL_ID,
      rejectKinds: [],
      judgementIds: [],
    });
    store.updateRun(run.id, { status: "running" });
    supervisor.recover();
    const settled = store.getRun(run.id)!;
    expect(settled.status).toBe("failed");
    expect(settled.error).toMatch(/restarted/);
  });

  it("leaves finished runs alone", async () => {
    const runId = await runWith(fenced(minimalPacket()));
    supervisor.recover();
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
    const runId = supervisor.start(request());
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
  /** A two-turn run: a tool call, then the packet. */
  function twoTurns() {
    faux.setResponses([
      fauxAssistantMessage(fauxToolCall("no_such_tool", { q: "x" }), {
        responseId: "gen-1",
        stopReason: "toolUse",
      }),
      fauxAssistantMessage(fenced(minimalPacket()), { responseId: "gen-2" }),
    ]);
  }

  it("records every call, storing only what is new since the previous one", async () => {
    twoTurns();
    const runId = supervisor.start(request());
    await supervisor.waitFor(runId);

    const calls = store.listLlmCalls(runId);
    expect(calls.map((c) => c.seq)).toEqual([1, 2]);
    const [first, second] = calls as [any, any];

    // Call 1 carries the whole prompt: system, tools and the instructions.
    expect(first.system_prompt).toMatch(/stage-1 researcher/);
    expect(first.tools.map((t: any) => t.name)).toContain("web_fetch");
    expect(first.input).toHaveLength(1);
    expect(first.input[0].role).toBe("user");
    expect(JSON.stringify(first.input[0].content)).toContain("## Output");
    expect(first.output.content.some((c: any) => c.type === "toolCall")).toBe(true);
    expect(first.stop_reason).toBe("toolUse");

    // Call 2 stores only its own new messages: the answer it is continuing
    // from, and the tool's result — not the instructions again.
    expect(second.system_prompt).toBeNull();
    expect(second.tools).toBeNull();
    expect(second.context_reset).toBe(false);
    expect(second.context_messages).toBe(3);
    expect(second.input.map((m: any) => m.role)).toEqual(["assistant", "toolResult"]);
    expect(second.output.content[0].text).toContain("```json");
    expect(second.duration_ms).toBeGreaterThanOrEqual(0);
    expect(second.usage.totalTokens).toBeGreaterThan(0);

    const kinds = store.listEvents(runId).map((e) => e.kind);
    expect(kinds.filter((k) => k === "llm.call")).toHaveLength(2);
    const summaryEvent = store.listEvents(runId).find((e) => e.kind === "llm.call")!;
    expect(summaryEvent.payload).toMatchObject({ seq: 1, tool_calls: 1, stop_reason: "toolUse" });
    // The prompt stays out of the event stream.
    expect(JSON.stringify(summaryEvent.payload)).not.toContain("## Output");
  });

  it("leaves a tool result's details out, because the model never sees them", async () => {
    twoTurns();
    const runId = supervisor.start(request());
    await supervisor.waitFor(runId);
    const toolResult = (store.listLlmCalls(runId)[1]!.input as any[]).find(
      (m) => m.role === "toolResult",
    );
    expect(toolResult).toBeDefined();
    expect(toolResult).not.toHaveProperty("details");
    expect(toolResult.content.length).toBeGreaterThan(0);
  });

  it("attaches what OpenRouter billed to each call", async () => {
    const fetch = (async (input: string | URL | Request) =>
      new Response(
        JSON.stringify({ data: { total_cost: String(input).includes("gen-2") ? 0.02 : 0.01 } }),
        { status: 200 },
      )) as typeof globalThis.fetch;
    const costs = new OpenRouterCosts({ apiKey: "k", fetch, lookupDelaysMs: [] });
    supervisor = new RunSupervisor({ store, settings, models, costs });
    twoTurns();
    const runId = supervisor.start(request());
    await supervisor.waitFor(runId);
    expect(store.listLlmCalls(runId).map((c) => c.billed_cost)).toEqual([0.01, 0.02]);
  });

  it("records a call the provider failed, with its error", async () => {
    faux.setResponses([
      fauxAssistantMessage("", { stopReason: "error", errorMessage: "upstream 502" }),
    ]);
    const runId = supervisor.start(request());
    await supervisor.waitFor(runId);
    const [call] = store.listLlmCalls(runId);
    expect(call!.stop_reason).toBe("error");
    expect(call!.error).toBe("upstream 502");
  });
});

describe("a run that covers part of the stage", () => {
  it("stores its scope, is prompted for it, and is not handed the review tools", async () => {
    let seen: { system?: string; tools: string[]; prompt: string } | undefined;
    faux.setResponses([
      (context) => {
        seen = {
          system: context.systemPrompt,
          tools: (context.tools ?? []).map((t) => t.name),
          prompt: JSON.stringify(context.messages[0]),
        };
        return fauxAssistantMessage(fenced(minimalPacket()));
      },
    ]);
    // The token is set, so without the scope the review tools would be offered.
    supervisor = new RunSupervisor({ store, settings: { ...settings, apifyToken: "t" }, models });
    const runId = supervisor.start(request({ nodes: ["product_data"] }));
    await supervisor.waitFor(runId);

    expect(store.getRun(runId)!.nodes).toEqual(["product_data"]);
    expect(seen!.system).toMatch(/This run covers only `product_data`/);
    expect(seen!.prompt).toContain("## Scope of this run");
    expect(seen!.tools).toEqual(["web_search", "web_fetch"]);
    const started = store.listEvents(runId).find((e) => e.kind === "run.started")!;
    expect(started.payload.nodes).toEqual(["product_data"]);
  });

  it("is invalid when its packet records other nodes", async () => {
    // minimalPacket is a review-mining packet with a competitors gap.
    faux.setResponses([fauxAssistantMessage(fenced(minimalPacket()))]);
    const runId = supervisor.start(request({ nodes: ["product_data"] }));
    await supervisor.waitFor(runId);
    const run = store.getRun(runId)!;
    expect(run.status).toBe("invalid");
    expect(run.error).toMatch(/outside this run's scope \(product_data\)/);
  });

  it("offers the review tools when review mining is in scope", async () => {
    let tools: string[] = [];
    faux.setResponses([
      (context) => {
        tools = (context.tools ?? []).map((t) => t.name);
        return fauxAssistantMessage(fenced(minimalPacket()));
      },
    ]);
    supervisor = new RunSupervisor({ store, settings: { ...settings, apifyToken: "t" }, models });
    const runId = supervisor.start(request({ nodes: ["review_mining"] }));
    await supervisor.waitFor(runId);
    expect(tools).toContain("amazon_reviews");
  });
});
