import type { Scope } from "./accounts.js";

/** One version of one brand-memory entry. Nothing is overwritten: a change or a deletion is a new version. */
export interface MemoryEntry {
  entry_id: string;
  version: number;
  workspace_id: string;
  text: string;
  by: "owner" | "lesson";
  lesson_id: string;
  deleted: boolean;
  created_at: string;
}

export interface MemoryWrite {
  entry_id?: string;
  text: string;
  by: MemoryEntry["by"];
  lesson_id?: string;
  deleted?: boolean;
}

/** A brand's memory (spec §5.1): what the owner and approved lessons have said about this brand, read by every task. */
export interface MemoryBook {
  /** The newest version of each entry that is not deleted. */
  current(scope: Scope): Promise<MemoryEntry[]>;
  /** Every version, newest first, deletions included. */
  history(scope: Scope, limit: number): Promise<MemoryEntry[]>;
  write(workspaceId: string, change: MemoryWrite): Promise<MemoryEntry>;
}
