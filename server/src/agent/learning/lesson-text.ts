import type { LessonChange, MemoryEntry } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

/** What a lesson's card says, and the words two lessons are compared by when the owner already rejected one. */
export class LessonText {
  static title(change: LessonChange): string {
    Trace.line(import.meta.url, "LessonText.title", { kind: change.kind });
    if (change.kind === "memory_add") return "Learn this about the brand?";
    if (change.kind === "memory_change") return "Change what we know about the brand?";
    if (change.kind === "memory_remove") return "Forget this about the brand?";
    if (change.kind === "playbook_change") return `Change the playbook "${change.playbook.title}"?`;
    return `Add the playbook "${change.playbook.title}"?`;
  }

  static body(change: LessonChange, entries: readonly MemoryEntry[]): string {
    Trace.line(import.meta.url, "LessonText.body", { kind: change.kind });
    if ("text" in change) return change.text;
    if (change.kind === "memory_remove") return entries.find((e) => e.entry_id === change.entry_id)?.text ?? "";
    const { playbook } = change;
    const sections = playbook.sections.map((s) => `- ${s.title}: ${s.describe}`).join("\n");
    const criteria = playbook.criteria.map((c, i) => `${i + 1}. ${c}`).join("\n");
    const from = change.kind === "playbook_change" ? `A new version after version ${change.from_version}.\n\n` : "";
    return `${from}Sections:\n${sections}\n\nThe critic checks:\n${criteria}`;
  }

  /** A lesson's substance, normalised, so the same lesson worded again is recognised. */
  static said(change: LessonChange): string {
    Trace.line(import.meta.url, "LessonText.said", { kind: change.kind });
    const words = "text" in change ? change.text : "playbook" in change ? JSON.stringify([change.playbook.key, change.playbook.sections, change.playbook.criteria]) : "";
    return words.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }
}
