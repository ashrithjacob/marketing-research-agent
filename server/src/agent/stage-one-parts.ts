import { Briefs, Findings, RoleRecords, Roles, StageOnePlans, competitorReferenceSchema, type Brief, type CheckProblem, type FindingLedger, type Node, type StageOneAgent } from "../domain/index.js";
import { ChampionCheck, DeliverableChecks } from "../extract/index.js";
import { Trace } from "../trace/index.js";

import { PartClose, type CloseReason } from "./part-close.js";
import { RoleChecks, type CheckedRun } from "./role-checks.js";
import { RunFindings } from "./run-findings.js";

const SETTLED: CloseReason = { gap: "the agent ended without finishing", status: "the agent ended without reporting its status" };

/** A stage-1 run's agents as settlement sees them: each one's own check on the ledger it left, and each part closed for an agent that ended without finishing, so that only a grave problem leaves the run invalid. */
export class StageOneParts {
  private readonly run: CheckedRun;

  constructor(
    private readonly ledger: FindingLedger,
    private readonly runId: string,
    run: { brief: Brief; nodes: readonly Node[] },
  ) {
    Trace.line(import.meta.url, "StageOneParts.constructor", { runId });
    this.run = { ...run, markets: Briefs.markets(run.brief) };
  }

  async problems(): Promise<CheckProblem[]> {
    Trace.line(import.meta.url, "StageOneParts.problems", { runId: this.runId });
    const each = await Promise.all(
      this.agents().map(async (id) => {
        const check = RoleChecks.done(Roles.of(id), this.findings(id), this.run);
        return (await check.problems()).map((problem) => ({ ...problem, text: `${id}: ${problem.text}` }));
      }),
    );
    return each.flat();
  }

  /** What an agent left open is gapped, as its turn limit would have, and a genre champion with no ranking is recorded as one that could not be had. A run that recorded nothing is left as it is: finding nothing is the grave case. */
  async close(): Promise<void> {
    Trace.line(import.meta.url, "StageOneParts.close", { runId: this.runId });
    if (Findings.live(await this.ledger.list(this.runId)).length === 0) return;
    for (const id of this.agents()) {
      const role = Roles.of(id);
      const part = { node: Roles.node(role, this.run.nodes), reports: RoleRecords.of(role).includes("node_status") };
      await new PartClose(this.findings(id), DeliverableChecks.of(role.deliverable, this.run.markets), part).close(SETTLED);
    }
    if (this.agents().includes("champion")) await this.closeRanking();
  }

  private async closeRanking(): Promise<void> {
    Trace.line(import.meta.url, "StageOneParts.closeRanking", { runId: this.runId });
    const live = Findings.live(await this.ledger.list(this.runId));
    const row = live.find((r) => r.kind === "competitor_reference");
    const reference = row ? competitorReferenceSchema.safeParse(row.payload) : null;
    if (!reference?.success) return;
    const gaps = live.filter((r) => r.kind === "gap").map((r) => ({ missing: String(r.payload.missing ?? "") }));
    const lacking = ChampionCheck.ranking(reference.data, gaps, this.run.brief);
    if (lacking.length === 0) return;
    await this.findings("champion").record("gap", {
      node: StageOnePlans.nodeOf("champion", this.run.nodes),
      missing: `champion ranking unavailable: ${lacking.join("; ")}`,
      would_need: "the champion agent to rank the genre on Amazon",
    });
  }

  private agents(): StageOneAgent[] {
    Trace.line(import.meta.url, "StageOneParts.agents", { runId: this.runId });
    const plan = StageOnePlans.of(this.run.brief, this.run.nodes);
    return [...(plan.champion ? (["champion"] as const) : []), ...plan.parallel];
  }

  private findings(id: StageOneAgent): RunFindings {
    Trace.line(import.meta.url, "StageOneParts.findings", { id });
    return new RunFindings(this.ledger, this.runId, id, Roles.scope(Roles.of(id), this.run.nodes), this.run.markets);
  }
}
