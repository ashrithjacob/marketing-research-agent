import type { MarketEvidence } from "../market-truth-inputs.js";
import { Trace } from "../../trace/index.js";

/** The earlier stages as a market-truth agent reads them: each fact, figure, competitor, finding and quote on one line, with the id of the source it came from, so the agent can bring that source in by id and cite it. */
export class MarketDigest {
  static readonly QUOTES = 40;
  static readonly SOURCES = 120;

  static render(evidence: MarketEvidence): string {
    Trace.line(import.meta.url, "MarketDigest.render", { sources: evidence.sources.length });
    const { stageOne, truth, voice } = evidence;
    const sections = [
      ["Product facts (stage 1)", stageOne.attributes.filter((a) => a.node === "product_data").map((a) => `${a.key}: ${a.value} [${a.source_id}]`)],
      ["Category (stage 1)", [...stageOne.measurements.filter((m) => m.node === "category_data").map((m) => `${m.metric}: ${m.value} ${m.unit} ${m.period} [${m.source_id}]`), ...stageOne.attributes.filter((a) => a.node === "category_data").map((a) => `${a.key}: ${a.value} [${a.source_id}]`)]],
      ["Competitors (stage 1)", (stageOne.competitors ?? []).map((c) => `${c.name} (${c.relation}, ${c.form}) ${c.url}${c.dose_per_serving ? ` · dose ${c.dose_per_serving}` : ""}${c.positioning_copy ? ` · "${c.positioning_copy}"` : ""}${c.ad_source_ids.length ? ` · ads [${c.ad_source_ids.join(", ")}]` : ""}`)],
      ["Ingredients and how they work (product truth)", truth.mechanisms.map((m) => `${m.active}: ${m.story_weight}; ${m.pathway}; time to effect ${m.time_to_effect ? JSON.stringify(m.time_to_effect) : "not stated"} [${m.source_id}]`)],
      ["Doses against studies (product truth)", truth.doses.map((d) => JSON.stringify(d))],
      ["Claim limits (product truth)", truth.claim_limits.map((c) => `${c.market} · ${c.platform}: may say ${c.permitted.join("; ")} · may not say ${c.forbidden.join("; ")} [${c.source_ids.join(", ")}]`)],
      ["Prices and economics (product truth)", [...truth.prices.map((p) => `${p.label}: ${p.amount} ${p.currency} for ${p.units}${p.subscription ? " (subscription)" : ""} [${p.source_id}]`), `days of supply: ${truth.economics.days_of_supply ?? "unknown"} (${truth.economics.days_why})`, `churn: ${JSON.stringify(truth.economics.churn)}`, ...truth.economics.margins.map((m) => `margin at ${m.label}: ${m.margin ?? "unknown"} (${m.why})`)]],
      ["What product truth could not find", truth.gaps.map((g) => `${g.node}: ${g.missing}`)],
      ["Review quotes (customer voice), lowest stars first", voice ? [...voice.excerpts].sort((a, b) => (a.star_rating ?? 3) - (b.star_rating ?? 3)).slice(0, MarketDigest.QUOTES).map((e) => `${e.star_rating ?? "?"}★ "${e.text.slice(0, 300)}" [${e.source_id}]`) : ["customer voice has not run"]],
      ["Sources you may bring in with use_source", evidence.sources.slice(0, MarketDigest.SOURCES).map((s) => `${s.id} · ${s.kind} · ${s.title || s.url}${s.first_seen ? ` · first seen ${s.first_seen}` : ""}`)],
    ] as const;
    return ["## What the earlier stages found", ...sections.map(([title, lines]) => `### ${title}\n\n${lines.length > 0 ? lines.map((l) => `- ${l}`).join("\n") : "- (none)"}`)].join("\n\n");
  }
}
