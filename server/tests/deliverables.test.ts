/**
 * What a role must deliver is declared once (spec-research-agent-factory.md §4.2)
 * and read three ways: the prompt's table, the finish check, and the gaps the
 * turn-limit closer writes.
 */
import { describe, expect, it } from "vitest";

import { DeliverableTable, PromptBuilder } from "../src/agent/prompt/index.js";
import { RunFindings } from "../src/agent/run-findings.js";
import { RoleChecks } from "../src/agent/role-checks.js";
import { RowRepair } from "../src/agent/row-repair.js";
import { MemoryLedger } from "./fixtures.js";
import { CATEGORY_DELIVERABLE, COMPETITORS_DELIVERABLE, FORMULA_DELIVERABLE, PRODUCT_DELIVERABLE, Roles, STAGE_NODES, briefSchema, type Finding, type FindingKind } from "../src/domain/index.js";
import { FieldsCheck, ListCheck } from "../src/extract/index.js";

let seq = 0;
const row = (kind: FindingKind, payload: Record<string, unknown>): Finding => {
  seq += 1;
  return { run_id: "r", seq, id: `x${seq}`, kind, entity: "", agent_id: "product", source_id: "", payload, created_at: "", retracted_at: "", retracted_why: "" };
};

describe("the prompt's field table", () => {
  const task = (agent: "product" | "category") =>
    new PromptBuilder().instructions(agent, { brief: briefSchema.parse({ product: "X" }), nodes: STAGE_NODES[1], rejectKinds: [], judgements: [], champion: null });

  it("carries every row the hand-written product table had, word for word", () => {
    // PRODUCT_TASK's table before DeliverableTable rendered it.
    const before = [
      "| `name` | the name as the product's own page writes it, nothing appended |",
      "| `brand` | the brand |",
      "| `form` | the form as the page states it (drops, capsules, gummies…) |",
      "| `dose_per_serving` | the active amount per serving, with its unit |",
      "| `servings_per_container` | servings per pack |",
      "| `full_ingredient_panel` | every ingredient as listed, in order |",
      "| `price` | price and currency for each pack size sold |",
      '| `subscription_terms` | subscribe price, frequency, minimum orders, how to cancel — or "none offered" |',
      '| `claims_made_on_own_site` | the claims the product page makes, word for word, separated by " \\| " |',
      '| `coa_present` | "yes — <where>" if a certificate of analysis is published, else "no" |',
    ];
    for (const line of before) expect(task("product")).toContain(line);
  });

  it("carries every category row, with the trend rule stated from the deliverable", () => {
    const text = task("category");
    expect(text).toContain('| `search_volume` | `record_measurement`, `metric` "search_volume" (or "search_volume: <keyword>"), `unit` "searches", `period` the year or month ("2023", "2024-11"). One row per period. Rows for **at least 3 different years** make the trend. |');
    expect(text).toContain('| `category_size` | `record_measurement`, `metric` "category_size: <segment the source names>", `value` as stated, `unit` currency and scale ("USD billion"), `period` the year it is for |');
    expect(text).toContain('| `seasonality` | `record_attribute`, `key` "seasonality", the months or season demand peaks, in the source\'s words |');
  });

  it("lists optional fields after the compulsory ones, under their own heading", () => {
    const table = DeliverableTable.render(PRODUCT_DELIVERABLE);
    expect(table.indexOf("May also be recorded")).toBeGreaterThan(table.indexOf("`coa_present`"));
    expect(table.indexOf("`ad_activity`")).toBeGreaterThan(table.indexOf("May also be recorded"));
  });
});

describe("FieldsCheck", () => {
  const category = new FieldsCheck(CATEGORY_DELIVERABLE);
  const volume = (period: string) => row("measurement", { node: "category_data", metric: "search_volume: mullein", value: 1, period });

  it("asks for every required field, never an optional one", () => {
    expect(category.missing([]).map((m) => m.key)).toEqual(["search_volume", "category_size", "seasonality"]);
  });

  it("needs search_volume rows for three different years, and a gap closes it instead", () => {
    const two = [volume("2024"), volume("2025-03"), volume("2025-11")];
    expect(category.missing(two).find((m) => m.key === "search_volume")!.text).toMatch(/at least 3 different years/);
    expect(category.missing([...two, volume("2023")]).map((m) => m.key)).not.toContain("search_volume");
    expect(category.missing([row("gap", { node: "category_data", missing: "Search_volume: no history published" })]).map((m) => m.key)).not.toContain("search_volume");
  });

  it("counts a row or gap only on the deliverable's own node", () => {
    const elsewhere = [row("attribute", { node: "product_data", key: "seasonality", value: "winter" }), row("gap", { node: "product_data", missing: "category_size: none" })];
    expect(category.missing(elsewhere).map((m) => m.key)).toEqual(["search_volume", "category_size", "seasonality"]);
  });

  it("asks for a number on the latest regimen row, for a kind with no node", () => {
    const formula = new FieldsCheck(FORMULA_DELIVERABLE);
    const regimen = (perDay: number | null) => row("regimen", { servings_per_day: perDay, servings_per_container: 30 });
    expect(formula.missing([row("active", { name: "mullein" }), regimen(2)])).toEqual([]);
    expect(formula.missing([row("active", { name: "mullein" }), regimen(2), regimen(null)]).map((m) => m.key)).toEqual(["servings_per_day"]);
  });
});

describe("ListCheck", () => {
  const competitors = new ListCheck(COMPETITORS_DELIVERABLE);
  const point = (n: number, added: number) => ({ source_id: `sha256:s${n}`, new_themes: added, cumulative_themes: 0 });
  const curve = (cls: string, added: number[]) => row("saturation", { node: "competitors", class: cls, curve: added.map((a, i) => point(i, a)) });
  const saturated = [curve("indirect_form", [2, 0, 0]), curve("indirect_active", [1, 0, 0])];

  it("refuses a class whose curve ends on two quiet sources, as run f7b10adb's did and passed", () => {
    // Mullevia, 2026-10-02: the direct curve ended 1, 0, 0 and the node was
    // reported complete; the rule is three sources in a row adding nothing.
    const open = competitors.missing([curve("direct", [3, 1, 0, 0]), ...saturated]);
    expect(open.map((m) => m.key)).toEqual(["saturation: direct"]);
    expect(open[0]!.text).toMatch(/ends in 2 sources in a row adding nothing; it is saturated after 3/);
  });

  it("stops an indirect kind after two quiet sources, and direct only after three", () => {
    expect(competitors.missing([curve("direct", [3, 0, 0, 0]), curve("indirect_form", [2, 1, 0]), curve("indirect_active", [1, 0, 0])]).map((m) => m.key)).toEqual(["saturation: indirect_form"]);
    expect(competitors.missing([curve("direct", [3, 0, 0]), ...saturated]).map((m) => m.key)).toEqual(["saturation: direct"]);
  });

  it("accepts three quiet sources in a row, or a gap naming the class", () => {
    expect(competitors.missing([curve("direct", [3, 0, 0, 0]), ...saturated])).toEqual([]);
    expect(competitors.missing([row("gap", { node: "competitors", missing: "saturation: direct: only two brands sell this" }), ...saturated])).toEqual([]);
  });

  it("asks for a curve per class when none is recorded", () => {
    expect(competitors.missing([]).map((m) => m.text)).toEqual([
      expect.stringMatching(/^no direct saturation curve is recorded/),
      expect.stringMatching(/^no indirect_form saturation curve is recorded/),
      expect.stringMatching(/^no indirect_active saturation curve is recorded/),
    ]);
  });

  it("names a competitor missing a required part, tied to its row; an optional part may be empty", () => {
    const item = row("competitor", { node: "competitors", id: "c4", name: "Herbify", form_as_printed: "drops", icp_as_printed: "", price: "" });
    const open = competitors.missing([item, curve("direct", [0, 0, 0]), ...saturated]);
    expect(open).toEqual([{ key: "competitor c4", text: "competitor 'Herbify' has no icp_as_printed — record who its own page says it is for and what it treats, word for word", row: { kind: "competitor", key: "c4" } }]);
  });
});

describe("a competitor row missing a required part", () => {
  it("is refused when it is written, with or without a champion to compare against", () => {
    const findings = new RunFindings(new MemoryLedger(), "r", "competitors", ["competitors"]);
    const competitor = { id: "c1", name: "Herbify", url: "https://herbify.example", relation: "direct", form: "liquid", active_ingredients: [{ name_as_printed: "Mullein", name_normalised: "mullein" }], shared_actives: [], icp_as_printed: "for coughs", source_id: "sha256:a" };
    expect(findings.record("competitor", competitor)).toEqual({ problems: "competitor 'Herbify' has no form_as_printed — record what the product physically is, as printed" });
    expect(findings.record("competitor", { ...competitor, form_as_printed: "1 fl oz drops" })).toHaveProperty("recorded");
  });
});

describe("one LimitClose for every role", () => {
  it("gaps a stage-2 role's open items under its node and writes no status, as TruthLimitClose did", () => {
    const ledger = new MemoryLedger();
    const formula = new RunFindings(ledger, "r", "formula", STAGE_NODES[2]);
    formula.record("source", { id: "sha256:label", url: "https://mullevia.com", title: "Label", kind: "brand_page", node: "dose_vs_study" });
    formula.record("active", { name: "Mullein", amount: null, unit: "", form: "leaf extract", in_blend: false, source_id: "sha256:label" });
    const mechanism = new RunFindings(ledger, "r", "mechanism", STAGE_NODES[2]);
    const role = Roles.of("mechanism");
    const run = { brief: briefSchema.parse({ product: "Mullevia" }), nodes: STAGE_NODES[2], markets: [] };
    const close = RoleChecks.closer(role, mechanism, new RowRepair(ledger, "r", STAGE_NODES[2]), RoleChecks.done(role, mechanism, run), run)!;
    expect(close()).toEqual({ gapped: ["mechanism: Mullein"], retracted: [] });
    expect(mechanism.own().map((row) => [row.kind, row.payload.node, row.payload.missing])).toEqual([["gap", "mechanism", "mechanism: Mullein: not found within the 15-turn limit"]]);
  });

  it("stops the champion without closing anything: it has no node of its own", () => {
    const champion = new RunFindings(new MemoryLedger(), "r", "champion", ["competitors"]);
    const run = { brief: briefSchema.parse({ product: "mullein drops" }), nodes: ["competitors"] as const, markets: [] };
    expect(RoleChecks.closer(Roles.of("champion"), champion, new RowRepair(new MemoryLedger(), "r", ["competitors"]), RoleChecks.done(Roles.of("champion"), champion, run), run)).toBeNull();
  });
});
