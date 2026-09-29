import {
  DEFAULT_REJECTED_KINDS,
  FORMS,
  PRODUCT_ATTRIBUTES,
  SOURCE_KIND_NOTES,
  STAGE_NODES,
  Stages,
  type Brief,
  type Judgement,
  type Node,
} from "../../domain/index.js";

import { PromptBlocks, STAGE_NAMES } from "./blocks.js";
import { RECORDING } from "./text/recording.js";
import { RULES } from "./text/rules.js";
import { AMAZON_SEARCH_TOOL } from "./text/amazon-search.js";
import { SYSTEM_PROMPT } from "./text/system.js";
import { Trace } from "../../trace/index.js";

/** Assembles the system prompt and the run instructions from the text modules. */
export class PromptBuilder {
  system(nodes: readonly Node[] = STAGE_NODES[1]): string {
    Trace.line(import.meta.url, "PromptBuilder.system", { nodes });
    const stage = Stages.covering(nodes) ?? 1;
    const competitors = nodes.includes("competitors");
    const base = SYSTEM_PROMPT.replace("{stage}", String(stage))
      .replace("{competitor_records}", competitors ? ", `record_reference`, `record_competitor`" : "")
      .replace("{amazon_search}\n", competitors ? `${AMAZON_SEARCH_TOOL}\n` : "\n");
    if (!Stages.isPartial(nodes)) return base;
    return base.replace(
      "Work through this stage's nodes methodically.",
      `This run covers only ${PromptBlocks.code(nodes)} — work through ${
        nodes.length === 1 ? "it" : "them"
      } methodically and leave the rest of stage ${stage} alone.`,
    );
  }

  instructions(options: {
    brief: Brief;
    rejectKinds: readonly string[];
    judgements: readonly Judgement[];
    nodes?: readonly Node[];
  }): string {
    Trace.line(import.meta.url, "PromptBuilder.instructions", { options });
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
    if (judgements.length > 0) parts.push(PromptBlocks.judgements(judgements));
    parts.push(PromptBlocks.brief(brief));
    parts.push(PromptBuilder.recording(nodes));
    return parts.join("\n\n");
  }

  private static recording(nodes: readonly Node[]): string {
    Trace.line(import.meta.url, "PromptBuilder.recording", { nodes });
    const listed = PromptBlocks.code(nodes);
    return RECORDING.replace(
      "{nodes_note}",
      Stages.isPartial(nodes) ? `each node in scope (${listed})` : `each of this stage's nodes (${listed})`,
    ).replace("{forms}", PromptBlocks.code(FORMS));
  }
}
