/** A run end to end through the http routes: resolved, confirmed by the user, then stage 1 researching the product and classifying every competitor. */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Message } from "@earendil-works/pi-ai";

import { Pipeline, ProductMarketStage } from "../src/agent/index.js";
import { App } from "../src/http/index.js";

import { Faux, FakeWeb, NoBilling, FakeVisuals, TestSettings } from "./fakes.js";
import { BRIEF, DROPS_URL, GUMMIES_URL, PAGES, PRODUCT_URL, Profiles, RESOLUTION, SEARCH_HITS, TEA_URL } from "./mullevia.js";
import { PostgresStores } from "./postgres-stores.js";
import { RunDriver } from "./run-driver.js";
import { ScriptedAgents } from "./scripted-agents.js";

const { call, text } = ScriptedAgents;
let pg: PostgresStores;
let app: App;
let faux: Faux;
let web: FakeWeb;
let driver: RunDriver;

beforeAll(async () => {
  pg = await PostgresStores.start();
});

afterAll(async () => {
  await pg.stop();
});

beforeEach(() => {
  faux = new Faux();
  web = new FakeWeb(PAGES, SEARCH_HITS);
  const { settings, traces } = TestSettings.make();
  const pipeline = new Pipeline([new ProductMarketStage()]);
  app = new App({ settings, traces, store: pg.store, services: web.services(), models: faux.models, generations: new NoBilling(), visuals: new FakeVisuals(), pipeline });
  driver = new RunDriver(app);
});

const api = (path: string, body?: unknown): Promise<Response> => driver.api(path, body);
const view = (runId: string) => driver.view(runId);
const settle = (runId: string, statuses: readonly string[]) => driver.settle(runId, statuses);
const start = (input: Record<string, unknown>) => driver.start(input);

const resolver = [call("web_fetch", { url: PRODUCT_URL }), call("web_search", { query: "mullein drops" }), call("submit", RESOLUTION)];
const profile = (url: string, form: "liquid_drops" | "gummies" | "tea", has: boolean) => [call("web_fetch", { url }), call("submit", Profiles.of(url, form, has))];
const confirmation = { product_url: PRODUCT_URL, competitors: RESOLUTION.competitors.map(({ why: _why, ...pick }) => pick) };

describe("a run", () => {
  it("resolves, waits for the user, then briefs the product and classifies each competitor direct, indirect or other", async () => {
    const script = new ScriptedAgents()
      .on("Product url:", resolver)
      .on("Product page:", [call("web_fetch", { url: PRODUCT_URL }), call("submit", BRIEF)])
      .on(`Its product page: ${DROPS_URL}`, profile(DROPS_URL, "liquid_drops", true))
      .on(`Its product page: ${GUMMIES_URL}`, profile(GUMMIES_URL, "gummies", true))
      .on(`Its product page: ${TEA_URL}`, profile(TEA_URL, "tea", false));
    faux.provider.setResponses(script.steps());

    const runId = await start({ product_url: PRODUCT_URL });
    const waiting = await settle(runId, ["awaiting_confirmation", "invalid", "failed"]);
    expect(waiting.run.status).toBe("awaiting_confirmation");
    expect(waiting.run.resolution?.competitors.map((c) => c.brand)).toEqual(["LungClear", "Breathe", "Chest Tea"]);
    expect(waiting.run.stage_status.product_market.status).toBe("pending");
    expect(waiting.run.stage_status.reviews.status).toBe("not_built");
    const { visuals } = (await (await api(`/runs/${runId}`)).json()) as { visuals: Record<string, { image_url: string | null }> };
    expect(Object.keys(visuals).sort()).toEqual([PRODUCT_URL, DROPS_URL, GUMMIES_URL, TEA_URL].sort());
    expect(visuals[DROPS_URL]?.image_url).toBe(`${DROPS_URL}#image`);

    expect((await api(`/runs/${runId}/confirm`, confirmation)).status).toBe(200);
    const done = await settle(runId, ["completed", "invalid", "failed"]);

    expect(script.unmatched).toEqual([]);
    expect(done.run.status).toBe("completed");
    expect(done.run.stage_status.product_market).toMatchObject({ status: "completed", error: "" });
    expect(done.product).toMatchObject({ key_active: "Mullein leaf extract", form_factor: "liquid_drops", price: { amount: 32.95 } });
    const relationships = Object.fromEntries(done.competitors.map((c) => [c.brand, c.relationship]));
    expect(relationships).toEqual({ LungClear: "direct", Breathe: "indirect", "Chest Tea": "other" });
    expect(web.fetched).toContain(TEA_URL);
  });

  it("refuses a brief citing a page the agent never read, and accepts it once the page is read", async () => {
    let refusal = "";
    const sawRefusal = (messages: Message[]) => {
      const last = messages.at(-1);
      refusal = last?.role === "toolResult" ? JSON.stringify(last.content) : "";
      return call("web_fetch", { url: PRODUCT_URL });
    };
    faux.provider.setResponses(
      new ScriptedAgents()
        .on("Product url:", resolver)
        .on("Product page:", [call("submit", BRIEF), sawRefusal, call("submit", BRIEF)])
        .on("Its product page:", [text("cannot read it")])
        .steps(),
    );
    const runId = await start({ product_url: PRODUCT_URL });
    await settle(runId, ["awaiting_confirmation"]);
    await api(`/runs/${runId}/confirm`, { ...confirmation, competitors: confirmation.competitors.slice(0, 1) });
    const done = await settle(runId, ["completed", "invalid", "failed"]);

    expect(refusal).toContain("REFUSED");
    expect(refusal).toContain(`source_url ${PRODUCT_URL} was never read with web_fetch`);
    expect(done.product?.key_active).toBe("Mullein leaf extract");
    expect(done.run.status).toBe("invalid");
    expect(done.run.error).toContain("no competitor could be profiled");
  });

  it("ends invalid, not failed, when the resolver never submits", async () => {
    faux.provider.setResponses(new ScriptedAgents().on("Product name:", [text("hm"), text("hm"), text("hm")]).steps());
    const runId = await start({ product_name: "mullein lung drops" });
    const ended = await settle(runId, ["invalid", "failed", "awaiting_confirmation"]);
    expect(ended.run.status).toBe("invalid");
    expect(ended.run.error).toContain("ended without an accepted submit");
    expect(ended.run.ended_at).not.toBe("");
  });

  it("is cancelled when stopped while it waits for confirmation", async () => {
    faux.provider.setResponses(new ScriptedAgents().on("Product url:", resolver).steps());
    const runId = await start({ product_url: PRODUCT_URL });
    await settle(runId, ["awaiting_confirmation"]);
    await api(`/runs/${runId}/stop`, {});
    expect((await view(runId)).run.status).toBe("cancelled");
  });

  it("is deleted with everything it wrote once it waits or has ended, and refused while it is working", async () => {
    faux.provider.setResponses(new ScriptedAgents().on("Product url:", resolver).steps());
    const runId = await start({ product_url: PRODUCT_URL });
    await settle(runId, ["awaiting_confirmation"]);
    expect((await pg.db.all("SELECT id FROM llm_calls WHERE run_id = ?", [runId])).length).toBeGreaterThan(0);
    await pg.store.runs.updateRun(runId, { status: "running" });
    const refused = await driver.delete(runId);
    expect(refused.status).toBe(409);
    expect(JSON.stringify(await refused.json())).toContain("stop it before deleting it");
    await pg.store.runs.updateRun(runId, { status: "awaiting_confirmation" });
    expect((await driver.delete(runId)).status).toBe(200);
    expect((await api(`/runs/${runId}`)).status).toBe(404);
    expect(await pg.db.all("SELECT id FROM run_events WHERE run_id = ?", [runId])).toEqual([]);
    expect(await pg.db.all("SELECT id FROM llm_calls WHERE run_id = ?", [runId])).toEqual([]);
  });

  it("refuses a url typed as a product name, and an input with neither", async () => {
    const asName = await api("/runs", { product_name: "https://mullevia.com/products/mullein-drops" });
    expect(asName.status).toBe(422);
    expect(JSON.stringify(await asName.json())).toContain("a url goes in product_url");
    expect((await api("/runs", { markets: ["US"] })).status).toBe(422);
  });
});
