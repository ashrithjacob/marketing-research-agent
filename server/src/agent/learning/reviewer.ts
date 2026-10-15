import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { configure, defineDoc, type ConversationId, type Extension } from "@earendil-works/pi-durable";

import { Scope, type Feedback, type ResearchStore } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { WorkspaceDoc } from "../operator/operator-docs.js";
import type { PiHarness } from "../pi-harness.js";

import type { LessonDesk } from "./lesson-desk.js";
import { ReviewCase } from "./review-case.js";
import { ReviewerTools } from "./reviewer-tools.js";

const ReviewerIndex = defineDoc<{ workspaces: Record<string, ConversationId> }>({ kind: "mra.reviewers", version: 1, scope: "session", initial: () => ({ workspaces: {} }) });

/** The reviewer (spec §5.3): every few seconds, each workspace's new corrections, answers, steers and chat messages go to its reviewer conversation, which may only propose lessons. Feedback counts as reviewed once a lesson, or a recorded "nothing to learn", names it. */
export class Reviewer {
  static readonly SWEEP_MS = 15_000;
  static readonly REVIEWED: ReadonlySet<Feedback["verdict"]> = new Set(["reject", "edited", "steer", "answer", "said"]);
  private readonly busy = new Set<string>();
  private timer: ReturnType<typeof setInterval> | null = null;
  readonly extension: Extension;

  constructor(
    private readonly store: ResearchStore,
    private readonly harness: PiHarness,
    private readonly lessons: LessonDesk,
    private readonly model: string,
  ) {
    Trace.line(import.meta.url, "Reviewer.constructor", { model });
    this.extension = this.build();
    harness.registry.install(this.extension);
  }

  start(): void {
    Trace.line(import.meta.url, "Reviewer.start");
    this.timer = setInterval(() => void this.sweep().catch((error: unknown) => console.error("reviewer sweep failed", error)), Reviewer.SWEEP_MS);
  }

  stop(): void {
    Trace.line(import.meta.url, "Reviewer.stop");
    if (this.timer) clearInterval(this.timer);
  }

  /** Reviews each workspace's unreviewed feedback; returns how many workspaces it started a review for. */
  async sweep(): Promise<number> {
    Trace.line(import.meta.url, "Reviewer.sweep");
    const fresh = await this.unreviewed();
    const byWorkspace = new Map<string, Feedback[]>();
    for (const each of fresh) byWorkspace.set(each.workspace_id, [...(byWorkspace.get(each.workspace_id) ?? []), each]);
    const started = [...byWorkspace].filter(([workspace]) => !this.busy.has(workspace));
    await Promise.all(started.map(([workspace, feedback]) => this.review(workspace, feedback)));
    return started.length;
  }

  private async review(workspaceId: string, feedback: Feedback[]): Promise<void> {
    Trace.line(import.meta.url, "Reviewer.review", { workspaceId, feedback: feedback.length });
    this.busy.add(workspaceId);
    try {
      const ids = feedback.map((f) => f.id).sort();
      const content = await new ReviewCase(this.store).write(workspaceId, feedback);
      const conversation = await this.conversation(workspaceId);
      const submission = await conversation.submit({ type: "input", content, requestId: `review:${ids.join(",")}` }, BACKGROUND_CONTEXT);
      await submission.wait(BACKGROUND_CONTEXT);
      const covered = new Set((await this.store.lessons.list(Scope.of(workspaceId), 500)).flatMap((l) => l.feedback_ids));
      const left = ids.filter((id) => !covered.has(id));
      if (left.length > 0) await this.lessons.nothing(workspaceId, left, "the reviewer proposed no lesson from it");
    } finally {
      this.busy.delete(workspaceId);
    }
  }

  private async unreviewed(): Promise<Feedback[]> {
    Trace.line(import.meta.url, "Reviewer.unreviewed");
    const reviewed = new Set((await this.store.lessons.list(Scope.everything, 2000)).flatMap((l) => l.feedback_ids));
    const week = new Date(Date.now() - 7 * 86_400_000).toISOString();
    return (await this.store.feedback.list(Scope.everything, 500)).filter((f) => Reviewer.REVIEWED.has(f.verdict) && f.target.kind !== "lesson" && f.created_at > week && !reviewed.has(f.id));
  }

  private async conversation(workspaceId: string) {
    Trace.line(import.meta.url, "Reviewer.conversation", { workspaceId });
    const root = await this.harness.session.root(BACKGROUND_CONTEXT);
    const { extension } = this;
    const model = { provider: "openrouter", modelId: this.model };
    const id: ConversationId = await root.commit(async (tx) => {
      const index = await tx.doc(ReviewerIndex);
      const known = index.workspaces[workspaceId];
      if (known !== undefined) return known;
      const created = await tx.createConversation({ ownership: { kind: "ownerless" } });
      await configure(tx, created.id, { model, extensions: [extension] });
      (await tx.doc(WorkspaceDoc, created.id)).workspace_id = workspaceId;
      index.workspaces[workspaceId] = created.id;
      return created.id;
    }, BACKGROUND_CONTEXT);
    return (await this.harness.session.conversation(id, BACKGROUND_CONTEXT))!;
  }

  private build(): Extension {
    Trace.line(import.meta.url, "Reviewer.build");
    return new ReviewerTools(this.store, this.lessons).extension();
  }
}
