import { DraftText, FeedbackStrengths, Findings, PLAYBOOKS, Scope, type Draft, type DraftView, type Playbook, type DraftSection, type FeedbackVerdict, type ResearchStore } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { RunError } from "../errors.js";

/** The owner's hand on a draft: an edit is a new version, recorded with what it changed; approve and reject settle it, and its card with it. Each is feedback on the draft (spec §5.2). */
export class DraftDesk {
  constructor(private readonly store: ResearchStore) {}

  /** A draft as its page shows it: the stored text, its rendered view with footnotes, and the playbook it answers to. */
  async view(draftId: string, scope: Scope): Promise<{ draft: Draft; view: DraftView; playbook: Playbook | null }> {
    Trace.line(import.meta.url, "DraftDesk.view", { draftId });
    const draft = await this.store.drafts.get(scope, draftId);
    if (!draft) throw new RunError(`no draft ${draftId}`);
    const playbook = PLAYBOOKS[draft.playbook] ?? null;
    const rows = Findings.live(await this.store.findings.list(draft.run_id));
    const view = DraftText.view(draft, rows, new Map((playbook?.sections ?? []).map((s) => [s.key, s.title])));
    return { draft, view, playbook };
  }

  async edit(draftId: string, scope: Scope, sections: readonly DraftSection[]): Promise<Draft> {
    Trace.line(import.meta.url, "DraftDesk.edit", { draftId, sections: sections.length });
    const draft = await this.open(draftId, scope);
    const before = new Map(draft.sections.map((s) => [s.key, s.text]));
    const changed = sections.filter((s) => before.has(s.key) && before.get(s.key) !== s.text);
    if (changed.length === 0) return draft;
    const merged = draft.sections.map((s) => changed.find((c) => c.key === s.key) ?? s);
    const next = await this.store.drafts.edit(draftId, merged);
    const diff = Object.fromEntries(changed.map((s) => [s.key, { before: before.get(s.key), after: s.text }]));
    await this.feedback(next, "edited", `edited ${changed.map((s) => s.key).join(", ")}`, diff);
    return next;
  }

  async approve(draftId: string, scope: Scope): Promise<Draft> {
    Trace.line(import.meta.url, "DraftDesk.approve", { draftId });
    return this.settle(await this.open(draftId, scope), "approved");
  }

  async reject(draftId: string, scope: Scope, why = ""): Promise<Draft> {
    Trace.line(import.meta.url, "DraftDesk.reject", { draftId });
    return this.settle(await this.open(draftId, scope), "rejected", why);
  }

  private async settle(draft: Draft, status: "approved" | "rejected", why = ""): Promise<Draft> {
    Trace.line(import.meta.url, "DraftDesk.settle", { draftId: draft.id, status });
    await this.store.drafts.mark(draft.id, status);
    await this.feedback(draft, status === "approved" ? "accept" : "reject", why);
    const cards = (await this.store.cards.list(Scope.of(draft.workspace_id), 100)).filter((c) => c.status === "open" && c.action.kind === "draft" && c.action.draft_id === draft.id);
    for (const card of cards) await this.store.cards.resolve(card.id, status, why);
    return { ...draft, status };
  }

  private async open(draftId: string, scope: Scope): Promise<Draft> {
    Trace.line(import.meta.url, "DraftDesk.open", { draftId });
    const draft = await this.store.drafts.get(scope, draftId);
    if (!draft) throw new RunError(`no draft ${draftId}`);
    if (draft.status === "approved" || draft.status === "rejected") throw new RunError(`draft ${draftId} is already ${draft.status}`);
    if (draft.status !== "review") throw new RunError(`draft ${draftId} is still being ${draft.status === "writing" ? "written" : "critiqued"}`);
    return draft;
  }

  private async feedback(draft: Draft, verdict: FeedbackVerdict, text: string, diff?: Record<string, unknown>): Promise<void> {
    Trace.line(import.meta.url, "DraftDesk.feedback", { draftId: draft.id, verdict });
    const target = FeedbackStrengths.target("draft", draft.id, { run_id: draft.run_id });
    await this.store.feedback.record(draft.workspace_id, { verdict, target, text, ...(diff ? { diff } : {}) });
  }
}
