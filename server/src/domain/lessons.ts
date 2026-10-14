import type { Scope } from "./accounts.js";
import type { PlaybookBody } from "./playbooks.js";

/** What a lesson would do: to brand memory, to a playbook (a new version of it), or a new playbook distilled from a library document (spec §5.8). */
export type LessonChange =
  | { kind: "memory_add"; text: string }
  | { kind: "memory_change"; entry_id: string; text: string }
  | { kind: "memory_remove"; entry_id: string }
  | { kind: "playbook_change"; from_version: number; playbook: PlaybookBody }
  | { kind: "playbook_new"; document_id: string; playbook: PlaybookBody };

export type LessonStatus = "staged" | "approved" | "rejected" | "nothing";

/** A change the reviewer proposes, traced to the feedback that caused it (spec §5.3). `nothing` records that a review found nothing to learn. */
export interface Lesson {
  id: string;
  workspace_id: string;
  change: LessonChange | null;
  why: string;
  feedback_ids: string[];
  status: LessonStatus;
  card_id: string;
  created_at: string;
  resolved_at: string;
}

export interface LessonDraft {
  change: LessonChange | null;
  why: string;
  feedback_ids: string[];
  status: "staged" | "nothing";
}

export interface LessonBook {
  stage(workspaceId: string, draft: LessonDraft): Promise<Lesson>;
  get(scope: Scope, lessonId: string): Promise<Lesson | null>;
  list(scope: Scope, limit: number): Promise<Lesson[]>;
  attach(lessonId: string, cardId: string): Promise<void>;
  resolve(lessonId: string, status: "approved" | "rejected", change: LessonChange | null): Promise<Lesson | null>;
}
