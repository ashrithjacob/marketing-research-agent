/**
 * The instructions.
 *
 * The prompt is the half of the contract the validator cannot enforce, so the
 * tests here are about what it *says*: a rule that quietly stops being stated is
 * a rule the model stops following, and the failure only shows up as a rejected
 * packet at the end of an expensive run.
 */

import { describe, expect, it } from "vitest";

import { PacketError, PacketExtractor, PacketValidator } from "../src/extract/index.js";

import {
  FORMS,
  SOURCE_KINDS,
  STAGE_NODES,
  briefSchema,
} from "../src/domain/index.js";
import type { Judgement } from "../src/domain/index.js";
import { AgentMessages, PromptBuilder } from "../src/agent/prompt/index.js";

const prompts = new PromptBuilder();

const packets = new PacketValidator();
const extractor = new PacketExtractor();

const brief = (overrides: Record<string, unknown> = {}) =>
  briefSchema.parse({ product: "MagnaCalm", ...overrides });

const build = (overrides: Parameters<PromptBuilder["instructions"]>[0] | Record<string, unknown> = {}) =>
  prompts.instructions({
    brief: brief(),
    rejectKinds: [],
    judgements: [],
    ...(overrides as Record<string, never>),
  });

describe("the worked example", () => {
  it("is itself a valid packet", () => {
    // If the example drifts out of the contract, every run copies the drift.
    const parsed = packets.parse(build());
    expect(parsed.sources.length).toBeGreaterThan(0);
    expect(parsed.gaps.length).toBeGreaterThan(0);
  });

  it("is cut to the stage it is shown in", () => {
    // Review mining is stage 2, so a stage-1 example that shows review excerpts
    // teaches every run to break the boundary it is about to be validated against.
    const stage1 = packets.parse(build(), STAGE_NODES[1]);
    expect(stage1.stage).toBe(1);
    expect(stage1.excerpts).toHaveLength(0);
    expect(stage1.competitors.length).toBeGreaterThan(0);

    const stage2 = packets.parse(build({ nodes: ["review_mining"] }), STAGE_NODES[2]);
    expect(stage2.stage).toBe(2);
    expect(stage2.competitors).toHaveLength(0);
    // The 3★ coverage the validator demands, shown where it belongs.
    expect(stage2.excerpts.some((e) => e.star_rating === 3)).toBe(true);
  });
});

describe("what the instructions must state", () => {
  it("names every source kind the validator accepts", () => {
    // The first live run invented seven kinds that were not in the enum and the
    // whole packet was rejected for it.
    const text = build();
    for (const kind of SOURCE_KINDS) expect(text).toContain(`\`${kind}\``);
  });

  it("tells the agent to cite the source_id web_fetch hands back", () => {
    const text = build();
    expect(text).toMatch(/source_id/);
    expect(text).toMatch(/verbatim/);
  });

  it("says an empty posted_at is a string, never null", () => {
    expect(build()).toMatch(/Never `null`/);
  });

  it("names the open channels: facts with no field are attributes, not invented keys", () => {
    // Two live glm runs invented packet fields (`theme`, `text_verbatim`,
    // `axis: "efficacy"`) because nothing said where the open record lives.
    const text = build();
    expect(text).toMatch(/attribute with a key you name/);
    expect(text).toMatch(/`themes: \[\]`/);
    expect(text).toMatch(/axis[\s\S]*?stays `null`/);
    expect(text).toMatch(/never invent a[\s\S]*packet field/);
  });

  it("presents the product checklist as a floor, not a ceiling", () => {
    const text = build();
    expect(text).toMatch(/floor, not the ceiling/);
    expect(text).toMatch(/attribute with a key you name/);
  });

  it("shows a custom-key attribute in the worked example", () => {
    // The example is the shape the model copies; the open channel is taught by
    // showing one, or every packet copies only the ten checklist keys.
    const text = build();
    expect(text).toContain(`"third_party_lab_tested"`);
  });

  it("says the worked example is not the brief", () => {
    // A run once anchored on the example's product and researched it instead of
    // the product it was given. The disclaimer is what stands between runs and
    // that happening again at the model's initiative.
    const text = build();
    expect(text).toMatch(/shape only/);
    expect(text).toMatch(/a packet about the example's product is rejected/);
  });

  it("refuses an invented gap node, and a node from the other stage", () => {
    const text = build();
    expect(text).toMatch(/Never invent a node name/);
    expect(text).toMatch(/`all`, `general`, `run`/);
    expect(text).toMatch(/never use a node from another stage/);
    // Stage 1's packet may not file a gap against review mining.
    expect(text).not.toMatch(/accepted in a stage-1 packet[\s\S]{0,80}review_mining/);
  });

  it("states that the gap list may not be empty", () => {
    expect(build()).toMatch(/`gaps` must not be empty/);
  });

  it("lists this run's rejected kinds", () => {
    expect(build({ rejectKinds: ["ai_generated"] })).toContain("- `ai_generated`");
  });
});

describe("the brief block", () => {
  it("sends the agent searching when no url was supplied", () => {
    // Without this line a careful agent stalls asking for a URL it was never
    // going to get.
    expect(build()).toMatch(/No product URL was supplied/);
  });

  it("asks for the name when the brief is a site and nothing else", () => {
    // The old shape printed "**Product:** <url>" above "No product URL was
    // supplied — finding it is part of the job", and a run spent a turn on the
    // contradiction before inventing a name that failed validation.
    const text = build({ brief: brief({ product: "", url: "https://thedropletco.co.uk/" }) });
    expect(text).toContain("**Site:** https://thedropletco.co.uk/");
    expect(text).not.toMatch(/\*\*Product:\*\*/);
    expect(text).not.toMatch(/No product URL was supplied/);
    expect(text).toMatch(/as the site writes it/);
    expect(text).toMatch(/no domain and no url appended/);
  });

  it("skips the search instruction when a url was supplied", () => {
    const text = build({ brief: brief({ url: "https://magnacalm.example" }) });
    expect(text).toContain("https://magnacalm.example");
    expect(text).not.toMatch(/No product URL was supplied/);
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
    const text = prompts.system();
    expect(text).toContain("web_search");
    expect(text).toContain("web_fetch");
    expect(text).toMatch(/never cite a url you have only seen in search results/);
  });
});

describe("the example survives the validator's cross-object rules", () => {
  it("passes packets.validate() directly, not just extractor.extract()", () => {
    expect(() => packets.validate(packets.parse(build()))).not.toThrow();
  });
});

describe("a run that covers part of the stage", () => {
  const scoped = (nodes: string[]) => build({ nodes });

  it("describes only the nodes it covers", () => {
    const text = scoped(["product_data"]);
    expect(text).toContain("### This run's node");
    expect(text).toContain("**product_data** — the checklist below is the floor");
    expect(text).not.toContain("**review_mining** —");
    expect(text).not.toContain("amazon_find_product");
    expect(text).not.toContain("### The four nodes");
  });

  it("states the scope, and that the example's other nodes are shape only", () => {
    const text = scoped(["competitors", "category_data"]);
    expect(text).toContain("## Scope of this run");
    expect(text).toMatch(/researches \*\*only\*\* `competitors`, `category_data`/);
    expect(text).toMatch(/The example shows every node, for shape only/);
  });

  it("sends a run-level gap to a node in scope, not to category_data", () => {
    const text = scoped(["product_data"]);
    expect(text).toContain('attached to `node: "product_data"`');
    expect(text).not.toContain('use\n`node: "category_data"`');
  });

  it("keeps a whole-stage run's instructions as they were", () => {
    expect(build({ nodes: [...STAGE_NODES[1]] })).toBe(build());
    expect(build()).not.toContain("## Scope of this run");
  });

  it("scopes the system prompt too", () => {
    expect(prompts.system(["competitors"])).toMatch(/This run covers only `competitors`/);
    expect(prompts.system()).toMatch(/Work through this stage's nodes methodically/);
  });

  it("tells each stage which stage it is", () => {
    expect(prompts.system()).toMatch(/You are the stage-1 researcher of a six-stage/);
    expect(prompts.system(["review_mining"])).toMatch(/You are the stage-2 researcher of a six-stage/);
    // A whole stage is not a partial run, whichever stage it is.
    expect(prompts.system(["review_mining"])).not.toMatch(/This run covers only/);
    expect(build({ nodes: ["review_mining"] })).toMatch(/## Stage 2 — what customers said/);
  });
});

describe("the competitors node", () => {
  it("states the mechanical test and the per-class saturation", () => {
    const text = build({ nodes: ["competitors"] });
    expect(text).toMatch(/\*\*direct\*\* — shares an active ingredient with the product \*\*and\*\* has the\s+same form/);
    expect(text).toMatch(/\*\*indirect\*\* — shares an active ingredient, \*\*different\*\* form/);
    expect(text).toMatch(/Saturate each class \*\*separately\*\*/);
    expect(text).toMatch(/same problem, different active/);
  });

  it("sends the agent ranking the genre to pick the champion product", () => {
    // The brief names a genre; "the first plausible match" is not the champion.
    // The ranking must be recorded, because a runner-up that out-reviews the
    // pick is exactly the champion check's reject.
    const text = build({ nodes: ["competitors"] });
    expect(text).toMatch(/\*\*champion product\*\* is the listing with the\s+highest `reviewsCount`/);
    expect(text).toMatch(/`reviews_count`, and the runner-up listing's name and count/);
    expect(text).toMatch(/champion ranking unavailable/);
  });

  it("names every form the validator accepts", () => {
    const text = build();
    for (const form of FORMS) expect(text).toContain(`\`${form}\``);
  });

  it("shows a direct and an indirect competitor in the example", () => {
    const parsed = packets.parse(build());
    expect(parsed.competitors.map((c) => c.relation).sort()).toEqual(["direct", "indirect"]);
    expect(parsed.competitor_reference?.form).toBe("capsule");
  });

  it("shows the champion's ranking evidence in the example", () => {
    // The example is parsed against a name-only brief, so the champion check
    // applies to it: the evidence it shows must be a real ranking.
    const parsed = packets.parse(build());
    expect(parsed.competitor_reference?.reviews_count).toBeGreaterThan(0);
    expect(parsed.competitor_reference?.runner_up_name).not.toBe("");
    expect(parsed.competitor_reference?.runner_up_reviews ?? 0).toBeLessThanOrEqual(
      parsed.competitor_reference?.reviews_count ?? 0,
    );
  });
});

describe("the system prompt names only the tools a run is given", () => {
  // The first competitors-only run gapped "amazon_reviews was not available" —
  // told about tools it did not have, it reported their absence as a finding.
  it("gives a product-data run web search and fetch only", () => {
    const text = prompts.system(["product_data"]);
    expect(text).toContain("web_fetch");
    expect(text).not.toMatch(/amazon_|trustpilot_/);
  });

  it("gives a competitors run Amazon search as discovery, and no review tools", () => {
    const text = prompts.system(["competitors"]);
    expect(text).toMatch(/`amazon_find_product` — .*a way to find competitors/);
    expect(text).not.toMatch(/amazon_reviews|trustpilot_reviews|mine_reviews|may be absent. If they are/);
  });

  it("describes all five to a run that covers review mining", () => {
    const text = prompts.system(["review_mining"]);
    expect(text).toContain("amazon_reviews");
    expect(text).toContain("mine_reviews");
    expect(text).toContain("The Amazon and Trustpilot tools may be absent");
  });
});
