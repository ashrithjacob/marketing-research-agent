import type { Settings } from "../../config/index.js";
import { Briefs, Scope, taskRequestSchema, type FindingKind, type ResearchRun, type ResearchStore, type TaskContract } from "../../domain/index.js";
import { ContractCheck, ZodProblems } from "../../extract/index.js";
import { Trace } from "../../trace/index.js";

import { RunError } from "../errors.js";
import { EXCERPT_RECORD } from "../prompt/text/excerpt-tool.js";
import { RECORD_TOOLS } from "../prompt/text/record-tools.js";

/** A task request read, its contract checked against what exists, and written as a queued run that carries the contract; nothing is written for a refused one. */
export class TaskIntake {
  constructor(
    private readonly store: ResearchStore,
    private readonly settings: Settings,
  ) {}

  async admit(body: unknown, workspaceId: string): Promise<ResearchRun> {
    Trace.line(import.meta.url, "TaskIntake.admit", { workspaceId });
    const parsed = taskRequestSchema.safeParse(body);
    if (!parsed.success) throw new RunError(`task refused: ${ZodProblems.list(parsed.error).join("; ")}`);
    const { contract } = parsed.data;
    const brief = Briefs.normalise(parsed.data.brief);
    if (!brief.product && !brief.url) throw new RunError("task refused: brief.product or brief.url is required");
    const problems = ContractCheck.problems(contract, {
      recordable: new Set<FindingKind>([...RECORD_TOOLS, EXCERPT_RECORD].map((tool) => tool.kind)),
      findings: await this.findings(contract, workspaceId),
      documents: new Set((await this.store.library.list(Scope.of(workspaceId))).map((doc) => doc.id)),
      maxUsd: this.settings.taskMaxUsd,
    });
    if (problems.length > 0) throw new RunError(`task refused: ${problems.join("; ")}`);
    return this.store.createRun({
      workspaceId,
      brief: brief as unknown as Record<string, unknown>,
      model: this.settings.model,
      rejectKinds: [],
      judgementIds: [],
      nodes: contract.complete.node ? [contract.complete.node] : [],
      stage: 1,
      contract: contract as unknown as Record<string, unknown>,
    });
  }

  /** Of the findings a contract names as `<run id>/<row id>`, the ones that exist in a run this workspace can see. */
  private async findings(contract: TaskContract, workspaceId: string): Promise<Set<string>> {
    Trace.line(import.meta.url, "TaskIntake.findings", { inputs: contract.inputs.finding_ids.length });
    const found = new Set<string>();
    for (const ref of contract.inputs.finding_ids) {
      const [runId = "", rowId = ""] = ref.split("/");
      const run = await this.store.getRun(runId);
      if (!run || !Scope.of(workspaceId).admits(run.workspace_id)) continue;
      if ((await this.store.findings.list(runId)).some((row) => row.id === rowId && !row.retracted_at)) found.add(ref);
    }
    return found;
  }
}
