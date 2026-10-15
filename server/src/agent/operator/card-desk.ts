import { FeedbackStrengths, Scope, type Card, type CardDraft, type FeedbackVerdict, type PlanBook, type ResearchStore } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { RunError } from "../errors.js";
import type { TaskEvents } from "../task/task-events.js";
import type { TaskSupervisor } from "../task/task-supervisor.js";

/** What resolving a card hands on to: the operator's reply, a lesson's decision, a draft's settling, and a plan stage's approval. */
export interface CardResolvers {
  reply: (workspaceId: string, text: string) => Promise<void>;
  lesson: (lessonId: string, approved: boolean, text: string) => Promise<void>;
  draft: (draftId: string, approved: boolean) => Promise<void>;
  stage: (planId: string, approved: boolean) => Promise<void>;
}

/** The owner's cards (spec §7.2): a paused task's question, the operator's question, and approvals. Resolving one does what its action says, once. */
export class CardDesk {
  constructor(
    private readonly store: ResearchStore,
    private readonly plans: PlanBook,
    private readonly tasks: TaskSupervisor,
    private readonly resolve: CardResolvers,
    events: TaskEvents,
  ) {
    Trace.line(import.meta.url, "CardDesk.constructor");
    events.onAsked((runId, question) => this.taskAsked(runId, question));
    events.onAnswered((runId, answer) => this.taskAnswered(runId, answer));
  }

  open(workspaceId: string, draft: CardDraft): Promise<Card> {
    Trace.line(import.meta.url, "CardDesk.open", { workspaceId, kind: draft.kind });
    return this.store.cards.create(workspaceId, draft);
  }

  async answer(cardId: string, scope: Scope, text: string): Promise<Card> {
    Trace.line(import.meta.url, "CardDesk.answer", { cardId });
    const card = await this.unresolved(cardId, scope, "question");
    if (card.action.kind === "answer_task") await this.tasks.answer(card.action.run_id, text);
    if (card.action.kind === "reply_operator") await this.resolve.reply(card.workspace_id, `My answer to your question "${card.body}": ${text}`);
    await this.feedback(card, "answer", text);
    return (await this.store.cards.resolve(card.id, "answered", text)) ?? { ...card, status: "answered", answer: text };
  }

  /** The owner's approval: a lesson is applied, with their edit of it when they made one; a task is started, past the money check it was waiting on. */
  async approve(cardId: string, scope: Scope, edit = ""): Promise<Card> {
    Trace.line(import.meta.url, "CardDesk.approve", { cardId });
    const card = await this.unresolved(cardId, scope, "approval");
    if (card.action.kind === "lesson") {
      await this.resolve.lesson(card.action.lesson_id, true, edit);
      return (await this.store.cards.resolve(card.id, "approved", edit))!;
    }
    if (card.action.kind === "draft") return this.settleDraft(card, scope, true);
    if (card.action.kind === "start_stage") return this.settleStage(card, true);
    if (card.action.kind !== "start_task") throw new RunError(`card ${cardId} has nothing to start`);
    const { brief, contract, plan_id, task_key } = card.action;
    const run = await this.tasks.start({ brief, contract }, card.workspace_id, { approved: true });
    await this.onPlan(plan_id, task_key, { run_id: run.id, error: "" });
    await this.feedback(card, "accept", "", run.id);
    return (await this.store.cards.resolve(card.id, "approved", run.id))!;
  }

  async reject(cardId: string, scope: Scope): Promise<Card> {
    Trace.line(import.meta.url, "CardDesk.reject", { cardId });
    const card = await this.unresolved(cardId, scope, "approval");
    if (card.action.kind === "draft") return this.settleDraft(card, scope, false);
    if (card.action.kind === "start_stage") return this.settleStage(card, false);
    if (card.action.kind === "start_task") await this.onPlan(card.action.plan_id, card.action.task_key, { error: "rejected by the owner" });
    if (card.action.kind === "lesson") await this.resolve.lesson(card.action.lesson_id, false, "");
    else await this.feedback(card, "reject", "");
    return (await this.store.cards.resolve(card.id, "rejected", ""))!;
  }

  /** The draft desk resolves the draft's card and records the feedback, against the draft. */
  private async settleDraft(card: Card, scope: Scope, approved: boolean): Promise<Card> {
    Trace.line(import.meta.url, "CardDesk.settleDraft", { cardId: card.id, approved });
    if (card.action.kind === "draft") await this.resolve.draft(card.action.draft_id, approved);
    return (await this.store.cards.get(scope, card.id))!;
  }

  /** A plan stage's card: resolved first, so the stage it starts is never asked twice; the plan records the run or the refusal. */
  private async settleStage(card: Card, approved: boolean): Promise<Card> {
    Trace.line(import.meta.url, "CardDesk.settleStage", { cardId: card.id, approved });
    const resolved = (await this.store.cards.resolve(card.id, approved ? "approved" : "rejected", ""))!;
    if (card.action.kind === "start_stage") await this.resolve.stage(card.action.plan_id, approved);
    await this.feedback(card, approved ? "accept" : "reject", "");
    return resolved;
  }

  private async feedback(card: Card, verdict: FeedbackVerdict, text: string, startedRun = ""): Promise<void> {
    Trace.line(import.meta.url, "CardDesk.feedback", { cardId: card.id, verdict });
    const action = card.action;
    const at = { run_id: action.kind === "answer_task" ? action.run_id : startedRun, plan_id: action.kind === "start_task" || action.kind === "start_stage" ? action.plan_id : "" };
    await this.store.feedback.record(card.workspace_id, { verdict, target: FeedbackStrengths.target("card", card.id, at), text });
  }

  private async taskAsked(runId: string, question: string): Promise<void> {
    Trace.line(import.meta.url, "CardDesk.taskAsked", { runId });
    const run = await this.store.getRun(runId);
    if (!run) return;
    await this.open(run.workspace_id, { kind: "question", title: String(run.contract?.objective ?? "A task"), body: question, action: { kind: "answer_task", run_id: runId } });
  }

  /** A paused task answered another way, through the chat, closes its card with that answer. */
  private async taskAnswered(runId: string, answer: string): Promise<void> {
    Trace.line(import.meta.url, "CardDesk.taskAnswered", { runId });
    const run = await this.store.getRun(runId);
    if (!run) return;
    const open = (await this.store.cards.list(Scope.of(run.workspace_id), 50)).filter((c) => c.status === "open" && c.action.kind === "answer_task" && c.action.run_id === runId);
    for (const card of open) await this.store.cards.resolve(card.id, "answered", answer);
  }

  private async onPlan(planId: string, key: string, change: { run_id?: string; error: string }): Promise<void> {
    Trace.line(import.meta.url, "CardDesk.onPlan", { planId, key });
    if (!planId) return;
    const plan = await this.plans.get(Scope.everything, planId);
    if (plan) await this.plans.save({ ...plan, tasks: plan.tasks.map((task) => (task.key === key ? { ...task, ...change } : task)) });
  }

  private async unresolved(cardId: string, scope: Scope, kind: Card["kind"]): Promise<Card> {
    Trace.line(import.meta.url, "CardDesk.unresolved", { cardId, kind });
    const card = await this.store.cards.get(scope, cardId);
    if (!card || card.kind !== kind) throw new RunError(`no ${kind} card ${cardId}`);
    if (card.status !== "open") throw new RunError(`card ${cardId} is already ${card.status}`);
    return card;
  }
}
