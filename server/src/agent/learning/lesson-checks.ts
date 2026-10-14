import { Scope, type LessonChange, type ResearchStore } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { PlaybookShelf } from "./playbook-shelf.js";

/** Why a lesson may not be staged (spec §5.3): a memory or playbook change needs the owner's feedback behind it and something real to change; a distilled playbook needs the document it came from and a key no playbook has. */
export class LessonChecks {
  constructor(private readonly store: ResearchStore) {}

  async problems(workspaceId: string, change: LessonChange, feedbackIds: readonly string[]): Promise<string[]> {
    Trace.line(import.meta.url, "LessonChecks.problems", { workspaceId, kind: change.kind });
    const scope = Scope.of(workspaceId);
    if (change.kind === "playbook_new") return this.distilled(workspaceId, change.document_id, change.playbook.key);
    if (feedbackIds.length === 0) return ["a lesson must name the feedback that caused it; a lesson with none is refused"];
    const known = new Set((await this.store.feedback.list(scope, 500)).map((f) => f.id));
    const unknown = feedbackIds.filter((id) => !known.has(id));
    if (unknown.length > 0) return [`no feedback ${unknown.join(", ")} in this brand's record`];
    if (change.kind === "playbook_change") return this.changed(workspaceId, change.playbook.key, change.from_version, change.playbook.sections.length, change.playbook.criteria.length);
    const entries = await this.store.memory.current(scope);
    if (change.kind !== "memory_add" && !entries.some((entry) => entry.entry_id === change.entry_id)) return [`no memory entry ${change.entry_id} to ${change.kind === "memory_remove" ? "remove" : "change"}`];
    return [];
  }

  private async changed(workspaceId: string, key: string, from: number, sections: number, criteria: number): Promise<string[]> {
    Trace.line(import.meta.url, "LessonChecks.changed", { workspaceId, key, from });
    const current = await new PlaybookShelf(this.store).current(workspaceId, key);
    if (!current) return [`no playbook ${key} to change`];
    if (current.version !== from) return [`playbook ${key} is at version ${current.version}, not ${from}; propose against the current one`];
    return sections > 0 && criteria > 0 ? [] : ["a playbook keeps at least one section and one criterion"];
  }

  private async distilled(workspaceId: string, documentId: string, key: string): Promise<string[]> {
    Trace.line(import.meta.url, "LessonChecks.distilled", { workspaceId, documentId, key });
    const documents = await this.store.library.list(Scope.of(workspaceId));
    if (!documents.some((d) => d.id === documentId)) return [`no library document ${documentId}`];
    if (!/^[a-z][a-z0-9_]{2,40}$/.test(key)) return ["a playbook key is lower_snake_case, 3 to 41 characters"];
    const taken = (await new PlaybookShelf(this.store).list(workspaceId)).some((p) => p.key === key);
    return taken ? [`a playbook ${key} exists; propose a change to it instead`] : [];
  }
}
