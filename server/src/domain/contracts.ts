import type { Deliverable } from "./deliverable.js";
import type { Node } from "./nodes.js";
import type { DraftComplete, TaskContract, VerdictComplete } from "./task-contract.js";
import { Trace } from "../trace/index.js";

/** What a contract's `complete` is, by its shape: a research deliverable, a draft to write, or verdicts to give. */
export class Contracts {
  static deliverable(contract: TaskContract): Deliverable | null {
    Trace.line(import.meta.url, "Contracts.deliverable", { shape: contract.complete.shape });
    const complete = contract.complete;
    return complete.shape === "draft" || complete.shape === "verdict" ? null : complete;
  }

  static draft(contract: TaskContract): DraftComplete | null {
    Trace.line(import.meta.url, "Contracts.draft");
    return contract.complete.shape === "draft" ? contract.complete : null;
  }

  static verdict(contract: TaskContract): VerdictComplete | null {
    Trace.line(import.meta.url, "Contracts.verdict");
    return contract.complete.shape === "verdict" ? contract.complete : null;
  }

  static node(contract: TaskContract): Node | null {
    Trace.line(import.meta.url, "Contracts.node");
    return Contracts.deliverable(contract)?.node ?? null;
  }
}
