/**
 * Stage-1 run contract: extraction and validation.
 *
 * The tests that matter most here are the *rejection* ones. Stage 1's whole
 * value is that it gathers without concluding, and that property lives in a
 * validator — so a validator that quietly accepts a conclusion is the bug this
 * file exists to catch.
 */

import { describe, expect, it } from "vitest";

import { PacketError, extract, parse, validate } from "../src/packet.js";
import { NODES, runNodes } from "../src/schema.js";
import { fenced, minimalPacket } from "./fixtures.js";

describe("extraction", () => {
  it("reads a fenced block", () => {
    expect(extract(fenced(minimalPacket())).stage).toBe(1);
  });

  it("takes the last packet — an agent that shows its working writes the example first", () => {
    const first = minimalPacket();
    first.brief.product = "an example";
    const output = fenced(first, "For illustration:") + fenced(minimalPacket(), "And the real one:");
    expect((extract(output).brief as any).product).toBe("MagnaCalm 400mg");
  });

  it("accepts bare JSON", () => {
    expect(extract(JSON.stringify(minimalPacket())).stage).toBe(1);
  });

  it("ignores unrelated fences", () => {
    const output = "```python\nprint('hi')\n```\n\n" + fenced(minimalPacket());
    expect(extract(output).stage).toBe(1);
  });

  it("errors when there is no JSON at all", () => {
    expect(() => extract("I did the research and here is what I think.")).toThrow(
      /no fenced JSON/,
    );
  });

  it("errors on empty output", () => {
    expect(() => extract("   ")).toThrow(/no output/);
  });
});

describe("validation: stage 1 does not conclude", () => {
  it("gives a conclusion nowhere to live", () => {
    // The point of the whole schema. An invented field is a hard failure.
    const data = minimalPacket();
    data.findings = ["Buyers are motivated by 3am waking"];
    expect(() => validate(data)).toThrow(/not in the stage-1 contract/);
  });

  it("rejects a conclusion smuggled onto an excerpt", () => {
    const data = minimalPacket();
    data.excerpts[0].interpretation = "sleep maintenance issues";
    expect(() => validate(data)).toThrow(/not in the stage-1 contract/);
  });

  it("refuses a theme carrying a description", () => {
    // §5: a theme with prose attached is a conclusion wearing a hat.
    const data = minimalPacket();
    data.excerpts[0].themes = [{ label: "3am waking", meaning: "…" }];
    expect(() => validate(data)).toThrow(PacketError);
  });
});

describe("validation: the cross-object rules", () => {
  it("fails a run with an empty gap list", () => {
    // spec.md §4.3 — a run reporting no holes stopped looking.
    expect(() => validate(minimalPacket({ gaps: [] }))).toThrow(/gap list is empty/);
  });

  it("rejects an excerpt citing an absent source", () => {
    const data = minimalPacket();
    data.excerpts[0].source_id = "sha256:nope";
    expect(() => validate(data)).toThrow(/not in the packet/);
  });

  it("rejects a saturation curve citing an absent source", () => {
    const data = minimalPacket();
    data.saturation[0].curve[0].source_id = "sha256:ghost";
    expect(() => validate(data)).toThrow(/not in the packet/);
  });

  it("rejects a complete review_mining node without 3-star coverage", () => {
    const data = minimalPacket();
    data.excerpts[0].star_rating = 5;
    expect(() => validate(data)).toThrow(/no 3-star excerpt/);
  });

  it("requires a saturation curve for a complete node", () => {
    expect(() => validate(minimalPacket({ saturation: [] }))).toThrow(/saturation curve/);
  });

  it("treats product_data as a checklist, not a search", () => {
    // The one node whose done-criterion is finite, so no curve is required.
    const data = minimalPacket();
    data.nodes = [
      {
        node: "product_data",
        status: "complete",
        done_criterion_met: true,
        why: "10 of 10 attributes, COA gapped",
      },
    ];
    data.saturation = [];
    expect(() => validate(data)).not.toThrow();
  });

  it("requires a gap recording an undated ad", () => {
    // Longevity is the only outside performance signal there is.
    const data = minimalPacket();
    data.sources.push({
      id: "sha256:ccc",
      url: "https://facebook.com/ads/library?id=1",
      kind: "ad_library",
      fetched_at: "2026-09-10T09:00:00Z",
      first_seen: null,
      admitted: true,
      archived: true,
      node: "competitors",
    });
    data.gaps = [{ node: "review_mining", missing: "thin forum coverage" }];
    expect(() => validate(data)).toThrow(/first_seen/);
  });

  it("accepts an undated ad when it is gapped", () => {
    const data = minimalPacket();
    data.sources.push({
      id: "sha256:ccc",
      url: "https://facebook.com/ads/library?id=1",
      kind: "ad_library",
      fetched_at: "2026-09-10T09:00:00Z",
      first_seen: null,
      admitted: true,
      archived: true,
      node: "competitors",
    });
    expect(() => validate(data)).not.toThrow(); // the default gap is on `competitors`
  });

  it("keeps rejected sources in the packet", () => {
    // They are the evidence of what was searched, and the UI renders them.
    const data = minimalPacket();
    data.sources.push({
      id: "sha256:ddd",
      url: "https://top10supplementpicks.net/best",
      kind: "seo_listicle",
      admitted: false,
      admission_reason: "seo_listicle — rejected by admission policy",
      archived: false,
      node: "competitors",
    });
    expect(validate(data).sources.map((s) => s.admitted)).toEqual([true, false]);
  });

  it("round-trips a valid packet", () => {
    const parsed = parse(fenced(minimalPacket()));
    expect(parsed.excerpts[0]!.text.startsWith("I wake up at 3am")).toBe(true);
    expect(parsed.excerpts[0]!.star_rating).toBe(3);
  });
});

describe("validation: the packet answers the brief it was given", () => {
  it("rejects a packet about the worked example's product", () => {
    // The prompt's example names a product; a model that anchors on it
    // researches the example instead of the brief — a "completed" run about
    // the wrong product is the most expensive failure there is.
    expect(() => validate(minimalPacket(), NODES, { product: "mullein" })).toThrow(
      /packet brief is about 'MagnaCalm 400mg', but this run's brief is 'mullein'/,
    );
  });

  it("accepts an echo of the brief, case and detail aside", () => {
    expect(() => validate(minimalPacket(), NODES, { product: "magnacalm" })).not.toThrow();
    expect(() => validate(minimalPacket(), NODES, { product: "MagnaCalm 400mg" })).not.toThrow();
  });

  it("lets the agent fill out a sparse product name", () => {
    // "mullein" researched as "Mullein leaf 500mg capsules" is the job done well.
    const data = minimalPacket();
    data.brief.product = "Mullein leaf 500mg capsules";
    expect(() => validate(data, NODES, { product: "mullein" })).not.toThrow();
  });

  it("checks nothing when no brief is handed over", () => {
    expect(() => validate(minimalPacket())).not.toThrow();
  });
});

describe("validation: a run that covers part of the stage", () => {
  /** A packet that only ever touched product_data. */
  const productOnly = (): Record<string, any> =>
    minimalPacket({
      sources: [
        {
          id: "sha256:ppp",
          url: "https://magnacalm.example/product",
          kind: "first_party",
          admitted: true,
          archived: true,
          marketing: true,
          node: "product_data",
        },
      ],
      excerpts: [],
      saturation: [],
      attributes: [
        { id: "a1", node: "product_data", key: "form", value: "capsule", source_id: "sha256:ppp" },
      ],
      nodes: [{ node: "product_data", status: "incomplete", done_criterion_met: false, why: "COA gapped" }],
      gaps: [{ node: "product_data", missing: "no certificate of analysis", would_need: "ask the brand" }],
    });

  it("accepts a packet that stays inside its scope", () => {
    expect(() => validate(productOnly(), ["product_data"])).not.toThrow();
  });

  it("rejects anything recorded against a node outside the scope, and says which", () => {
    // Copying the worked example, which shows all four nodes, is the easy way here.
    const data = productOnly();
    data.gaps.push({ node: "competitors", missing: "CalmWell ad library empty" });
    expect(() => validate(data, ["product_data"])).toThrow(
      /1 entry is recorded against competitors, which is outside this run's scope \(product_data\)/,
    );
  });

  it("requires the covered node to say how it ended", () => {
    const data = productOnly();
    data.nodes = [];
    expect(() => validate(data, ["product_data"])).toThrow(/nodes has no entry for product_data/);
  });

  it("leaves a whole-stage run exactly as it was", () => {
    // minimalPacket reports one node and gaps another — fine for a full run.
    expect(() => validate(minimalPacket())).not.toThrow();
    expect(() => validate(minimalPacket(), [...NODES])).not.toThrow();
  });
});

describe("runNodes", () => {
  it("orders by stage, drops repeats, and reads empty as the whole stage", () => {
    expect(runNodes(["category_data", "product_data", "product_data"])).toEqual([
      "product_data",
      "category_data",
    ]);
    expect(runNodes([])).toEqual([...NODES]);
    expect(runNodes(undefined)).toEqual([...NODES]);
  });
});
