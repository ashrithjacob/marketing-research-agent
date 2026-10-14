import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Corpus } from "../src/adapters/corpus.js";
import type { SqlResearchStore } from "../src/adapters/index.js";
import { TaskReadings } from "../src/agent/index.js";
import { SqliteStores } from "./sqlite-stores.js";

let dir = "";
let store: SqlResearchStore;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "mra-readings-"));
  store = await SqliteStores.open(join(dir, "research.db"));
});
afterEach(async () => {
  await store.close();
  rmSync(dir, { recursive: true, force: true });
});

const pause = () => new Promise((resolve) => setTimeout(resolve, 15));

async function call(runId: string, seq: number): Promise<void> {
  const at = new Date().toISOString();
  await store.addLlmCall({
    run_id: runId, seq, agent_id: "research", started_at: at, ended_at: at, duration_ms: 0, model: "m", system_prompt: null, tools: null,
    context_reset: false, context_messages: 0, input: [], output: {}, stop_reason: "toolUse", error: "", usage: {}, response_id: "",
  });
}

describe("a task's no-progress reading", () => {
  it("counts a page archived for the first time as progress, and the same page fetched again as nothing new", async () => {
    const corpus = new Corpus(join(dir, "corpus"));
    const run = await store.createRun({ workspaceId: "admin", brief: { url: "https://x.example" }, model: "m", rejectKinds: [], judgementIds: [] });
    const readings = new TaskReadings(store, corpus);
    await call(run.id, 1);
    await pause();
    await corpus.write(run.id, "the product page");
    await pause();
    await call(run.id, 2);
    await pause();
    expect((await readings.read(run.id, Date.now())).quietResponses).toBe(1);
    expect(await corpus.write(run.id, "the product page")).toMatchObject({ archived: true });
    await call(run.id, 3);
    expect((await readings.read(run.id, Date.now())).quietResponses).toBe(2);
    expect((await corpus.pages(run.id)).count).toBe(1);
  });
});
