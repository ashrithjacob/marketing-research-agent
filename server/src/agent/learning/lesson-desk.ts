import { FeedbackStrengths, Scope, type Lesson, type LessonChange, type ResearchStore } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { RunError } from "../errors.js";

import { LessonChecks } from "./lesson-checks.js";
import { LessonText } from "./lesson-text.js";

/** Lessons from staging to the owner's decision (spec §5.3–5.4): code refuses one without grounds or one the owner already rejected; each becomes an approval card; approving writes a new memory or playbook version, rejecting is itself feedback. */
export class LessonDesk {
  constructor(private readonly store: ResearchStore) {}

  async stage(workspaceId: string, change: LessonChange, why: string, feedbackIds: readonly string[]): Promise<Lesson> {
    Trace.line(import.meta.url, "LessonDesk.stage", { workspaceId, kind: change.kind, feedback: feedbackIds.length });
    const scope = Scope.of(workspaceId);
    const problems = await new LessonChecks(this.store).problems(workspaceId, change, feedbackIds);
    if (problems.length > 0) throw new RunError(problems[0]!);
    const said = LessonText.said(change);
    const rejected = (await this.store.lessons.list(scope, 500)).filter((l) => l.status === "rejected" && l.change);
    if (said && rejected.some((l) => LessonText.said(l.change!) === said)) throw new RunError("the owner already rejected this lesson; do not propose it again");
    const lesson = await this.store.lessons.stage(workspaceId, { change, why, feedback_ids: [...feedbackIds], status: "staged" });
    const entries = await this.store.memory.current(scope);
    const card = await this.store.cards.create(workspaceId, { kind: "approval", title: LessonText.title(change), body: `${LessonText.body(change, entries)}\n\nWhy: ${why}`, action: { kind: "lesson", lesson_id: lesson.id, editable: "text" in change } });
    await this.store.lessons.attach(lesson.id, card.id);
    return lesson;
  }

  /** Records that a review found nothing to learn from this feedback, so it is not reviewed again. */
  nothing(workspaceId: string, feedbackIds: readonly string[], why: string): Promise<Lesson> {
    Trace.line(import.meta.url, "LessonDesk.nothing", { workspaceId, feedback: feedbackIds.length });
    return this.store.lessons.stage(workspaceId, { change: null, why, feedback_ids: [...feedbackIds], status: "nothing" });
  }

  /** The owner's decision on a lesson's card; `text` is the owner's edit of a memory lesson's words, when they changed it. */
  async decide(lessonId: string, approved: boolean, text: string): Promise<void> {
    Trace.line(import.meta.url, "LessonDesk.decide", { lessonId, approved });
    const lesson = await this.store.lessons.get(Scope.everything, lessonId);
    if (!lesson?.change) throw new RunError(`no lesson ${lessonId}`);
    const change = text && "text" in lesson.change ? { ...lesson.change, text } : lesson.change;
    if (!(await this.store.lessons.resolve(lessonId, approved ? "approved" : "rejected", change))) throw new RunError(`lesson ${lessonId} is already decided`);
    if (approved) await this.apply(lesson.workspace_id, lessonId, change);
    if (!approved) await this.store.feedback.record(lesson.workspace_id, { verdict: "reject", target: FeedbackStrengths.target("lesson", lessonId), text: "" });
  }

  private async apply(workspaceId: string, lessonId: string, change: LessonChange): Promise<void> {
    Trace.line(import.meta.url, "LessonDesk.apply", { lessonId, kind: change.kind });
    const memory = this.store.memory;
    if (change.kind === "playbook_change" || change.kind === "playbook_new") await this.store.playbooks.add(workspaceId, change.playbook, "lesson", lessonId);
    if (change.kind === "memory_add") await memory.write(workspaceId, { text: change.text, by: "lesson", lesson_id: lessonId });
    if (change.kind === "memory_change") await memory.write(workspaceId, { entry_id: change.entry_id, text: change.text, by: "lesson", lesson_id: lessonId });
    if (change.kind === "memory_remove") {
      const entry = (await memory.current(Scope.of(workspaceId))).find((e) => e.entry_id === change.entry_id);
      if (entry) await memory.write(workspaceId, { entry_id: change.entry_id, text: entry.text, by: "lesson", lesson_id: lessonId, deleted: true });
    }
  }
}
