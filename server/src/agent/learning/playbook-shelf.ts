import { SEED_PLAYBOOKS, Scope, type Playbook, type ResearchStore } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

/** A workspace's playbooks as tasks read them: the seeds are written as version 1 the first time a workspace looks, so every version a task reads is a stored row it can be measured against (spec §5.5). */
export class PlaybookShelf {
  constructor(private readonly store: ResearchStore) {}

  async current(workspaceId: string, key: string): Promise<Playbook | null> {
    Trace.line(import.meta.url, "PlaybookShelf.current", { workspaceId, key });
    await this.seed(workspaceId);
    return this.store.playbooks.current(Scope.of(workspaceId), key);
  }

  async at(workspaceId: string, key: string, version: number): Promise<Playbook | null> {
    Trace.line(import.meta.url, "PlaybookShelf.at", { workspaceId, key, version });
    await this.seed(workspaceId);
    return this.store.playbooks.at(Scope.of(workspaceId), key, version);
  }

  async list(workspaceId: string): Promise<Playbook[]> {
    Trace.line(import.meta.url, "PlaybookShelf.list", { workspaceId });
    await this.seed(workspaceId);
    return this.store.playbooks.list(workspaceId);
  }

  private async seed(workspaceId: string): Promise<void> {
    Trace.line(import.meta.url, "PlaybookShelf.seed", { workspaceId });
    const have = new Set((await this.store.playbooks.list(workspaceId)).map((p) => p.key));
    for (const body of Object.values(SEED_PLAYBOOKS)) if (!have.has(body.key)) await this.store.playbooks.add(workspaceId, body, "seed", "");
  }
}
