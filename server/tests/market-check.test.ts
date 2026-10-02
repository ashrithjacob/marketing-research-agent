import { describe, expect, it } from "vitest";

import { MarketCheck } from "../src/extract/market-check.js";
import { CheckProblems, stagePacketSchema } from "../src/domain/index.js";

const packet = (markets: string[]) =>
  stagePacketSchema.parse({
    brief: { product: "creatine" },
    competitors: markets.map((market, i) => ({
      id: `c${i}`,
      name: `Brand ${i}`,
      url: "https://example.com",
      relation: "direct",
      form: "powder",
      active_ingredients: [{ name_as_printed: "Creatine Monohydrate", name_normalised: "creatine monohydrate" }],
      shared_actives: ["creatine monohydrate"], icp_as_printed: "for strength training",
      market,
      source_id: "s",
    })),
  });

const located = (markets: string[], chosen: string) =>
  new MarketCheck().problems(packet(markets), { scope: [], stage: 1, sourceIds: new Set(), brief: { product: "creatine", market: chosen } });

const problems = (markets: string[], chosen: string) => CheckProblems.texts(located(markets, chosen));

describe("MarketCheck", () => {
  it("accepts competitors from the markets the user ticked, in any case", () => {
    expect(problems(["US", "uk", "Canada"], "US, UK, Australia, New Zealand, Canada")).toEqual([]);
  });

  it("refuses a competitor from a market the user did not choose", () => {
    const found = problems(["US", "Australia"], "US");
    expect(found).toHaveLength(1);
    expect(found[0]).toMatch(/Brand 1.*'Australia'.*only "US"/);
  });

  it("refuses a competitor with no market when the brief names markets", () => {
    expect(problems([""], "US")[0]).toMatch(/Brand 0.*has no `market`/);
  });

  it("ties each refusal to the competitor row it is about, so the turn limit can retract that row", () => {
    expect(located(["US", "Australia"], "US")[0]!.row).toEqual({ kind: "competitor", key: "c1" });
  });

  it("checks nothing when the brief names no market", () => {
    expect(problems(["", "Germany"], "")).toEqual([]);
  });
});
