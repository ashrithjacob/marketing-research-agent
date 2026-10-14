import { Scope, type Playbook, type PlaybookStatus, type ResearchStore } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { PlaybookShelf } from "../learning/playbook-shelf.js";

import type { Watch } from "./watchers.js";

/** The curator (spec §5.6), deterministic part: when the workspace has had no task for an hour, at most once a day, a playbook unread for 30 days is marked stale and for 90 archived. Never deleted, and archived stays archived until the owner restores it. */
export class CuratorWatch implements Watch {
  readonly kind = "curator";
  static readonly HOUR_MS = 3_600_000;
  static readonly DAY_MS = 86_400_000;
  static readonly STALE_DAYS = 30;
  static readonly ARCHIVE_DAYS = 90;

  constructor(
    private readonly store: ResearchStore,
    private readonly signal: (workspaceId: string, text: string, key: string) => Promise<void>,
  ) {}

  async check(workspaceId: string, now: number): Promise<number> {
    Trace.line(import.meta.url, "CuratorWatch.check", { workspaceId });
    const last = Date.parse((await this.store.watch.mark(workspaceId, this.kind)) || "1970-01-01T00:00:00Z");
    if (now - last < CuratorWatch.DAY_MS) return last + CuratorWatch.DAY_MS;
    if (await this.busy(workspaceId, now)) return now + CuratorWatch.HOUR_MS;
    const changed: string[] = [];
    for (const playbook of await new PlaybookShelf(this.store).list(workspaceId)) {
      const status = CuratorWatch.status(playbook, await this.lastRead(workspaceId, playbook), now);
      if (status === playbook.status) continue;
      await this.store.playbooks.mark(workspaceId, playbook.key, status);
      changed.push(`${playbook.title} is now ${status}`);
    }
    const at = new Date(now).toISOString();
    await this.store.watch.setMark(workspaceId, this.kind, at);
    if (changed.length > 0) await this.signal(workspaceId, `Curator: ${changed.join("; ")}.`, `curator:${at.slice(0, 10)}`);
    return now + CuratorWatch.DAY_MS;
  }

  /** What the curator makes of a playbook last read at `read`: only forward, active to stale to archived. */
  static status(playbook: Playbook, read: number, now: number): PlaybookStatus {
    Trace.line(import.meta.url, "CuratorWatch.status", { key: playbook.key, status: playbook.status });
    if (playbook.status === "archived") return "archived";
    const days = (now - read) / CuratorWatch.DAY_MS;
    if (days >= CuratorWatch.ARCHIVE_DAYS) return "archived";
    return days >= CuratorWatch.STALE_DAYS ? "stale" : playbook.status;
  }

  private async busy(workspaceId: string, now: number): Promise<boolean> {
    Trace.line(import.meta.url, "CuratorWatch.busy", { workspaceId });
    const hourAgo = new Date(now - CuratorWatch.HOUR_MS).toISOString();
    return (await this.store.listRuns(Scope.of(workspaceId), 50)).some((run) => run.contract && (["queued", "running", "waiting"].includes(run.status) || run.created_at > hourAgo));
  }

  /** When a task last read the playbook: its newest draft, or the newest version's writing when none has. */
  private async lastRead(workspaceId: string, playbook: Playbook): Promise<number> {
    Trace.line(import.meta.url, "CuratorWatch.lastRead", { key: playbook.key });
    const drafts = (await this.store.drafts.list(Scope.of(workspaceId), 500)).filter((d) => d.playbook === playbook.key).map((d) => d.created_at);
    return Date.parse([playbook.created_at, ...drafts].sort().pop()!);
  }
}
