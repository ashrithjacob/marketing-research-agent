import type { Scope } from "./accounts.js";

/** What a lesson would do to brand memory. */
export type LessonChange =
  | { kind: "memory_add"; text: string }
  | { kind: "memory_change"; entry_id: string; text: string }
  | { kind: "memory_remove"; entry_id: string };

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
