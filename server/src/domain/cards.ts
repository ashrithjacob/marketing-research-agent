import type { Scope } from "./accounts.js";
import type { Brief } from "./brief.js";
import type { TaskContract } from "./task-contract.js";

export type CardKind = "question" | "approval";
export type CardStatus = "open" | "answered" | "approved" | "rejected";

/** What resolving a card does: hand a paused task its answer, hand the operator its answer, or start a task the owner approved. */
export type CardAction =
  | { kind: "answer_task"; run_id: string }
  | { kind: "reply_operator" }
  | { kind: "start_task"; brief: Brief; contract: TaskContract; plan_id: string; task_key: string };

/** Something only the owner can settle, shown as a card until they do (spec §7.2). */
export interface Card {
  id: string;
  workspace_id: string;
  kind: CardKind;
  status: CardStatus;
  title: string;
  body: string;
  action: CardAction;
  answer: string;
  created_at: string;
  resolved_at: string;
}

export interface CardDraft {
  kind: CardKind;
  title: string;
  body: string;
  action: CardAction;
}

/** The owner's cards, newest first. */
export interface CardBook {
  create(workspaceId: string, draft: CardDraft): Promise<Card>;
  get(scope: Scope, cardId: string): Promise<Card | null>;
  list(scope: Scope, limit: number): Promise<Card[]>;
  resolve(cardId: string, status: Exclude<CardStatus, "open">, answer: string): Promise<Card | null>;
}
