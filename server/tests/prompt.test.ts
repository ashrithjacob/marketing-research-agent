/**
 * The instructions.
 *
 * The prompt is the half of the contract the validator cannot enforce, so the
 * tests here are about what it *says*: a rule that quietly stops being stated is
 * a rule the model stops following, and the failure only shows up as a rejected
 * packet at the end of an expensive run.
 */

import { describe, expect, it } from "vitest";

import { FindingCheck, PacketError, PacketValidator } from "../src/extract/index.js";

import {
  FORMS,
  NODES,
  PRODUCT_ATTRIBUTES,
  SOURCE_KINDS,
  STAGE_NODES,
  STAGE_ONE_AGENT_SPECS,
  briefSchema,
} from "../src/domain/index.js";
import type { Judgement, StageOneAgent } from "../src/domain/index.js";
import { AgentMessages, PromptBuilder } from "../src/agent/prompt/index.js";
import { RECORD_TOOLS } from "../src/agent/prompt/text/record-tools.js";

const prompts = new PromptBuilder();

const packets = new PacketValidator();

/** The JSON a record tool's description shows the model. */
const exampleOf = (name: string): Record<string, any> => {
  const description = RECORD_TOOLS.find((t) => t.name === name)!.description;
  return JSON.parse(description.slice(description.indexOf("Example: ") + "Example: ".length));
};

const brief = (overrides: Record<string, unknown> = {}) =>
  briefSchema.parse({ product: "MagnaCalm", ...overrides });

const CHAMPION = { name: "MagnaCalm Glycinate", form: "capsule", actives: ["magnesium glycinate"] };

const build = (overrides: Record<string, unknown> = {}, agent: StageOneAgent = "product") =>
  prompts.instructions(agent, {
    brief: brief(),
    nodes: STAGE_NODES[1],
    rejectKinds: [],
    judgements: [],
    champion: CHAMPION,
    ...(overrides as Record<string, never>),
  });

const AGENTS = ["champion", "product", "competitors", "category"] as const;

const system = (agent: StageOneAgent, options: { amazon: boolean; waits: boolean; discovery?: boolean; ads?: boolean } = { amazon: true, waits: true }) => prompts.system(agent, options);

describe("the record examples", () => {
  it("are each a record the ledger accepts", () => {
    // If an example drifts out of the contract, every run copies the drift.
    for (const spec of RECORD_TOOLS) {
      const checked = FindingCheck.check(spec.kind, exampleOf(spec.name), NODES);
      expect(checked, spec.name).toHaveProperty("payload");
    }
  });
});

describe("what every agent is told about sources", () => {
  it("names every source kind the validator accepts", () => {
    // The first live run invented seven kinds that were not in the enum and the
    // whole packet was rejected for it.
    for (const agent of AGENTS) for (const kind of SOURCE_KINDS) expect(build({}, agent)).toContain(`\`${kind}\``);
  });

  it("tells the agent to cite the source_id web_fetch hands back, verbatim", () => {
    expect(build()).toMatch(/`id` is the `source_id`\s+the fetch returned, verbatim/);
    expect(build()).toMatch(/Never record\s+or cite a search snippet/);
  });

  it("lists this run's rejected kinds", () => {
    expect(build({ rejectKinds: ["ai_generated"] })).toContain("  - `ai_generated`");
  });

  it("files every row under the agent's own node", () => {
    expect(build()).toContain('Every row you record carries `node: "product_data"`');
    expect(build({}, "category")).toContain('Every row you record carries `node: "category_data"`');
    expect(build({}, "competitors")).toContain('Every row you record carries `node: "competitors"`');
  });

  it("files the champion under competitors, or under the run's first node without it", () => {
    expect(build({}, "champion")).toContain('carries `node: "competitors"`');
    expect(build({ nodes: ["product_data"] }, "champion")).toContain('carries `node: "product_data"`');
  });

  it("states that a step-2 agent's part needs a gap", () => {
    for (const agent of ["product", "competitors", "category"] as const) expect(build({}, agent)).toMatch(/At least one gap is\s+required/);
  });
});

describe("the product agent", () => {
  it("is given its ten fields first, and may keep other facts after them", () => {
    const text = build();
    for (const key of PRODUCT_ATTRIBUTES) expect(text).toContain(`| \`${key}\` |`);
    expect(text).toMatch(/after the ten, never instead of them/);
  });

  it("tells every agent its turn limit, and what happens when it runs out", () => {
    const turns = (agent: StageOneAgent) => STAGE_ONE_AGENT_SPECS[agent].maxTurns;
    expect(build()).toMatch(new RegExp(`You have ${turns("product")} turns[\\s\\S]*every field still open is recorded as a gap for you`));
    expect(build({}, "category")).toContain(`You have ${turns("category")} turns`);
    expect(build({}, "competitors")).toContain(`You have ${turns("competitors")} turns`);
    expect(build({}, "champion")).toMatch(new RegExp(`You have ${turns("champion")} turns[\\s\\S]*you stop, with what you have recorded`));
  });

  it("is told where to look, to record as it reads, and to search only for what is missing", () => {
    const text = build();
    expect(text).toMatch(/Shopify `\.json`/);
    expect(text).toMatch(/Record as you read: in the same turn as a fetch you use/);
    expect(text).toMatch(/Search only for fields still missing/);
    expect(text).toMatch(/`record_gap` with missing "<key>: <why>"/);
  });

  it("gets none of the generic rules it used to carry", () => {
    // Run 0dc7e23c: told "excerpts are what you're here for", the product agent
    // recorded 61 excerpts of marketing copy and spent most of its 10 minutes on them.
    const text = build();
    expect(text).not.toMatch(/excerpt/i);
    expect(text).not.toMatch(/saturation/i);
  });
});

describe("the category agent", () => {
  it("is given its three fields first, a three-year trend, and where to find them", () => {
    const text = build({}, "category");
    expect(text).toMatch(/after the three, never instead\s+of them/);
    for (const field of ["search_volume", "category_size", "seasonality"]) expect(text).toContain(`| \`${field}\` |`);
    expect(text).toMatch(/at least three different years/);
    expect(text).toMatch(/Exploding Topics/);
    expect(text).not.toMatch(/excerpt/i);
  });

  it("stops chasing a field after two failed routes", () => {
    // Run 0dc7e23c: 18 of the category agent's 50 turns chased a three-year trend
    // through Google Trends, which refused every route, before gapping it.
    const text = build({}, "category");
    expect(text).toMatch(/Two failed routes to a field is enough/);
    expect(text).toMatch(/Google Trends\s+blocks automated reads: try it once at most/);
  });
});

describe("the brief block", () => {
  it("names a site brief as a site, never as a product", () => {
    // The old shape printed "**Product:** <url>", and a run spent a turn on the
    // contradiction before inventing a name that failed validation.
    const text = build({ brief: brief({ product: "", url: "https://thedropletco.co.uk/" }) });
    expect(text).toContain("**Site:** https://thedropletco.co.uk/");
    expect(text).not.toMatch(/\*\*Product:\*\*/);
  });

  it("asks the product agent for the name as its own page writes it", () => {
    expect(build()).toMatch(/the name as the product's own page writes it, nothing appended/);
  });

  it("carries the market and notes when given", () => {
    const text = build({ brief: brief({ market: "UK", notes: "focus on sleep" }) });
    expect(text).toContain("**Market:** UK");
    expect(text).toContain("focus on sleep");
  });

  it("makes a single market a scope, not a hint", () => {
    // The cockpit ticks five markets by default, so "market" has to mean
    // "only here" — a run that wanders spends its budget on unusable sources.
    const text = build({ brief: brief({ market: "UK" }) });
    expect(text).toContain("Research only this market");
    expect(text).toMatch(/outside it is out of scope/);
  });

  it("pluralises and still restricts a list of markets", () => {
    const text = build({
      brief: brief({ market: "US, UK, Australia, New Zealand, Canada" }),
    });
    expect(text).toContain("**Markets:** US, UK, Australia, New Zealand, Canada");
    expect(text).toContain("Research only these markets");
    expect(text).toMatch(/gap entry naming the market/);
  });

  it("says nothing about markets when the brief names none", () => {
    const text = build({ brief: brief({ market: "" }) });
    expect(text).not.toMatch(/Research only th/);
  });
});

describe("standing judgements", () => {
  const judgement: Judgement = {
    id: "j1",
    workspace_id: "admin",
    kind: "source_rule",
    text: "reject anything from top10supplementpicks",
    rejects_kinds: ["seo_listicle"],
    active: true,
    applied_count: 0,
    created_at: "",
  };

  it("reaches the instructions", () => {
    const text = build({ judgements: [judgement] });
    expect(text).toContain("## Standing judgements");
    expect(text).toContain("reject anything from top10supplementpicks");
  });

  it("is absent when there are none", () => {
    expect(build()).not.toContain("## Standing judgements");
  });

  it("becomes a rule, not a request, when steered mid-run", () => {
    const text = AgentMessages.steer(judgement);
    expect(text).toMatch(/apply it for the rest of the run/);
    expect(text).toContain("`seo_listicle`");
    expect(text).toMatch(/admitted: false/);
  });
});

describe("the system prompt", () => {
  it("names both tools and says a snippet is not a source", () => {
    const text = system("product");
    expect(text).toContain("web_search");
    expect(text).toContain("web_fetch");
    expect(text).toMatch(/A snippet is never a source/);
  });

  it("tells each agent who it is, its own role, and that the ledger is shared", () => {
    const roles = new Set<string>();
    for (const agent of AGENTS) {
      const text = system(agent);
      expect(text).toMatch(new RegExp(`^You are the \`${agent}\` agent\\. `));
      expect(text).toMatch(/You read every row and\s+change only your own/);
      expect(text).toContain("`read_ledger`");
      roles.add(text.split("\n")[0]!);
    }
    expect(roles.size).toBe(4);
  });

  it("names wait_for only to an agent that has it", () => {
    expect(system("product")).toContain("`wait_for`");
    expect(system("champion", { amazon: true, waits: false })).not.toContain("`wait_for`");
  });
});

describe("each agent gets only its own task", () => {
  it("sends the champion agent ranking the genre on Amazon when the brief names no url", () => {
    // The brief names a genre; "the first plausible match" is not the champion.
    const text = build({}, "champion");
    expect(text).toMatch(/The listing with the highest\s+`reviewsCount` is the champion/);
    expect(text).toMatch(/`runner_up_name`,\s+`runner_up_reviews`/);
    expect(text).toMatch(/`icp` is the customer: who the page\s+says the product is for and the problem it solves/);
    expect(text).toMatch(/champion ranking unavailable/);
    expect(text).not.toContain("## The champion\n");
  });

  it("sends the champion agent to the brief's site, then to its Amazon listing, on a url brief", () => {
    const text = build({ brief: brief({ product: "", url: "https://mullevia.com/products/drops" }) }, "champion");
    expect(text).toMatch(/The \*\*champion\*\* is the product it sells/);
    expect(text).toMatch(/`amazon_find_product` with the brand and product name/);
    expect(text).toMatch(/`amazon_url` is "" and `reviews_count` is 0/);
  });

  it("hands every step-2 agent the champion as the ledger holds it", () => {
    for (const agent of ["product", "competitors", "category"] as const) {
      const text = build({}, agent);
      expect(text).toContain("## The champion");
      expect(text).toContain('"name": "MagnaCalm Glycinate"');
    }
  });

  it("says when no champion was looked up", () => {
    const text = build({ brief: brief({ product: "", url: "https://x.example" }), champion: null });
    expect(text).toMatch(/No champion was looked up for this run: the product is the one https:\/\/x\.example sells/);
  });

  it("stops competitors on saturation, and product and category on their fields", () => {
    expect(build({}, "competitors")).toMatch(/three sources in a row surface no new\s+brand of that class/);
    expect(build()).toMatch(/When all ten are recorded or gapped/);
    expect(build({}, "category")).toMatch(/When all three are recorded or gapped/);
  });

  it("keeps each agent to its own task", () => {
    expect(build()).not.toContain("## Your task: the competitors");
    expect(build({}, "category")).not.toContain("## Your task: the product's fact sheet");
    expect(build({}, "competitors")).not.toContain("## Your task: the category's numbers");
  });
});

describe("the competitors agent", () => {
  it("states the mechanical test and the per-class saturation", () => {
    const text = build({}, "competitors");
    expect(text).toMatch(/\*\*direct\*\* — the champion's customer, \*\*same\*\* form/);
    expect(text).toMatch(/\*\*indirect\*\* — the champion's customer, \*\*different\*\* form/);
    expect(text).toMatch(/`record_saturation` twice, `class` "direct" and\s+"indirect"/);
    expect(text).not.toMatch(/same problem, different active/);
  });

  it("calls discover_competitors first when it has it, and treats what it names as candidates", () => {
    const text = build({}, "competitors");
    expect(text).toMatch(/If you have `discover_competitors`, call it first, once/);
    expect(text).toMatch(/A search result, an ad or a discovered brand is a candidate,\s+not a competitor/);
    expect(system("competitors", { amazon: true, waits: true, discovery: true })).toContain("- `discover_competitors` — once:");
    expect(system("competitors")).not.toContain("discover_competitors");
    expect(system("competitors")).toContain("every brand selling to its customer");
  });

  it("sends product, competitors and category to the Meta ad library, each for its own reason", () => {
    expect(system("product", { amazon: false, waits: true, ads: true })).toContain("- `ad_library_search` — Meta ads, live and past");
    expect(system("product", { amazon: false, waits: true })).not.toContain("ad_library_search");
    expect(build({}, "product")).toMatch(/search the brand's\s+own domain \(`search_in` "domain"/);
    expect(build({}, "product")).toMatch(/`ad_activity` \(how many ads, which pages run them,\s+first and last seen\) and `ad_claims`/);
    expect(build({}, "category")).toMatch(/`metric` "meta_ads_matching: <query>", `unit` "ads"/);
    expect(build({}, "competitors")).toMatch(/brands that sell only through Meta ads appear\s+there and nowhere else/);
  });

  it("makes the champion's customer the whole test of a competitor, whatever its actives", () => {
    const text = build({}, "competitors");
    expect(text).toMatch(/sells to the champion's customer: its `icp` below — the\s+same people, with the same problem/);
    expect(text).toMatch(/not one,\s+even when it shares an active/);
    expect(text).toMatch(/A product for the same people and\s+problem is one, whatever its actives/);
    expect(text).toMatch(/`icp_as_printed` — who its own page says it is for/);
    expect(text).toMatch(/or \[\] when it shares none/);
    expect(text).toMatch(/If that audience or problem differs from the champion's `icp`,\s+it is not a competitor, \*\*even with the same active\*\*: record nothing for it/);
  });

  it("has shared actives copied from the champion's list, and says once what sharing an active means", () => {
    const text = build({}, "competitors");
    expect(text).toMatch(/copied word for word from the champion's list below/);
    expect(text).toMatch(/whatever its page calls it — a Latin name, another part or\s+preparation of the same plant/);
    expect(text).toMatch(/A different\s+compound \(another salt of a mineral, another plant\) is a different active/);
  });

  it("measures competitors against the champion instead of choosing one", () => {
    const text = build({}, "competitors");
    expect(text).toMatch(/the champion's customer: its `icp` below/);
    expect(text).not.toMatch(/highest\s+`reviewsCount`/);
  });

  it("names every form the validator accepts", () => {
    for (const agent of ["competitors", "champion"] as const) {
      const text = build({}, agent);
      for (const form of FORMS) expect(text).toContain(`\`${form}\``);
    }
  });

  it("shows the champion's ranking evidence in the example", () => {
    // A genre brief's champion check applies to what the example teaches: the
    // evidence it shows must be a real ranking.
    const reference = exampleOf("record_reference");
    expect(reference.reviews_count).toBeGreaterThan(0);
    expect(reference.runner_up_name).not.toBe("");
    expect(reference.runner_up_reviews).toBeLessThanOrEqual(reference.reviews_count);
  });
});

describe("the system prompt names only the tools an agent is given", () => {
  // The first competitors-only run gapped "amazon_reviews was not available" —
  // told about tools it did not have, it reported their absence as a finding.
  it("gives the product agent web search and fetch, and its own four record tools", () => {
    const text = system("product", { amazon: false, waits: true });
    expect(text).toContain("web_fetch");
    expect(text).not.toMatch(/amazon_|trustpilot_/);
    expect(text).toContain("`record_source`, `record_attribute`, `record_node_status`, `record_gap` — write one row");
    expect(text).toContain("`finish` — check your part of the ledger");
  });

  it("gives the category agent measurements and one attribute, no excerpts", () => {
    expect(system("category")).toContain("`record_source`, `record_measurement`, `record_attribute`, `record_node_status`, `record_gap`");
    expect(system("category")).not.toContain("record_excerpt");
  });

  it("gives the competitors agent Amazon search and competitor rows, and no review tools", () => {
    const text = system("competitors");
    expect(text).toMatch(/`amazon_find_product` — .*a way to find competitors/);
    expect(text).toContain("`record_competitor`");
    expect(text).not.toMatch(/amazon_reviews|trustpilot_reviews|mine_reviews|record_excerpt/);
  });

  it("gives the champion agent the reference and not the node records", () => {
    const text = system("champion", { amazon: true, waits: false });
    expect(text).toContain("`record_reference`");
    expect(text).not.toContain("record_node_status");
    expect(text).not.toContain("record_competitor");
  });
});
