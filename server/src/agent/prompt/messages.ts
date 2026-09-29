import type { Judgement, SourceKind } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

/** Single messages injected mid-run: a steer, a resume after a drop. */
export class AgentMessages {
  static steer(judgement: Judgement): string {
    Trace.line(import.meta.url, "AgentMessages.steer", { judgement });
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

  static resume(error: string): string {
    Trace.line(import.meta.url, "AgentMessages.resume", { error });
    return (
      `The connection to the model dropped part-way through your last turn (${error || "no detail"}), ` +
      "so that turn was lost. Everything before it stands: the tool results above " +
      "are yours and do not need fetching again, and everything you recorded is still in " +
      "the ledger. Carry on from where you were, and call finish when you are done."
    );
  }
}
