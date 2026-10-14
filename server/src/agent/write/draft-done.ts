import { CheckProblems, Findings, Scope, type CheckProblem, type DraftBook, type FindingLedger, type Playbook } from "../../domain/index.js";
import { DraftCheck } from "../../extract/index.js";
import { Trace } from "../../trace/index.js";

import type { DoneCheck } from "../done-check.js";

/** A write task is done when its draft passes the playbook's check against its own findings. */
export class DraftDone implements DoneCheck {
  constructor(
    private readonly drafts: DraftBook,
    private readonly ledger: FindingLedger,
    private readonly run: { runId: string; playbook: () => Promise<Playbook | null> },
  ) {}

  async problems(): Promise<CheckProblem[]> {
    Trace.line(import.meta.url, "DraftDone.problems", { runId: this.run.runId });
    const playbook = await this.run.playbook();
    if (!playbook) return [CheckProblems.of("the draft's playbook is missing from this workspace")];
    const rows = Findings.live(await this.ledger.list(this.run.runId));
    return DraftCheck.problems(playbook, await this.drafts.ofRun(this.run.runId), rows);
  }
}

/** A critique is done when every criterion has a verdict on the draft. */
export class VerdictDone implements DoneCheck {
  constructor(
    private readonly drafts: DraftBook,
    private readonly scope: { workspaceId: string; draftId: string; criteria: readonly string[] },
  ) {}

  async problems(): Promise<CheckProblem[]> {
    Trace.line(import.meta.url, "VerdictDone.problems", { draftId: this.scope.draftId });
    const { workspaceId, draftId, criteria } = this.scope;
    const draft = await this.drafts.get(Scope.of(workspaceId), draftId);
    const given = new Set((draft?.verdicts ?? []).map((verdict) => verdict.criterion));
    return criteria
      .map((criterion, i) => (given.has(criterion) ? null : CheckProblems.of(`criterion ${i + 1} has no verdict; record one with record_verdict`)))
      .filter((problem): problem is CheckProblem => problem !== null);
  }
}
