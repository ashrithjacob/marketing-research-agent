/** The long-form ads analysis: what counts as proven, how a hook is cut, how angles, labels and brands are counted, and what code refuses from the three agents that group, judge and write over those counts. */
import { describe, expect, it } from "vitest";

import { AngleFitter } from "../src/agent/stages/ads/angle-fitter.js";
import { AngleGrouper } from "../src/agent/stages/ads/angle-grouper.js";
import { FindingsWriter } from "../src/agent/stages/ads/findings-writer.js";
import type { AdAngle, ReadAd, StoredReading } from "../src/domain/index.js";
import { AdsAnalyzer, HookCutter, Momentum, ProvenRule } from "../src/extract/index.js";

const READING: StoredReading = {
  avatar: "ex-smokers", claim_type: "mechanism", awareness: "problem_aware", mechanism: null, proof_types: [], offer: null, objections_handled: [], emotion: "relief", risk_flags: [],
  proof_kinds: ["testimonial"], offer_kinds: ["guarantee"], emotion_kind: "relief", landing_kind: "advertorial", copy_structure: "personal_story",
};

const ad = (id: string, over: Partial<ReadAd> = {}, reading: Partial<StoredReading> = {}): ReadAd => ({
  id, run_id: "r", product_id: "p", competitor_id: null, trendtrack_ad_id: id, advertiser: "Brand", landing_url: "https://brand.com/pages/a", landing_domain: "brand.com", status: "active",
  copy: "Opening line here. More text.", copy_length: 30, media_url: null, thumbnail_url: null, first_seen: "2026-06-01", last_seen: null, days_running: 40, duplicates: 3, ad_rank: null,
  reach: null, reach_delta: null, eu_reach: null, bucket: "winning", bucket_why: "", audience: null, ring: "same_problem", ring_why: "", reading: { ...READING, ...reading }, ...over,
});

const angle = (key: string, ids: string[], over: Partial<AdAngle> = {}): AdAngle => ({ key, name: key, description: key, ad_ids: ids, fit: null, fit_claim_indexes: [], fit_why: null, ...over });

describe("ProvenRule", () => {
  it("needs an ad still running after a month and duplicated", () => {
    expect(ProvenRule.isProven({ status: "active", days_running: 30, duplicates: 2 })).toBe(true);
    expect(ProvenRule.isProven({ status: "inactive", days_running: 90, duplicates: 9 })).toBe(false);
    expect(ProvenRule.isProven({ status: "active", days_running: 29, duplicates: 9 })).toBe(false);
    expect(ProvenRule.isProven({ status: "active", days_running: 90, duplicates: null })).toBe(false);
  });
});

describe("HookCutter", () => {
  it("takes the shorter of the first sentence and the first line, at most 200 characters", () => {
    expect(HookCutter.cut("  My doctor said one thing. Then another.")).toBe("My doctor said one thing.");
    expect(HookCutter.cut("STOP scrolling\nIf you wake up coughing, read this.")).toBe("STOP scrolling");
    expect(HookCutter.cut("Dr. Smith said 2.5 mg")).toBe("Dr.");
    expect(HookCutter.cut("x".repeat(300))).toHaveLength(200);
  });
});

describe("Momentum", () => {
  it("counts launches in the last 30 and 60 days and calls a set rising when most are recent, fading when none are", () => {
    const at = (first_seen: string) => ({ first_seen });
    expect(Momentum.of([at("2026-10-10"), at("2026-09-01"), at("2026-08-30"), at("2025-01-01")], "2026-10-22")).toEqual({ launched_30d: 1, launched_60d: 3, trend: "rising" });
    expect(Momentum.of([at("2025-01-01"), at("2025-02-01"), at("2025-03-01")], "2026-10-22").trend).toBe("fading");
    expect(Momentum.of([at("2026-10-10")], "2026-10-22").trend).toBe("steady");
  });
});

describe("AdsAnalyzer", () => {
  const ads = [
    ad("a1", { days_running: 90, competitor_id: "c1" }, { risk_flags: ["cures COPD"] }),
    ad("a2", { days_running: 45, competitor_id: "c1" }, { landing_kind: "product_page" }),
    ad("a3", { status: "inactive", days_running: 5, landing_domain: "other.com", advertiser: "Other" }, { proof_kinds: ["before_after"] }),
    ad("a4", { status: "inactive", days_running: 8, landing_domain: "other.com", advertiser: "Other" }, { proof_kinds: ["before_after"] }),
    ad("a5", { status: "inactive", days_running: 9, landing_domain: "other.com", advertiser: "Other" }, { proof_kinds: ["before_after"] }),
    ad("a6", {}, {}),
    ad("unread", {}, {}),
  ];
  ads[6] = { ...ads[6]!, reading: null };
  const angles = [angle("story", ["a1", "a2", "a6"], { fit: "supported", fit_claim_indexes: [1] }), angle("cheap", ["a3", "a4", "a5"])];
  const analysis = AdsAnalyzer.analyze(ads, angles, [], ["Clear lungs.", "Supports breathing."], "2026-10-22");

  it("counts each angle's ads, proven ads, brands, run lengths, risk and the client claim its fit cites", () => {
    expect(analysis.read).toBe(6);
    expect(analysis.proven).toBe(4);
    expect(analysis.angles[0]).toMatchObject({ key: "story", ads: 3, proven: 3, brands: ["brand.com"], median_days: 45, longest_days: 90, fit_claims: ["Supports breathing."] });
    expect(analysis.angles[0]!.risk_share).toBeCloseTo(1 / 3);
    expect(analysis.angles[1]).toMatchObject({ key: "cheap", proven: 0, risk_share: null });
    expect(analysis.angle_of.a4).toBe("cheap");
  });

  it("compares label values between proven ads and the rest, ranking only values on five or more ads", () => {
    const testimonial = analysis.labels.find((l) => l.label === "proof" && l.value === "testimonial")!;
    expect(testimonial).toMatchObject({ proven: 3, rest: 0, ranked: false });
    expect(testimonial.proven_share).toBe(1);
    const advertorial = analysis.labels.find((l) => l.label === "landing" && l.value === "advertorial")!;
    expect(advertorial).toMatchObject({ proven: 2, rest: 3, ranked: true });
    expect(analysis.labels[0]!.ranked).toBe(true);
  });

  it("lists confirmed competitors first, then brands with three or more ads, with a cell per angle", () => {
    expect(analysis.brands.map((b) => [b.domain, b.competitor, b.ads, b.proven])).toEqual([["brand.com", true, 4, 4], ["other.com", false, 3, 0]]);
    expect(analysis.brands[0]!.cells).toEqual({ story: { ads: 3, proven: 3 } });
  });
});

describe("the analysis agents' checks", () => {
  it("refuses a grouping that misses an ad, places one twice, invents one or reuses a key", () => {
    const problems = AngleGrouper.problems({ angles: [{ key: "a", name: "a", description: "a", ad_ids: ["1", "2", "x"] }, { key: "a", name: "b", description: "b", ad_ids: ["2"] }] }, ["1", "2", "3"]);
    expect(problems).toEqual(["ad 3 is in no angle", "ad x was not given; copy each id exactly", "ad 2 is in more than one angle", "angle key a is used twice"]);
  });

  it("refuses a fit with a missing verdict, an unknown claim, or a supported verdict citing nothing", () => {
    const problems = AngleFitter.problems({ fits: [{ angle_key: "a", verdict: "supported", claim_indexes: [], why: "x" }, { angle_key: "b", verdict: "needs_new_claim", claim_indexes: [4], why: "x" }] }, ["a", "b", "c"], 2);
    expect(problems).toEqual(["angle c has no verdict", "angle a is supported but cites no claim", "angle b cites claim 4, which does not exist"]);
  });

  it("refuses findings with a digit, an unknown subject or ad, or a step missing", () => {
    const problems = FindingsWriter.problems({ findings: [{ step: 2, subjects: ["story", "ghost"], headline: "Three brands, 3 ads.", ad_ids: ["a1", "zz"] }] }, [2, 3], new Set(["story"]), ["a1"]);
    expect(problems).toEqual(["step 3 has no finding", "step 2's headline has a digit; leave numbers to the page", "step 2 names ghost, which is not in the tables", "step 2 cites ad zz, which does not exist"]);
  });
});
