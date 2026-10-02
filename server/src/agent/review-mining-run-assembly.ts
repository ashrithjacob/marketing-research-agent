import { CheckProblems, type Brief, type MiningTarget, type ResearchStore } from "../domain/index.js";
import { PacketValidator, ReviewMiningPacket, type PullFailure } from "../extract/index.js";
import { Trace } from "../trace/index.js";

import type { LiveRuns } from "./live-runs.js";
import type { ReviewLedger } from "./review-ledger.js";
import type { Assembled, RunAssembly } from "./run-assembly.js";

/** The review-mining packet, computed from the reviews the pulls brought back, which are saved first however the run ends. */
export class ReviewMiningRunAssembly implements RunAssembly {
  readonly via = "pipeline";

  constructor(
    private readonly store: ResearchStore,
    private readonly runs: LiveRuns,
    readonly runId: string,
    private readonly brief: Brief,
    private readonly ledger: ReviewLedger,
    private readonly mined: () => { targets: readonly MiningTarget[]; failures: readonly PullFailure[] },
  ) {}

  assemble(): Assembled {
    Trace.line(import.meta.url, "ReviewMiningRunAssembly.assemble", { runId: this.runId });
    this.ledger.saveTo(this.store, this.runs, this.runId);
    const snapshot = this.ledger.snapshot();
    const { targets, failures } = this.mined();
    if (targets.length === 0 && snapshot.pulls.length === 0) return { packet: null, problems: [], retracted: [] };
    const draft = new ReviewMiningPacket(targets, snapshot, failures).draft(this.runId, this.brief);
    const { packet, problems } = new PacketValidator(snapshot).inspect(draft, ["review_mining"], this.brief);
    return { packet, problems: CheckProblems.texts(problems), retracted: [] };
  }
}
