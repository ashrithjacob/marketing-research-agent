import { Findings, Scope, type Feedback, type ResearchStore } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { PlaybookShelf } from "./playbook-shelf.js";

/** The case a reviewer reads, written by code from the store: each piece of feedback with what it was about, the brand's memory now, what the owner removed, and the lessons the owner rejected. */
export class ReviewCase {
  constructor(private readonly store: ResearchStore) {}

  async write(workspaceId: string, feedback: readonly Feedback[]): Promise<string> {
    Trace.line(import.meta.url, "ReviewCase.write", { workspaceId, feedback: feedback.length });
    const scope = Scope.of(workspaceId);
    const lines = [];
    for (const each of feedback) lines.push(`- [${each.id}] ${each.verdict} (${each.strength}) about ${await this.about(each)}${each.text ? `. The owner's words: "${each.text}"` : ""}${each.diff ? `. Change: ${JSON.stringify(each.diff)}` : ""}`);
    const memory = await this.store.memory.current(scope);
    const removed = (await this.store.memory.history(scope, 200)).filter((entry) => entry.deleted);
    const rejected = (await this.store.lessons.list(scope, 200)).filter((lesson) => lesson.status === "rejected" && lesson.change && "text" in lesson.change);
    const playbooks = await this.playbooks(workspaceId, feedback);
    return [
      "## New feedback from the owner",
      ...lines,
      "",
      "## Brand memory now",
      ...(memory.length > 0 ? memory.map((entry) => `- [${entry.entry_id}] ${entry.text}`) : ["- (empty)"]),
      "",
      "## Removed from memory by the owner, never to propose again",
      ...(removed.length > 0 ? removed.map((entry) => `- ${entry.text}`) : ["- (none)"]),
      "",
      "## Lessons the owner rejected, never to propose again",
      ...(rejected.length > 0 ? rejected.map((lesson) => `- ${(lesson.change as { text: string }).text}`) : ["- (none)"]),
      ...playbooks,
    ].join("\n");
  }

  /** The playbooks drafts in this feedback were written with, as they are now, for a change to be proposed against. */
  private async playbooks(workspaceId: string, feedback: readonly Feedback[]): Promise<string[]> {
    Trace.line(import.meta.url, "ReviewCase.playbooks", { workspaceId });
    const keys = new Set<string>();
    for (const each of feedback.filter((f) => f.target.kind === "draft")) {
      const draft = await this.store.drafts.get(Scope.everything, each.target.id);
      if (draft) keys.add(draft.playbook);
    }
    const lines: string[] = [];
    for (const key of keys) {
      const playbook = await new PlaybookShelf(this.store).current(workspaceId, key);
      if (!playbook) continue;
      lines.push("", `## Playbook ${key}, version ${playbook.version} now`, "Sections:", ...playbook.sections.map((s) => `- ${s.key} — ${s.title}: ${s.describe}`), "Criteria:", ...playbook.criteria.map((c, i) => `${i + 1}. ${c}`));
    }
    return lines;
  }

  private async about(feedback: Feedback): Promise<string> {
    Trace.line(import.meta.url, "ReviewCase.about", { kind: feedback.target.kind });
    const { target } = feedback;
    if (target.kind === "source") {
      const source = Findings.live(await this.store.findings.list(target.run_id)).find((row) => row.kind === "source" && row.payload.id === target.id);
      return `a source a task used: ${String(source?.payload.url ?? target.id)}${source?.payload.title ? ` ("${String(source.payload.title)}")` : ""}`;
    }
    if (target.kind === "card") {
      const card = await this.store.cards.get(Scope.everything, target.id);
      return card ? `the question "${card.body}"` : "a card";
    }
    if (target.kind === "task") return `a running task: ${String((await this.store.getRun(target.run_id))?.contract?.objective ?? target.run_id)}`;
    if (target.kind === "memory") return "an entry of brand memory";
    if (target.kind === "draft") {
      const draft = await this.store.drafts.get(Scope.everything, target.id);
      return draft ? `a draft written with playbook ${draft.playbook} version ${draft.playbook_version}` : "a draft";
    }
    if (target.kind === "contract") return target.id === target.plan_id ? "a plan before it was approved" : `the planned task ${target.id}`;
    return target.kind;
  }
}
