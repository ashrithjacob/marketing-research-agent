/**
 * Product truth's arithmetic and its "done" rules (spec-stage-2-product-truth.md
 * §1–2). The inputs are Mullevia Mullein Drops as stage-1 run c0f14d91 recorded
 * them on 2026-09-30: five actives printed with no amounts, 1 mL twice daily,
 * and no bottle size — so every dose is unassessable, which is the finding.
 */
import { describe, expect, it } from "vitest";

import { DOSE_BANDS, type Active, type DoseStudy, type Finding, type FindingKind, type Mechanism } from "../src/domain/index.js";
import { DoseBands, ProductEconomics, ProductTruthCoverage, RowPicks, TruthCitations } from "../src/extract/index.js";

const MULLEVIA = ["Wildcrafted Mullein leaf", "Ginger", "Bromelain", "Cordyceps", "Lemon Peel"];
const active = (name: string, amount: number | null = null, unit = "", in_blend = false): Active => ({ name, amount, unit, form: "", in_blend, source_id: "sha256:label" });
const regimen = { servings_per_day: 2, servings_per_container: 30, directions_as_printed: "Take 1 mL in water twice daily", source_id: "sha256:label" };
const study = (over: Partial<DoseStudy> = {}): DoseStudy => ({
  active: "Bromelain", studied_daily_dose: 600, unit: "mg", studied_form: "oral capsules", study: "RCT 2021, n=40",
  human_study: true, form_match: "same oral enzyme", source_id: "sha256:pmc", ...over,
});

let seq = 0;
const row = (kind: FindingKind, payload: Record<string, unknown>, agent = "formula"): Finding => {
  seq += 1;
  return { run_id: "r", seq, id: `${kind}${seq}`, kind, entity: "product", agent_id: agent, source_id: String(payload.source_id ?? ""), payload, created_at: "", retracted_at: "", retracted_why: "" };
};

describe("dose bands", () => {
  it("leaves every Mullevia active unassessable: the label states no amounts", () => {
    for (const name of MULLEVIA) {
      const assessed = DoseBands.assess(active(name), regimen, undefined);
      expect(assessed).toMatchObject({ class: "unassessable", ratio: null, our_daily_dose: null });
      expect(assessed.why).toMatch(/states no amount/);
    }
  });

  it("classes at the operator's bands: at dose from 0.8, partial from 0.5, under dose below", () => {
    expect(DOSE_BANDS).toEqual({ at_dose: 0.8, partial: 0.5 });
    expect(DoseBands.classOf(0.8)).toBe("at_dose");
    expect(DoseBands.classOf(0.799)).toBe("partial");
    expect(DoseBands.classOf(0.5)).toBe("partial");
    expect(DoseBands.classOf(0.499)).toBe("under_dose");
  });

  it("compares a day of ours with a day of the study's: amount per serving times servings per day", () => {
    const assessed = DoseBands.assess(active("Bromelain", 200, "mg"), regimen, study());
    expect(assessed).toMatchObject({ our_daily_dose: 400, studied_daily_dose: 600, ratio: 0.667, class: "partial" });
  });

  it("says why an active cannot be assessed, in the order a reader would look", () => {
    expect(DoseBands.assess(active("Bromelain", 200, "mg", true), regimen, study()).why).toMatch(/proprietary blend/);
    expect(DoseBands.assess(active("Bromelain", 200, "mg"), regimen, undefined).why).toMatch(/no study was recorded/);
    expect(DoseBands.assess(active("Bromelain", 200, "mg"), regimen, study({ human_study: false, studied_daily_dose: null })).why).toMatch(/no human study/);
    expect(DoseBands.assess(active("Bromelain", 200, "mg"), { ...regimen, servings_per_day: null }, study()).why).toMatch(/servings per day are not known/);
  });
});

describe("economics", () => {
  const mullein = (time_to_effect: Mechanism["time_to_effect"]): Mechanism => ({
    active: "Wildcrafted Mullein leaf", pathway: "saponins loosen mucus", time_to_effect, magnitude: "no human data", story_weight: "carrier", source_id: "sha256:pmc",
  });

  it("counts days of supply from the label, and gaps them when the bottle size is unknown, as on Mullevia", () => {
    expect(ProductEconomics.of(regimen, [], [], null).days_of_supply).toBe(15);
    const unknown = ProductEconomics.of({ ...regimen, servings_per_container: null }, [], [], null);
    expect(unknown).toMatchObject({ days_of_supply: null, days_why: "servings per container are not known" });
    expect(unknown.churn.mismatch).toBeNull();
  });

  it("flags churn when a container runs out before a carrier active is said to work", () => {
    expect(ProductEconomics.churn(15, [mullein({ value: 3, unit: "weeks" })])).toMatchObject({ mismatch: true, carriers: [{ time_to_effect_days: 21, runs_out_first: true }] });
    expect(ProductEconomics.churn(15, [mullein({ value: 2, unit: "weeks" })]).mismatch).toBe(false);
    expect(ProductEconomics.churn(15, [mullein(null)])).toMatchObject({ mismatch: null, why: "no carrier active has a time to effect" });
    expect(ProductEconomics.churn(15, [{ ...mullein({ value: 1, unit: "months" }), story_weight: "supporting" }]).mismatch).toBeNull();
  });

  it("computes margin per unit from the operator's landed cost, never across currencies, never without a cost", () => {
    const bottle = { label: "1 bottle", amount: 26.95, currency: "USD", units: 1, subscription: false, market: "US", source_id: "sha256:shop" };
    const three = { ...bottle, label: "3 bottles", amount: 69.95, units: 3 };
    const cost = { landed_unit_cost: 4.1, currency: "USD", moq: 500, lead_time_days: 30 };
    expect(ProductEconomics.margin(bottle, cost)).toMatchObject({ unit_price: 26.95, margin: 0.848 });
    expect(ProductEconomics.margin(three, cost)).toMatchObject({ unit_price: 23.32, margin: 0.824 });
    expect(ProductEconomics.margin({ ...bottle, currency: "SGD" }, cost)).toMatchObject({ margin: null, why: "the price is in SGD and the landed cost in USD" });
    expect(ProductEconomics.margin(bottle, null)).toMatchObject({ margin: null, why: "no landed unit cost was entered" });
  });
});

describe("what each agent must leave recorded or gapped", () => {
  const actives = MULLEVIA.map((name) => row("active", active(name)));

  it("asks the formula for actives and both regimen numbers, each closed by a row or a gap", () => {
    const empty = new ProductTruthCoverage([], ["US"]);
    expect(empty.open("formula").map((i) => i.key)).toEqual(["actives", "servings_per_day", "servings_per_container"]);
    const done = new ProductTruthCoverage([
      ...actives,
      row("regimen", { ...regimen, servings_per_container: null }),
      row("gap", { node: "dose_vs_study", missing: "servings_per_container: bottle size not stated anywhere" }),
    ], ["US"]);
    expect(done.open("formula")).toEqual([]);
  });

  it("asks the mechanism agent for every active, a time to effect for each, and one carrier", () => {
    const coverage = new ProductTruthCoverage([
      ...actives,
      row("mechanism", { active: "wildcrafted mullein LEAF", pathway: "p", time_to_effect: null, magnitude: "m", story_weight: "supporting", source_id: "s" }, "mechanism"),
    ], []);
    const keys = coverage.open("mechanism").map((i) => i.key);
    expect(keys).toContain("time_to_effect: Wildcrafted Mullein leaf");
    expect(keys).toContain("mechanism: Ginger");
    expect(keys).toContain("carrier");
    expect(keys).not.toContain("mechanism: Wildcrafted Mullein leaf");
  });

  it("asks for a study only for actives with an amount outside a blend — none on Mullevia", () => {
    expect(new ProductTruthCoverage(actives, []).open("dose_vs_study")).toEqual([]);
    const stated = new ProductTruthCoverage([row("active", active("Bromelain", 100, "mg")), row("active", active("Ginger", 50, "mg", true))], []);
    expect(stated.open("dose_vs_study").map((i) => i.key)).toEqual(["dose: Bromelain"]);
  });

  it("asks for every market in the brief on both Meta and Google Ads", () => {
    const keys = new ProductTruthCoverage([], ["US", "UK"]).open("claim_limits").map((i) => i.key);
    expect(keys).toEqual(["claims: US / meta", "claims: US / google_ads", "claims: UK / meta", "claims: UK / google_ads"]);
    expect(new ProductTruthCoverage([], []).open("claim_limits").map((i) => i.key)).toEqual(["claims: market"]);
  });
});

describe("picks checked when a row is written", () => {
  const live = [row("active", active("Bromelain", 100, "mg")), row("active", active("Ginger"))];

  it("refuses a mechanism or study for an active the formula did not record", () => {
    const [problem] = RowPicks.problems("mechanism", { active: "Mullein" }, live, []);
    expect(problem).toMatch(/'Mullein' is not a recorded active; copy one name word for word from the formula's actives: Bromelain, Ginger/);
    expect(RowPicks.problems("mechanism", { active: "bromelain " }, live, [])).toEqual([]);
  });

  it("refuses a studied dose in another unit than the label's, so the ratio never mixes units", () => {
    expect(RowPicks.problems("dose_study", { active: "Bromelain", studied_daily_dose: 0.6, unit: "g" }, live, [])[0]).toMatch(/convert the studied daily dose to mg/);
    expect(RowPicks.problems("dose_study", { active: "Bromelain", studied_daily_dose: 600, unit: "MG" }, live, [])).toEqual([]);
    expect(RowPicks.problems("dose_study", { active: "Ginger", studied_daily_dose: 1, unit: "g" }, live, [])).toEqual([]);
  });

  it("refuses a claim limit for a market the brief does not name", () => {
    expect(RowPicks.problems("claim_limit", { market: "Germany" }, [], ["US", "UK"])[0]).toMatch(/not one of the brief's markets; copy one word for word: US, UK/);
    expect(RowPicks.problems("claim_limit", { market: "uk" }, [], ["US", "UK"])).toEqual([]);
  });
});

describe("citations", () => {
  it("ties a row citing an unrecorded source to that row, so settlement can retract it into a gap", () => {
    const live = [row("source", { id: "sha256:pmc", node: "mechanism" }), row("claim_limit", { market: "US", platform: "meta", source_ids: ["sha256:pmc", "sha256:ftc"] }, "claim_limits")];
    const [problem, ...rest] = TruthCitations.problems(live.filter((r) => r.agent_id === "claim_limits"), live);
    expect(rest).toEqual([]);
    expect(problem!.text).toMatch(/cites source 'sha256:ftc', which no one recorded/);
    expect(problem!.row).toEqual({ kind: "claim_limit", key: "us:meta" });
  });
});
