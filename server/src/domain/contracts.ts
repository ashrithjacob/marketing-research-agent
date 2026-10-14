import type { Deliverable } from "./deliverable.js";
import type { Node } from "./nodes.js";
import type { DraftComplete, PlaybookComplete, TaskContract, VerdictComplete } from "./task-contract.js";
import { Trace } from "../trace/index.js";

/** What a contract's `complete` is, by its shape: a research deliverable, a draft to write, verdicts to give, or a playbook to propose. */
export class Contracts {
  static deliverable(contract: TaskContract): Deliverable | null {
    Trace.line(import.meta.url, "Contracts.deliverable", { shape: contract.complete.shape });
    const complete = contract.complete;
    return complete.shape === "draft" || complete.shape === "verdict" || complete.shape === "playbook" ? null : complete;
  }

  static draft(contract: TaskContract): DraftComplete | null {
    Trace.line(import.meta.url, "Contracts.draft");
    return contract.complete.shape === "draft" ? contract.complete : null;
  }

  static verdict(contract: TaskContract): VerdictComplete | null {
    Trace.line(import.meta.url, "Contracts.verdict");
    return contract.complete.shape === "verdict" ? contract.complete : null;
  }

  static playbook(contract: TaskContract): PlaybookComplete | null {
    Trace.line(import.meta.url, "Contracts.playbook");
    return contract.complete.shape === "playbook" ? contract.complete : null;
  }

  static node(contract: TaskContract): Node | null {
    Trace.line(import.meta.url, "Contracts.node");
    return Contracts.deliverable(contract)?.node ?? null;
  }
}
