import type { CheckProblem, Draft, Finding, PlaybookBody } from "../domain/index.js";
import { DraftText } from "../domain/index.js";
import { Trace } from "../trace/index.js";

/** A draft is done when every section its playbook names is written, each cites at least one finding, every id it names is one of its task's findings, and no figure is typed in by hand (spec §3.1, `write`). */
export class DraftCheck {
  static problems(playbook: PlaybookBody, draft: Draft | null, rows: readonly Finding[]): CheckProblem[] {
    Trace.line(import.meta.url, "DraftCheck.problems", { playbook: playbook.key, sections: draft?.sections.length ?? 0 });
    const ids = new Set(rows.map((row) => row.id));
    const problem = (text: string): CheckProblem => ({ text, row: null });
    const found: CheckProblem[] = [];
    for (const section of playbook.sections) {
      const text = draft?.sections.find((s) => s.key === section.key)?.text.trim() ?? "";
      if (!text) {
        found.push(problem(`section \`${section.key}\` (${section.title}) is not written; write it with write_section`));
        continue;
      }
      if (DraftText.cites(text).length === 0) found.push(problem(`section \`${section.key}\` cites no finding; cite each claim as [[id]]`));
      const unknown = [...DraftText.cites(text), ...DraftText.places(text)].filter((id) => !ids.has(id));
      if (unknown.length > 0) found.push(problem(`section \`${section.key}\` names ${unknown.join(", ")}, which are not your findings; read_inputs lists them`));
      const typed = DraftText.typedFigures(text);
      if (typed.length > 0) found.push(problem(`section \`${section.key}\` types the figure(s) ${typed.join(", ")} by hand; put a figure in with {{id}} from the finding that states it, or leave it out`));
    }
    return found;
  }
}
