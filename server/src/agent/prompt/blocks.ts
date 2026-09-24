import {
  NODES,
  STAGE_NODES,
  Stages,
  type Brief,
  type Judgement,
  type Node,
  type Stage,
} from "../../domain/index.js";

import { NODE_RULES } from "./text/node-rules.js";

export const STAGE_NAMES: Record<Stage, string> = {
  1: "the product and its market",
  2: "what customers said",
};

/** The parts of the instructions that depend on this run's scope and brief. */
export class PromptBlocks {
  static code(names: readonly string[]): string {
    return names.map((name) => `\`${name}\``).join(", ");
  }

  static nodes(nodes: readonly Node[]): string {
    const stage = Stages.covering(nodes) ?? 1;
    const heading = Stages.isPartial(nodes)
      ? `### This run's ${nodes.length === 1 ? "node" : "nodes"}`
      : `### Stage ${stage}${STAGE_NODES[stage].length > 1 ? "'s nodes" : "'s node"}`;
    const items = nodes.map((node, index) => `${index + 1}. ${NODE_RULES[node]}`);
    return [heading, "", ...items].join("\n");
  }

  static gapNodes(nodes: readonly Node[]): string {
    const listed = PromptBlocks.code(nodes);
    const verb = nodes.length === 1 ? "is" : "are";
    if (!Stages.isPartial(nodes)) {
      const stage = Stages.covering(nodes) ?? 1;
      const fallback = nodes[nodes.length - 1]!;
      return `A run-level problem that is not one of this stage's nodes — a tool failing, a
fetch path blocked, a site refusing to serve — still goes in this list. Attach it
to the node it blocked; if it blocked nothing in particular, use
\`node: "${fallback}"\`. Never invent a node name (\`all\`, \`general\`, \`run\`), and
never use a node from another stage: only ${listed} ${verb} accepted in a stage-${stage} packet, and anything else fails the whole packet.`;
    }
    return `A run-level problem — a tool failing, a fetch path blocked, a site refusing
to serve — still goes in this list, attached to \`node: "${nodes[0]}"\`. Use no
node name outside this run's scope, and never invent one (\`all\`, \`general\`,
\`run\`): only ${listed} ${verb} accepted, and
anything else fails the whole packet.`;
  }

  static scope(nodes: readonly Node[]): string {
    const listed = PromptBlocks.code(nodes);
    return [
      "## Scope of this run",
      "",
      `This run researches **only** ${listed}. The rest of stage 1 is out of`,
      "scope: do not search for it, and record nothing against it. Every `node` field",
      "in the packet — on sources, excerpts, measurements, attributes, saturation,",
      `nodes and gaps — must be one of ${listed}, and \`nodes\` has one entry for`,
      `each of them. Anything recorded against another node fails the whole packet.`,
    ].join("\n");
  }

  static judgements(judgements: readonly Judgement[]): string {
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
    const lines = ["## The brief", ""];
    lines.push(...PromptBlocks.subject(brief));
    if (brief.market) lines.push(...PromptBlocks.market(brief.market));
    if (brief.notes) lines.push(`**Notes:** ${brief.notes}`);
    return lines.join("\n");
  }

  private static subject(brief: Brief): string[] {
    if (!brief.product && brief.url) {
      return [
        `**Site:** ${brief.url}`,
        "",
        "The brief is this site, not a product name. Your first step is to fetch " +
          "it and read what it sells. Then set `brief.product` in your packet to " +
          "the product's own name **as the site writes it** — the name on the " +
          "product page or in the site's title, with no description, no domain " +
          "and no url appended. If the site sells a range, name the line the site " +
          "leads with and say in a gap which others you left.",
      ];
    }
    const lines = [`**Product:** ${brief.product}`];
    if (brief.url) {
      lines.push(`**Product URL:** ${brief.url}`);
    } else {
      lines.push(
        "No product URL was supplied — finding it is part of the job. The name " +
          "is a genre as much as a product: the **champion product** — the " +
          "market's most-bought — is what the packet must land on, established " +
          "by ranking the genre and picking the most-reviewed listing, never " +
          "the first plausible match. Use web search to locate the reviews, " +
          "competitors, ad-library entries and category data the " +
          `${NODES.length} nodes need.`,
      );
    }
    return lines;
  }

  private static market(market: string): string[] {
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
