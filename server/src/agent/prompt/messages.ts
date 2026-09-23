import type { Judgement, SourceKind } from "../../domain/index.js";

/** Single messages injected mid-run: a steer, a nudge, a resume after a drop. */
export class AgentMessages {
  static steer(judgement: Judgement): string {
    let rejects = "";
    if (judgement.rejects_kinds.length > 0) {
      const kinds = judgement.rejects_kinds.map((kind: SourceKind) => `\`${kind}\``).join(", ");
      rejects =
        ` From now on, treat sources of kind ${kinds} as rejected: still ` +
        "record them in the packet with `admitted: false` and this reason.";
    }
    return (
      "Standing judgement from the human supervising this run — apply it for " +
      `the rest of the run: ${judgement.text}${rejects}`
    );
  }

  static packetNudge(): string {
    return (
      "Your last reply ended without the stage-1 packet, so this run has no " +
      "result yet. Do not research further; tools are switched off. Write the " +
      "packet now from what you have already gathered, as a single fenced " +
      "```json block, and record what you did not reach as gaps."
    );
  }

  static resume(error: string): string {
    return (
      `The connection to the model dropped part-way through your last turn (${error || "no detail"}), ` +
      "so that turn was lost. Everything before it stands: the tool results above " +
      "are yours and do not need fetching again. Carry on from where you were, and " +
      "finish with the stage-1 packet as a single fenced ```json block."
    );
  }
}
