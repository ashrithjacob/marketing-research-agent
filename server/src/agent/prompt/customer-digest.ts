import type { CustomerEvidence } from "../customer-truth-inputs.js";
import { Trace } from "../../trace/index.js";

/** The earlier stages as a customer-truth agent reads them: the verdict and what it rests on, the moments people start looking, how sceptical buyers are, how the product works, and how many reviews there are to read. */
export class CustomerDigest {
  static render(evidence: CustomerEvidence): string {
    Trace.line(import.meta.url, "CustomerDigest.render", { reviews: evidence.reviews.length });
    const { market, truth, reviews, verdict } = evidence;
    const attribute = (node: string) => market.attributes.filter((a) => a.node === node).map((a) => `${a.key}: ${(a.reads_as || a.value).slice(0, 600)}`);
    const stars = [1, 2, 3, 4, 5].map((star) => `${star}★: ${reviews.filter((r) => r.star === star).length}`).join(", ");
    const sections: [string, string[]][] = [
      ["Market truth's verdict", [`${verdict || "none"}`, ...attribute("viability").filter((line) => line.startsWith("verdict:"))]],
      ["When people start looking (market truth)", attribute("breaking_point")],
      ["How sceptical buyers are (market truth, from the voices it read)", (market.buyer_stage_shares ?? []).map((s) => `${s.stage}: ${s.voices} of ${s.of}`)],
      ["What competitors' ads already do (market truth)", [...(market.element_shares ?? []).map((s) => `${s.element}: ${s.brands} of ${s.of} brands`), ...attribute("sophistication")]],
      ["How the product works (product truth)", truth.mechanisms.map((m) => `${m.active}: ${m.story_weight}; ${m.pathway}; time to effect ${m.time_to_effect ? JSON.stringify(m.time_to_effect) : "not stated"}`)],
      ["The reviews customer voice mined", [`${reviews.length} reviews (${stars}); read them with read_reviews`]],
    ];
    return ["## What the earlier stages found", ...sections.map(([title, lines]) => `### ${title}\n\n${lines.length > 0 ? lines.map((l) => `- ${l}`).join("\n") : "- (none)"}`)].join("\n\n");
  }
}
