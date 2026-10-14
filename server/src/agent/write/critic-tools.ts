import type { AgentTool } from "@earendil-works/pi-agent-core";

import { DraftText, Findings, Scope, type DraftBook, type FindingLedger, type Verdict } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { LiveRuns } from "../live-runs.js";
import { readDraftParameters, recordVerdictParameters } from "../tools/parameters.js";

/** A critic's two tools: the draft as the owner reads it, and one verdict per criterion, saved on the draft. */
export class CriticTools {
  constructor(
    private readonly drafts: DraftBook,
    private readonly ledger: FindingLedger,
    private readonly runs: LiveRuns,
    private readonly run: { runId: string; workspaceId: string; draftId: string; criteria: readonly string[]; titles: ReadonlyMap<string, string> },
  ) {}

  readDraft(): AgentTool<typeof readDraftParameters> {
    Trace.line(import.meta.url, "CriticTools.readDraft");
    const self = this;
    return {
      name: "read_draft",
      label: "The draft",
      description: "Read the draft, section by section, with a footnote for each finding it cites.",
      parameters: readDraftParameters,
      async execute() {
        Trace.line(import.meta.url, "CriticTools.readDraft.execute");
        return { content: [{ type: "text", text: `<draft>\n${await self.rendered()}\n</draft>` }], details: {} };
      },
    };
  }

  recordVerdict(): AgentTool<typeof recordVerdictParameters> {
    Trace.line(import.meta.url, "CriticTools.recordVerdict");
    const self = this;
    return {
      name: "record_verdict",
      label: "Verdict",
      description: "Record whether the draft meets one criterion, by its number, and why.",
      parameters: recordVerdictParameters,
      executionMode: "sequential",
      async execute(_id, params) {
        Trace.line(import.meta.url, "CriticTools.recordVerdict.execute", { criterion: params.criterion });
        const criterion = self.run.criteria[Math.trunc(params.criterion) - 1];
        if (!criterion) return { content: [{ type: "text", text: `REFUSED — there are criteria 1 to ${self.run.criteria.length}.` }], details: { refused: true } };
        await self.record({ criterion, pass: params.pass, why: params.why });
        return { content: [{ type: "text", text: `RECORDED — criterion ${Math.trunc(params.criterion)}: ${params.pass ? "met" : "not met"}.` }], details: {} };
      },
    };
  }

  private async record(verdict: Verdict): Promise<void> {
    Trace.line(import.meta.url, "CriticTools.record", { pass: verdict.pass });
    const { runId, workspaceId, draftId } = this.run;
    const draft = await this.drafts.get(Scope.of(workspaceId), draftId);
    const verdicts = [...(draft?.verdicts ?? []).filter((v) => v.criterion !== verdict.criterion), verdict];
    await this.drafts.mark(draftId, "critique", verdicts);
    this.runs.emit(runId, "draft.verdict", { draft_id: draftId, pass: verdict.pass });
    await this.runs.written(runId);
  }

  private async rendered(): Promise<string> {
    Trace.line(import.meta.url, "CriticTools.rendered", { draftId: this.run.draftId });
    const draft = await this.drafts.get(Scope.of(this.run.workspaceId), this.run.draftId);
    if (!draft) return "The draft is missing.";
    const rows = Findings.live(await this.ledger.list(draft.run_id));
    const view = DraftText.view(draft, rows, this.run.titles);
    const body = view.sections.map((s) => `## ${s.title}\n\n${s.text}`).join("\n\n");
    const footnotes = view.notes.map((note, i) => `[${i + 1}] ${note.kind}: ${note.value}`).join("\n");
    return `${body}\n\n## Footnotes\n\n${footnotes}`;
  }
}
