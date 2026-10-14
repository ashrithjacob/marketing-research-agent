import { Scope, type ResearchStore } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { WorkspaceSpend } from "./workspace-spend.js";

/** The limits on work nobody clicked (spec §7.4): Always on must be on, fewer than three tasks running, and today's spend under the daily cap. */
export class WorkspaceLimits {
  static readonly RUNNING = 3;

  constructor(
    private readonly store: ResearchStore,
    private readonly spend: WorkspaceSpend,
  ) {}

  /** Why unattended work may not start now; empty when it may. */
  async blocks(workspaceId: string): Promise<string[]> {
    Trace.line(import.meta.url, "WorkspaceLimits.blocks", { workspaceId });
    const always = await this.store.alwaysOn.get(workspaceId);
    if (!always.on) return ["Always on is off, so work starts only when the owner approves it"];
    const running = (await this.store.listRuns(Scope.of(workspaceId), 100)).filter((run) => run.contract && ["queued", "running", "waiting"].includes(run.status)).length;
    const reasons = running >= WorkspaceLimits.RUNNING ? [`${running} tasks are already running; at most ${WorkspaceLimits.RUNNING} run at once`] : [];
    const spent = await this.spend.today(workspaceId);
    if (always.daily_cap_usd !== null && spent >= always.daily_cap_usd) reasons.push(`today's spend, $${spent.toFixed(2)}, has reached the daily cap of $${always.daily_cap_usd.toFixed(2)}`);
    return reasons;
  }

  /** Whether a paid call may go ahead now: past the daily cap, with Always on, it may not. */
  async overCap(workspaceId: string): Promise<string | null> {
    Trace.line(import.meta.url, "WorkspaceLimits.overCap", { workspaceId });
    const always = await this.store.alwaysOn.get(workspaceId);
    if (!always.on || always.daily_cap_usd === null) return null;
    const spent = await this.spend.today(workspaceId);
    return spent >= always.daily_cap_usd ? `today's spend, $${spent.toFixed(2)}, has reached the daily cap of $${always.daily_cap_usd.toFixed(2)}` : null;
  }
}
