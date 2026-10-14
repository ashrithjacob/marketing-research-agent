import type { Settings } from "../../config/index.js";
import type { AdInsights, AdLibrary, ResearchStore, Schedule } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { WorkspaceLimits } from "../always/workspace-limits.js";
import type { PiHarness } from "../pi-harness.js";

import { AdResultsWatch } from "./ad-results-watch.js";
import { CompetitorAdsWatch } from "./competitor-ads-watch.js";
import { CuratorWatch } from "./curator-watch.js";
import { ReviewsWatch } from "./reviews-watch.js";
import { ScheduleWatch } from "./schedule-watch.js";
import { Watchers } from "./watchers.js";

/** Every watcher of spec §7.3 but compaction, built once with what each reads and the operator's signal they all report through. */
export class WatchSet {
  static build(
    deps: { store: ResearchStore; harness: PiHarness; settings: Settings; ads: AdLibrary | null; insights: AdInsights | null; limits: WorkspaceLimits },
    signal: (workspaceId: string, text: string, key: string) => Promise<void>,
  ): Watchers {
    Trace.line(import.meta.url, "WatchSet.build");
    const { store, settings } = deps;
    const due = (workspaceId: string, schedule: Schedule, dueAt: string) =>
      signal(workspaceId, `Scheduled: ${schedule.task_key} for ${schedule.brief.product || schedule.brief.url} is due (every ${schedule.every_days} days).`, `schedule:${schedule.id}:${dueAt.slice(0, 10)}`);
    return new Watchers(store, deps.harness, [
      new ScheduleWatch(store, due),
      new CuratorWatch(store, signal),
      new AdResultsWatch(store, deps.insights, signal),
      new CompetitorAdsWatch(store, deps.ads, settings.prices, deps.limits, signal),
      new ReviewsWatch(store, settings.reviewReuseDays, signal),
    ]);
  }
}
