import { Deliverables, PRIMITIVES, Primitives, type FindingKind, type TaskContract, type ToolName } from "../domain/index.js";
import { Trace } from "../trace/index.js";

/** What a contract is checked against that the contract itself does not hold. */
export interface ContractGrounds {
  recordable: ReadonlySet<FindingKind>;
  findings: ReadonlySet<string>;
  documents: ReadonlySet<string>;
  maxUsd: number;
}

const ASKS_FIRST: ReadonlySet<ToolName> = new Set(["amazon_find_product"]);

/** Refuses a contract that cannot be met, before anything is queued; the schema has already refused names outside the vocabulary. What needs the owner's approval first is `asksFirst`, not a refusal. */
export class ContractCheck {
  static problems(contract: TaskContract, grounds: ContractGrounds): string[] {
    Trace.line(import.meta.url, "ContractCheck.problems", { primitive: contract.primitive });
    return [
      ...ContractCheck.shape(contract),
      ...ContractCheck.reachable(contract, grounds.recordable),
      ...ContractCheck.inputs(contract, grounds),
      ...ContractCheck.budget(contract, grounds.maxUsd),
      ...ContractCheck.verify(contract),
    ];
  }

  private static shape(contract: TaskContract): string[] {
    Trace.line(import.meta.url, "ContractCheck.shape");
    const primitive = PRIMITIVES[contract.primitive];
    const node = contract.complete.node;
    if (node && primitive.nodes.includes(node)) return [];
    if (!node && contract.method === "champion") return [];
    return [`a ${primitive.name} task files under one of ${primitive.nodes.join(", ")}; this deliverable's node is ${node ?? "none"}`];
  }

  private static reachable(contract: TaskContract, recordable: ReadonlySet<FindingKind>): string[] {
    Trace.line(import.meta.url, "ContractCheck.reachable");
    return Deliverables.kinds(contract.complete)
      .filter((kind) => !recordable.has(kind))
      .map((kind) => `a ${contract.primitive} task cannot record '${kind}', so a deliverable naming it can never be met`);
  }

  private static inputs(contract: TaskContract, grounds: ContractGrounds): string[] {
    Trace.line(import.meta.url, "ContractCheck.inputs");
    const findings = contract.inputs.finding_ids.filter((id) => !grounds.findings.has(id)).map((id) => `input finding '${id}' is not in this workspace`);
    const documents = contract.inputs.document_ids.filter((id) => !grounds.documents.has(id)).map((id) => `input document '${id}' is not in this workspace`);
    return [...findings, ...documents];
  }

  private static budget(contract: TaskContract, maxUsd: number): string[] {
    Trace.line(import.meta.url, "ContractCheck.budget", { maxUsd });
    return contract.budget.max_usd > maxUsd ? [`budget.max_usd ${contract.budget.max_usd} is over the per-task cap of ${maxUsd}`] : [];
  }

  /** Why a contract may not run before the owner approves it with a button: a tool in reach that spends Apify money. Not a refusal; the task waits on an approval card. */
  static asksFirst(contract: TaskContract): string[] {
    Trace.line(import.meta.url, "ContractCheck.asksFirst");
    const paid = Primitives.role(contract).tools.filter((tool) => ASKS_FIRST.has(tool));
    return paid.length > 0 ? [`a ${contract.primitive} task can reach ${paid.join(", ")}, which spends Apify money`] : [];
  }

  private static verify(contract: TaskContract): string[] {
    Trace.line(import.meta.url, "ContractCheck.verify", { verify: contract.verify });
    return contract.verify === "code" ? [] : [`verify '${contract.verify}' has nothing to run it yet; only 'code' is built`];
  }
}
