import { FeedbackStrengths, Scope, type MemoryEntry, type ResearchStore } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { RunError } from "../errors.js";

/** Brand memory as the owner edits it and as tasks read it. An owner's edit is a new version marked `by: owner`, and counts as a correction (spec §5.4). */
export class MemoryDesk {
  constructor(private readonly store: ResearchStore) {}

  list(workspaceId: string): Promise<MemoryEntry[]> {
    Trace.line(import.meta.url, "MemoryDesk.list", { workspaceId });
    return this.store.memory.current(Scope.of(workspaceId));
  }

  /** The memory as a prompt section, or nothing when there is none. */
  async section(workspaceId: string): Promise<string | undefined> {
    Trace.line(import.meta.url, "MemoryDesk.section", { workspaceId });
    const entries = await this.list(workspaceId);
    if (entries.length === 0) return undefined;
    return ["What the owner has taught us about this brand. Follow it:", ...entries.map((entry) => `- ${entry.text}`)].join("\n");
  }

  async write(workspaceId: string, change: { entry_id?: string; text?: string; deleted?: boolean }): Promise<MemoryEntry> {
    Trace.line(import.meta.url, "MemoryDesk.write", { workspaceId, entryId: change.entry_id ?? "", deleted: change.deleted === true });
    const current = change.entry_id ? (await this.list(workspaceId)).find((entry) => entry.entry_id === change.entry_id) : undefined;
    if (change.entry_id && !current) throw new RunError(`no memory entry ${change.entry_id}`);
    const text = (change.text ?? current?.text ?? "").trim();
    if (!text) throw new RunError("a memory entry needs text");
    const entry = await this.store.memory.write(workspaceId, { ...(change.entry_id ? { entry_id: change.entry_id } : {}), text, by: "owner", deleted: change.deleted === true });
    const diff = change.deleted ? { removed: current?.text ?? text } : current ? { from: current.text, to: text } : { added: text };
    await this.store.feedback.record(workspaceId, { verdict: "edited", target: FeedbackStrengths.target("memory", entry.entry_id), text: "", diff });
    return entry;
  }
}
