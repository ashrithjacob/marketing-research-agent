/** The pipeline: stages run once each, as soon as what they need has completed; one whose input failed is skipped with the reason, and the run's verdict follows the worst stage. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Pipeline, RunEnd, type Stage, type StageInput, type StageOutcome } from "../src/agent/index.js";
import { Stages, type Run, type StageName } from "../src/domain/index.js";
import { App } from "../src/http/index.js";

import { Faux, FakeWeb, NoBilling, FakeVisuals, TestSettings } from "./fakes.js";
import { PAGES, PRODUCT_URL, RESOLUTION, SEARCH_HITS } from "./mullevia.js";
import { PostgresStores } from "./postgres-stores.js";
import { RunDriver } from "./run-driver.js";
import { ScriptedAgents } from "./scripted-agents.js";

class FakeStage implements Stage {
  readonly order: string[];

  constructor(
    readonly name: StageName,
    private readonly status: StageOutcome["status"],
    order: string[],
  ) {
    this.order = order;
  }

  async run(input: StageInput): Promise<StageOutcome> {
    this.order.push(`${this.name}:${input.product.url}`);
    await new Promise((resolve) => setTimeout(resolve, 5));
    return { status: this.status, summary: `${this.name} ran`, error: this.status === "completed" ? "" : `${this.name} broke` };
  }
}

let pg: PostgresStores;

beforeAll(async () => {
  pg = await PostgresStores.start();
});

afterAll(async () => {
  await pg.stop();
});

describe("the pipeline", () => {
  it("runs the four streams, skips avatars when one of them failed, and ends the run failed with that stage's reason", async () => {
    const order: string[] = [];
    const pipeline = new Pipeline([
      new FakeStage("product_market", "completed", order),
      new FakeStage("sophistication", "failed", order),
      new FakeStage("reviews", "completed", order),
      new FakeStage("avatars", "completed", order),
    ]);
    const faux = new Faux();
    faux.provider.setResponses(
      new ScriptedAgents()
        .on("Product url:", [ScriptedAgents.call("web_fetch", { url: PRODUCT_URL }), ScriptedAgents.call("web_search", { query: "x" }), ScriptedAgents.call("submit", RESOLUTION)])
        .steps(),
    );
    const { settings, traces } = TestSettings.make();
    const app = new App({ settings, traces, store: pg.store, services: new FakeWeb(PAGES, SEARCH_HITS).services(), models: faux.models, generations: new NoBilling(), visuals: new FakeVisuals(), pipeline });
    const post = (path: string, body: unknown) => app.fetch(new Request(`http://test/api/research${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
    const get = async (id: string) => ((await (await app.fetch(new Request(`http://test/api/research/runs/${id}`))).json()) as { run: Run }).run;
    const wait = async (id: string, statuses: string[]) => {
      for (let i = 0; i < 300 && !statuses.includes((await get(id)).status); i++) await new Promise((r) => setTimeout(r, 10));
      return get(id);
    };

    const { run } = (await (await post("/runs", { product_url: PRODUCT_URL })).json()) as { run: Run };
    await wait(run.id, ["awaiting_confirmation"]);
    await post(`/runs/${run.id}/confirm`, { product_url: PRODUCT_URL, competitors: [{ brand: "A", product_name: "A", url: "https://a.example/p" }] });
    const ended = await wait(run.id, ["completed", "failed", "invalid"]);

    expect(order.sort()).toEqual([`product_market:${PRODUCT_URL}`, `reviews:${PRODUCT_URL}`, `sophistication:${PRODUCT_URL}`]);
    expect(ended.stage_status.avatars).toMatchObject({ status: "skipped", error: "needs sophistication, which did not complete" });
    expect(ended.stage_status.competitor_ads.status).toBe("not_built");
    expect(ended.stage_status.gaps.status).toBe("not_built");
    expect(ended.status).toBe("failed");
    expect(ended.error).toBe("sophistication: sophistication broke");
  });
});

class FlakyStage extends FakeStage {
  private failed = false;

  override async run(input: StageInput): Promise<StageOutcome> {
    const outcome = await super.run(input);
    if (this.failed) return { status: "completed", summary: "worked the second time", error: "" };
    this.failed = true;
    return { ...outcome, status: "failed", error: "TrendTrack said no" };
  }
}

describe("a rerun", () => {
  it("runs only the stages that did not complete, keeps the rest, and ends with the cost of both attempts", async () => {
    const order: string[] = [];
    const pipeline = new Pipeline([new FakeStage("product_market", "completed", order), new FlakyStage("competitor_ads", "completed", order), new FakeStage("avatars", "completed", order)]);
    const faux = new Faux();
    faux.provider.setResponses(
      new ScriptedAgents()
        .on("Product url:", [ScriptedAgents.call("web_fetch", { url: PRODUCT_URL }), ScriptedAgents.call("web_search", { query: "x" }), ScriptedAgents.call("submit", RESOLUTION)])
        .steps(),
    );
    const { settings, traces } = TestSettings.make();
    const app = new App({ settings, traces, store: pg.store, services: new FakeWeb(PAGES, SEARCH_HITS).services(), models: faux.models, generations: new NoBilling(), visuals: new FakeVisuals(), pipeline });
    const driver = new RunDriver(app);
    const runId = await driver.start({ product_url: PRODUCT_URL });
    const first = await driver.confirmAndFinish(runId, { product_url: PRODUCT_URL, competitors: [{ brand: "A", product_name: "A", url: "https://a.example/p" }] });
    expect(first.run.status).toBe("failed");
    expect(first.run.stage_status.avatars.status).toBe("skipped");
    expect(order.map((o) => o.split(":")[0])).toEqual(["product_market", "competitor_ads"]);

    const rerun = await driver.api(`/runs/${runId}/rerun`, {});
    expect(rerun.status).toBe(200);
    const done = await driver.settle(runId, ["completed", "failed", "invalid"]);
    expect(done.run.status).toBe("completed");
    expect(done.run.error).toBe("");
    expect(order.map((o) => o.split(":")[0])).toEqual(["product_market", "competitor_ads", "competitor_ads", "avatars"]);
    expect(done.run.stage_status.competitor_ads.summary).toBe("worked the second time");
    expect((await driver.api(`/runs/${runId}/rerun`, {})).status).toBe(409);
    expect((await driver.api(`/runs/${runId}/rerun`, { stages: ["gaps"] })).status).toBe(409);

    const chosen = await driver.api(`/runs/${runId}/rerun`, { stages: ["competitor_ads"] });
    expect(chosen.status).toBe(200);
    const again = await driver.settle(runId, ["completed", "failed", "invalid"]);
    expect(again.run.status).toBe("completed");
    expect(again.run.stage_status.product_market).toEqual(done.run.stage_status.product_market);
    expect(order.map((o) => o.split(":")[0])).toEqual(["product_market", "competitor_ads", "competitor_ads", "avatars", "competitor_ads", "avatars"]);

    await driver.api(`/runs/${runId}/rerun`, { stages: ["product_market", "competitor_ads", "avatars"] });
    await driver.settle(runId, ["completed", "failed", "invalid"]);
    expect(order.slice(6).map((o) => o.split(":")[0]).sort()).toEqual(["avatars", "competitor_ads", "product_market"]);
  });
});

describe("a rerun of one stage alone", () => {
  it("runs only that stage, and a stage that uses it keeps the state it had, skipped included", async () => {
    const order: string[] = [];
    const pipeline = new Pipeline([new FakeStage("product_market", "completed", order), new FlakyStage("competitor_ads", "completed", order), new FakeStage("avatars", "completed", order)]);
    const faux = new Faux();
    faux.provider.setResponses(
      new ScriptedAgents()
        .on("Product url:", [ScriptedAgents.call("web_fetch", { url: PRODUCT_URL }), ScriptedAgents.call("web_search", { query: "x" }), ScriptedAgents.call("submit", RESOLUTION)])
        .steps(),
    );
    const { settings, traces } = TestSettings.make();
    const app = new App({ settings, traces, store: pg.store, services: new FakeWeb(PAGES, SEARCH_HITS).services(), models: faux.models, generations: new NoBilling(), visuals: new FakeVisuals(), pipeline });
    const driver = new RunDriver(app);
    const runId = await driver.start({ product_url: PRODUCT_URL });
    const first = await driver.confirmAndFinish(runId, { product_url: PRODUCT_URL, competitors: [{ brand: "A", product_name: "A", url: "https://a.example/p" }] });
    expect(first.run.stage_status.avatars.status).toBe("skipped");

    expect((await driver.api(`/runs/${runId}/rerun`, { stages: ["competitor_ads"], alone: true })).status).toBe(200);
    const done = await driver.settle(runId, ["completed", "failed", "invalid"]);
    expect(order.map((o) => o.split(":")[0])).toEqual(["product_market", "competitor_ads", "competitor_ads"]);
    expect(done.run.stage_status.competitor_ads).toMatchObject({ status: "completed", summary: "worked the second time" });
    expect(done.run.stage_status.avatars).toEqual(first.run.stage_status.avatars);
  });
});

describe("what a rerun runs", () => {
  it("is the chosen stages, every built stage downstream of them, and any stage that did not complete", () => {
    const built = ["product_market", "reviews", "competitor_ads", "avatars"] as const;
    expect(Stages.downstream("product_market", built)).toEqual(["product_market", "competitor_ads", "avatars"]);
    expect(Stages.downstream("reviews", built)).toEqual(["reviews", "avatars"]);
    expect(Stages.downstream("avatars", built)).toEqual(["avatars"]);
    const states = Stages.initial([...built]);
    for (const name of built) states[name].status = "completed";
    expect(Stages.toRerun(states, built, [])).toEqual([]);
    expect(Stages.toRerun(states, built, ["reviews"])).toEqual(["reviews", "avatars"]);
    states.competitor_ads.status = "failed";
    expect(Stages.toRerun(states, built, ["reviews"])).toEqual(["reviews", "competitor_ads", "avatars"]);
    const reset = Stages.rerun(states, built, ["reviews", "avatars"]);
    expect([reset.product_market.status, reset.reviews.status, reset.avatars.status, reset.gaps.status]).toEqual(["completed", "pending", "pending", "not_built"]);
  });
});

describe("the verdict", () => {
  it("is cancelled when stopped, failed over invalid, and completed when nothing went wrong", () => {
    const states = Stages.initial(["product_market", "reviews"]);
    expect(RunEnd.verdict(states, true).status).toBe("cancelled");
    states.product_market.status = "invalid";
    expect(RunEnd.verdict(states, false).status).toBe("invalid");
    states.reviews.status = "failed";
    expect(RunEnd.verdict(states, false).status).toBe("failed");
    expect(RunEnd.verdict(Stages.initial(["product_market"]), false).status).toBe("completed");
  });
});
