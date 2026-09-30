import type { Brief, Judgement } from "../../domain/index.js";

import { Trace } from "../../trace/index.js";

/** The parts of the instructions that depend on this run's scope and brief. */
export class PromptBlocks {
  static code(names: readonly string[]): string {
    Trace.line(import.meta.url, "PromptBlocks.code", { names });
    return names.map((name) => `\`${name}\``).join(", ");
  }

  static judgements(judgements: readonly Judgement[]): string {
    Trace.line(import.meta.url, "PromptBlocks.judgements", { judgements });
    const lines = [
      "## Standing judgements",
      "",
      "Corrections a human has given on previous runs. They apply to this run " +
        "and outrank the defaults above. You should not need telling twice.",
      "",
    ];
    for (const judgement of judgements) {
      lines.push(`- **${judgement.kind}** — ${judgement.text}`);
    }
    return lines.join("\n");
  }

  static brief(brief: Brief): string {
    Trace.line(import.meta.url, "PromptBlocks.brief", { brief });
    const lines = ["## The brief", ""];
    lines.push(...PromptBlocks.subject(brief));
    if (brief.market) lines.push(...PromptBlocks.market(brief.market));
    if (brief.notes) lines.push(`**Notes:** ${brief.notes}`);
    return lines.join("\n");
  }

  private static subject(brief: Brief): string[] {
    Trace.line(import.meta.url, "PromptBlocks.subject", { brief });
    const lines = brief.product ? [`**Product:** ${brief.product}`] : [];
    if (brief.url) lines.push(`**${brief.product ? "Product URL" : "Site"}:** ${brief.url}`);
    return lines;
  }

  static champion(reference: Record<string, unknown> | null, brief: Brief): string {
    Trace.line(import.meta.url, "PromptBlocks.champion", { reference });
    if (!reference) {
      return [
        "## The champion",
        "",
        `No champion was looked up for this run: the product is the one ${brief.url} sells.`,
      ].join("\n");
    }
    return [
      "## The champion",
      "",
      "Recorded in the ledger by the `champion` agent, as `competitor_reference`:",
      "",
      "```json",
      JSON.stringify(reference, null, 2),
      "```",
    ].join("\n");
  }

  private static market(market: string): string[] {
    Trace.line(import.meta.url, "PromptBlocks.market", { market });
    const plural = market.includes(",");
    return [
      `**Market${plural ? "s" : ""}:** ${market}`,
      "",
      `Research only ${plural ? "these markets" : "this market"}. A source from ` +
        `outside ${plural ? "them" : "it"} is out of scope: do not record it, and do ` +
        `not count it toward saturation. Where a site serves several regions, use ` +
        `the ${plural ? "listings" : "listing"} for ${market} — prices, ` +
        `availability and reviews differ by region. If a named market yields ` +
        `nothing, that is a gap entry naming the market, never a reason to ` +
        `substitute another.`,
    ];
  }
}
