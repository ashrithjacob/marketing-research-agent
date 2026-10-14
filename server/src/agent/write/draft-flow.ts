import { Findings, RunStatuses, Scope, type FindingKind, type Plan, type ResearchRun, type ResearchStore, type TaskContract } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { RunError } from "../errors.js";
import { PlaybookShelf } from "../learning/playbook-shelf.js";
import type { TaskEvents } from "../task/task-events.js";
import type { TaskSupervisor } from "../task/task-supervisor.js";

/** A draft's way through (spec §3.1, `write` then `critique`): written from a plan's findings, critiqued against its playbook's criteria, then put in front of the owner with an approval card. */
export class DraftFlow {
  static readonly CITABLE: ReadonlySet<FindingKind> = new Set(["excerpt", "measurement", "attribute", "competitor", "competitor_reference"]);
  static readonly MAX_INPUTS = 80;

  private readonly shelf: PlaybookShelf;

  constructor(
    private readonly store: ResearchStore,
    private readonly tasks: TaskSupervisor,
    private readonly budget: { maxUsd: number },
    events: TaskEvents,
  ) {
    Trace.line(import.meta.url, "DraftFlow.constructor");
    this.shelf = new PlaybookShelf(store);
    events.on((runId, status) => this.ended(runId, status));
  }

  /** A write task on the findings of every task the plan has run, by the playbook named. */
  async write(planId: string, scope: Scope, playbookKey: string): Promise<ResearchRun> {
    Trace.line(import.meta.url, "DraftFlow.write", { planId, playbookKey });
    const plan = await this.store.plans.get(scope, planId);
    if (!plan) throw new RunError(`no plan ${planId}`);
    const playbook = await this.shelf.current(plan.workspace_id, playbookKey);
    if (!playbook || playbook.primitive !== "write") throw new RunError(`no write playbook ${playbookKey}`);
    if (playbook.status === "archived") throw new RunError(`the playbook ${playbookKey} is archived; restore it first`);
    if (playbook.status === "stale") await this.store.playbooks.mark(plan.workspace_id, playbook.key, "active");
    const inputs = await this.inputs(plan);
    if (inputs.length === 0) throw new RunError("the plan's tasks have found nothing yet to write from");
    const contract: TaskContract = {
      objective: `Write a ${playbook.title.toLowerCase()} for ${plan.brief.product || plan.brief.url}, from what the research found.`,
      primitive: "write",
      complete: { shape: "draft", playbook: playbook.key, version: playbook.version },
      inputs: { finding_ids: inputs, document_ids: [] },
      budget: { max_usd: this.budget.maxUsd, max_minutes: 20 },
      verify: "critique",
    };
    return this.tasks.start({ brief: plan.brief, contract }, plan.workspace_id);
  }

  /** The findings a plan's ended tasks keep, by reference, most recent tasks first. */
  private async inputs(plan: Plan): Promise<string[]> {
    Trace.line(import.meta.url, "DraftFlow.inputs", { planId: plan.id });
    const refs: string[] = [];
    for (const task of plan.tasks) {
      if (!task.run_id) continue;
      const run = await this.store.getRun(task.run_id);
      if (!run || !RunStatuses.delivered(run.status)) continue;
      const rows = Findings.live(await this.store.findings.list(run.id)).filter((row) => DraftFlow.CITABLE.has(row.kind));
      refs.push(...rows.map((row) => `${run.id}/${row.id}`));
    }
    return refs.slice(0, DraftFlow.MAX_INPUTS);
  }

  private async ended(runId: string, status: string): Promise<void> {
    Trace.line(import.meta.url, "DraftFlow.ended", { runId, status });
    const run = await this.store.getRun(runId);
    const complete = run?.contract?.complete as { shape?: string; draft_id?: string } | undefined;
    if (!run || !complete) return;
    if (complete.shape === "draft") await this.written(run, status);
    if (complete.shape === "verdict" && complete.draft_id) await this.critiqued(run, complete.draft_id);
  }

  private async written(run: ResearchRun, status: string): Promise<void> {
    Trace.line(import.meta.url, "DraftFlow.written", { runId: run.id, status });
    const draft = await this.store.drafts.ofRun(run.id);
    if (!draft) return;
    if (status !== "completed") return this.review(run.workspace_id, draft.id, `The writer ended ${status}, before its draft passed its check, so it was not critiqued.`);
    const playbook = await this.shelf.at(run.workspace_id, draft.playbook, draft.playbook_version);
    if (!playbook) return this.review(run.workspace_id, draft.id, "Its playbook version is missing, so it was not critiqued.");
    const contract: TaskContract = {
      objective: `Check the draft of a ${playbook.title.toLowerCase()} against each criterion.`,
      primitive: "critique",
      complete: { shape: "verdict", draft_id: draft.id, criteria: playbook.criteria },
      inputs: { finding_ids: [], document_ids: [] },
      budget: { max_usd: this.budget.maxUsd, max_minutes: 10 },
      verify: "code",
    };
    await this.store.drafts.mark(draft.id, "critique");
    await this.tasks.start({ brief: run.brief, contract }, run.workspace_id);
  }

  /** However the critique ended, the owner decides; its verdicts so far are on the draft. */
  private async critiqued(run: ResearchRun, draftId: string): Promise<void> {
    Trace.line(import.meta.url, "DraftFlow.critiqued", { runId: run.id, draftId });
    const draft = await this.store.drafts.get(Scope.of(run.workspace_id), draftId);
    if (!draft) return;
    const failed = draft.verdicts.filter((verdict) => !verdict.pass).length;
    await this.review(run.workspace_id, draftId, `The critic checked it: ${draft.verdicts.length - failed} criteria met, ${failed} not.`);
  }

  private async review(workspaceId: string, draftId: string, said: string): Promise<void> {
    Trace.line(import.meta.url, "DraftFlow.review", { draftId });
    await this.store.drafts.mark(draftId, "review");
    await this.store.cards.create(workspaceId, {
      kind: "approval",
      title: "A draft is ready for you",
      body: `${said} Read it, edit it, then approve or reject it.`,
      action: { kind: "draft", draft_id: draftId },
    });
  }
}
