import type { Scope } from "./accounts.js";
import { Trace } from "../trace/index.js";

export const FEEDBACK_VERDICTS = ["reject", "edited", "accept", "answer", "steer", "outcome"] as const;
export type FeedbackVerdict = (typeof FEEDBACK_VERDICTS)[number];
export type FeedbackStrength = "correction" | "confirmation" | "instruction" | "outcome";

/** What a piece of feedback is about: a source or finding of a run, a task of a plan, a card, or a running task. */
export interface FeedbackTarget {
  kind: "source" | "finding" | "contract" | "card" | "task" | "memory" | "lesson" | "draft";
  id: string;
  run_id: string;
  plan_id: string;
}

/** Something the owner did that counts (spec §5.2), stored against what it was about. */
export interface Feedback {
  id: string;
  workspace_id: string;
  verdict: FeedbackVerdict;
  strength: FeedbackStrength;
  target: FeedbackTarget;
  text: string;
  diff: Record<string, unknown> | null;
  created_at: string;
}

export interface FeedbackDraft {
  verdict: FeedbackVerdict;
  target: FeedbackTarget;
  text: string;
  diff?: Record<string, unknown>;
}

/** The owner's feedback, newest first. */
export interface FeedbackBook {
  record(workspaceId: string, draft: FeedbackDraft): Promise<Feedback>;
  list(scope: Scope, limit: number): Promise<Feedback[]>;
}

/** How much a verdict weighs, by the table in spec §5.2. */
export class FeedbackStrengths {
  static of(verdict: FeedbackVerdict): FeedbackStrength {
    Trace.line(import.meta.url, "FeedbackStrengths.of", { verdict });
    if (verdict === "accept") return "confirmation";
    if (verdict === "answer") return "instruction";
    if (verdict === "outcome") return "outcome";
    return "correction";
  }

  static target(kind: FeedbackTarget["kind"], id: string, at: { run_id?: string; plan_id?: string } = {}): FeedbackTarget {
    Trace.line(import.meta.url, "FeedbackStrengths.target", { kind, id });
    return { kind, id, run_id: at.run_id ?? "", plan_id: at.plan_id ?? "" };
  }
}
