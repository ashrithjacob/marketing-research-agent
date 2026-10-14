import { Scope, type Playbook, type ResearchRun, type ResearchStore, type TaskContract } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { RunError } from "../errors.js";
import type { TaskSupervisor } from "../task/task-supervisor.js";

import { PlaybookScores, type PlaybookReport } from "./playbook-scores.js";
import { PlaybookShelf } from "./playbook-shelf.js";

/** The owner's playbooks: each with its versions' numbers and any flag, a rollback that writes an older version again as the newest, restoring an archived one, and distilling a new one from a library document. */
export class PlaybookDesk {
  private readonly shelf: PlaybookShelf;

  constructor(
    private readonly store: ResearchStore,
    private readonly tasks: TaskSupervisor,
    private readonly budget: { maxUsd: number },
  ) {
    Trace.line(import.meta.url, "PlaybookDesk.constructor");
    this.shelf = new PlaybookShelf(store);
  }

  async list(workspaceId: string): Promise<PlaybookReport[]> {
    Trace.line(import.meta.url, "PlaybookDesk.list", { workspaceId });
    const scores = new PlaybookScores(this.store);
    const reports: PlaybookReport[] = [];
    for (const playbook of await this.shelf.list(workspaceId)) reports.push(await scores.report(workspaceId, playbook));
    return reports;
  }

  async rollback(workspaceId: string, key: string, version: number): Promise<Playbook> {
    Trace.line(import.meta.url, "PlaybookDesk.rollback", { workspaceId, key, version });
    const older = await this.shelf.at(workspaceId, key, version);
    if (!older) throw new RunError(`no version ${version} of playbook ${key}`);
    const current = await this.shelf.current(workspaceId, key);
    if (current?.version === version) throw new RunError(`version ${version} is already the current one`);
    return this.store.playbooks.add(workspaceId, older, "rollback", "");
  }

  async restore(workspaceId: string, key: string): Promise<void> {
    Trace.line(import.meta.url, "PlaybookDesk.restore", { workspaceId, key });
    if (!(await this.shelf.current(workspaceId, key))) throw new RunError(`no playbook ${key}`);
    await this.store.playbooks.mark(workspaceId, key, "active");
  }

  async distil(workspaceId: string, documentId: string): Promise<ResearchRun> {
    Trace.line(import.meta.url, "PlaybookDesk.distil", { workspaceId, documentId });
    const document = (await this.store.library.list(Scope.of(workspaceId))).find((d) => d.id === documentId);
    if (!document) throw new RunError(`no library document ${documentId}`);
    if (document.status !== "ready") throw new RunError(`"${document.title}" is not converted yet`);
    const contract: TaskContract = {
      objective: `Distil a playbook from "${document.title}" for writing one kind of ad.`,
      primitive: "analyse",
      complete: { shape: "playbook", document_id: documentId },
      inputs: { finding_ids: [], document_ids: [documentId] },
      budget: { max_usd: this.budget.maxUsd, max_minutes: 15 },
      verify: "code",
    };
    return this.tasks.start({ brief: { product: `${document.title} (library)`, url: "", market: "", notes: "" }, contract }, workspaceId);
  }
}
