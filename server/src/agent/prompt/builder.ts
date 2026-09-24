import {
  DEFAULT_REJECTED_KINDS,
  FORMS,
  PRODUCT_ATTRIBUTES,
  SOURCE_KIND_NOTES,
  STAGE_NODES,
  Stages,
  type Brief,
  type Judgement,
  type MiningTarget,
  type Node,
} from "../../domain/index.js";

import { PromptBlocks, STAGE_NAMES } from "./blocks.js";
import { WorkedExample } from "./example-picker.js";
import { RosterBlock } from "./roster-block.js";
import { OUTPUT } from "./text/output.js";
import { RULES } from "./text/rules.js";
import { SYSTEM_PROMPT } from "./text/system.js";

/** Assembles the system prompt and the run instructions from the text modules. */
export class PromptBuilder {
  system(nodes: readonly Node[] = STAGE_NODES[1]): string {
    const stage = Stages.covering(nodes) ?? 1;
    const base = SYSTEM_PROMPT.replace("{stage}", String(stage));
    if (!Stages.isPartial(nodes)) return base;
    const text = base.replace(
      "Work through this stage's nodes methodically.",
      `This run covers only ${PromptBlocks.code(nodes)} — work through ${
        nodes.length === 1 ? "it" : "them"
      } methodically and leave the rest of stage ${stage} alone.`,
    );
    return nodes.includes("review_mining") ? text : PromptBuilder.withoutReviewTools(text, nodes);
  }

  instructions(options: {
    brief: Brief;
    rejectKinds: readonly string[];
    judgements: readonly Judgement[];
    nodes?: readonly Node[];
    roster?: readonly MiningTarget[];
    targets?: readonly string[];
  }): string {
    const { brief, rejectKinds, judgements } = options;
    const nodes = options.nodes ?? STAGE_NODES[1];
    const stage = Stages.covering(nodes) ?? 1;
    const rejected = rejectKinds.length > 0 ? rejectKinds : DEFAULT_REJECTED_KINDS;

    const parts = [
      RULES.replace("{nodes}", PromptBlocks.nodes(nodes))
        .replaceAll("{stage}", String(stage))
        .replace("{stage_name}", STAGE_NAMES[stage])
        .replace("{attributes}", PRODUCT_ATTRIBUTES.map((a) => `\`${a}\``).join(", "))
        .replace(
          "{kinds}",
          SOURCE_KIND_NOTES.map(([kind, note]) => `- \`${kind}\` — ${note}`).join("\n"),
        )
        .replace("{rejected}", rejected.map((kind) => `- \`${kind}\``).join("\n") || "- (none)")
        .replace("{gap_nodes}", PromptBlocks.gapNodes(nodes)),
    ];
    if (Stages.isPartial(nodes)) parts.push(PromptBlocks.scope(nodes));
    if (options.roster && options.roster.length > 0) {
      parts.push(RosterBlock.text(options.roster, options.targets ?? []));
    }
    if (judgements.length > 0) parts.push(PromptBlocks.judgements(judgements));
    parts.push(PromptBlocks.brief(brief));
    parts.push(this.output(nodes, stage));
    return parts.join("\n\n");
  }

  private output(nodes: readonly Node[], stage: number): string {
    const listed = PromptBlocks.code(nodes);
    let output = OUTPUT.replace(
      "{example}",
      JSON.stringify(WorkedExample.forStage(stage as 1 | 2), null, 2),
    )
      .replaceAll("{stage}", String(stage))
      .replace(
        "{nodes_note}",
        Stages.isPartial(nodes)
          ? `each node in scope (${listed})`
          : `each of this stage's nodes (${listed})`,
      )
      .replace("{forms}", PromptBlocks.code(FORMS));
    if (Stages.isPartial(nodes)) {
      output += `\nThe example shows every node, for shape only. Your packet records only ${listed}.\n`;
    }
    return output;
  }

  private static withoutReviewTools(text: string, nodes: readonly Node[]): string {
    const findStart = text.indexOf("- `amazon_find_product`");
    const findEnd = text.indexOf("\n\nWork through");
    const thisRun = text.indexOf("\n\nThis run covers only");
    const end = findEnd === -1 ? thisRun : findEnd;
    const tools = nodes.includes("competitors")
      ? "- `amazon_find_product` — search Amazon (amazon.com) by product name for asin, " +
        "title, stars and `reviewsCount`, most-reviewed first: how the genre is ranked " +
        "to pick the champion product, a way to find competitors, and to see which " +
        "sell. It may be absent."
      : "";
    return (
      text.slice(0, findStart).replace(/\n+$/, "") + (tools ? `\n${tools}` : "") + text.slice(end)
    );
  }
}
