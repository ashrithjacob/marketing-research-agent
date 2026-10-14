import type { AlwaysOn, ResearchStore } from "../../domain/index.js";
import { Scope } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { RunError } from "../errors.js";

import type { Watchers } from "../watch/watchers.js";
import type { WorkspaceSpend } from "./workspace-spend.js";

export interface AlwaysOnStatus extends AlwaysOn {
  spent_today: number;
  running: number;
}

/** The Always on switch (spec §7.2): on needs a daily cap and starts the workspace's watchers; off stops them at once. Tasks already running finish inside their own caps. */
export class AlwaysOnDesk {
  constructor(
    private readonly store: ResearchStore,
    private readonly watchers: Watchers,
    private readonly spend: WorkspaceSpend,
  ) {}

  async set(workspaceId: string, on: boolean, dailyCapUsd: number | null): Promise<AlwaysOnStatus> {
    Trace.line(import.meta.url, "AlwaysOnDesk.set", { workspaceId, on, dailyCapUsd });
    if (on && !(typeof dailyCapUsd === "number" && dailyCapUsd > 0)) throw new RunError("Always on needs a daily spend cap in dollars, above zero");
    await this.store.alwaysOn.set(workspaceId, on, on ? dailyCapUsd : (await this.store.alwaysOn.get(workspaceId)).daily_cap_usd);
    if (on) await this.watchers.start(workspaceId);
    else await this.watchers.stop(workspaceId);
    return this.status(workspaceId);
  }

  async status(workspaceId: string): Promise<AlwaysOnStatus> {
    Trace.line(import.meta.url, "AlwaysOnDesk.status", { workspaceId });
    const always = await this.store.alwaysOn.get(workspaceId);
    const running = (await this.store.listRuns(Scope.of(workspaceId), 100)).filter((run) => run.contract && ["queued", "running", "waiting"].includes(run.status)).length;
    return { ...always, spent_today: await this.spend.today(workspaceId), running };
  }

  /** At startup: the watcher of every workspace with Always on, started if it is not already there. */
  async recover(): Promise<number> {
    Trace.line(import.meta.url, "AlwaysOnDesk.recover");
    const on = await this.store.alwaysOn.on();
    for (const id of on) await this.watchers.start(id);
    return on.length;
  }
}
