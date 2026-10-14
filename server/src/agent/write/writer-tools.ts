import type { AgentTool } from "@earendil-works/pi-agent-core";

import { DraftText, Findings, PLAYBOOKS, type DraftBook, type Finding, type FindingLedger } from "../../domain/index.js";
import { DraftCheck } from "../../extract/index.js";
import { Trace } from "../../trace/index.js";

import type { LiveRuns } from "../live-runs.js";
import { readInputsParameters, writeSectionParameters } from "../tools/parameters.js";

/** A writer's two tools: the findings it writes from, and one section of its draft written at a time, checked as it is written. */
export class WriterTools {
  constructor(
    private readonly drafts: DraftBook,
    private readonly ledger: FindingLedger,
    private readonly runs: LiveRuns,
    private readonly run: { runId: string; workspaceId: string; playbook: string },
  ) {}

  readInputs(): AgentTool<typeof readInputsParameters> {
    Trace.line(import.meta.url, "WriterTools.readInputs");
    const self = this;
    return {
      name: "read_inputs",
      label: "Your findings",
      description: "List the findings you write from: each one's id, kind, who it is about and what it says.",
      parameters: readInputsParameters,
      async execute() {
        Trace.line(import.meta.url, "WriterTools.readInputs.execute");
        const rows = await self.rows();
        const text = rows.length ? rows.map(WriterTools.line).join("\n") : "You were given no findings.";
        return { content: [{ type: "text", text: `<findings>\n${text}\n</findings>` }], details: { rows: rows.length } };
      },
    };
  }

  writeSection(): AgentTool<typeof writeSectionParameters> {
    Trace.line(import.meta.url, "WriterTools.writeSection");
    const self = this;
    return {
      name: "write_section",
      label: "Write section",
      description: "Write or rewrite one section of the draft, by its key. The whole section's text each time.",
      parameters: writeSectionParameters,
      executionMode: "sequential",
      async execute(_id, params) {
        Trace.line(import.meta.url, "WriterTools.writeSection.execute", { section: params.section });
        return self.write(params.section, params.text);
      },
    };
  }

  private async write(key: string, text: string): Promise<{ content: { type: "text"; text: string }[]; details: Record<string, unknown> }> {
    Trace.line(import.meta.url, "WriterTools.write", { key });
    const { runId, workspaceId, playbook: name } = this.run;
    const playbook = PLAYBOOKS[name]!;
    const known = playbook.sections.map((section) => section.key);
    if (!known.includes(key)) return { content: [{ type: "text", text: `REFUSED — no section \`${key}\`; the sections are ${known.join(", ")}.` }], details: { refused: true } };
    const draft = await this.drafts.write(workspaceId, runId, name, { key, text });
    this.runs.emit(runId, "draft.section", { draft_id: draft.id, section: key, cites: DraftText.cites(text).length });
    await this.runs.written(runId);
    const single = { ...playbook, sections: playbook.sections.filter((section) => section.key === key) };
    const problems = DraftCheck.problems(single, draft, await this.rows()).map((problem) => problem.text);
    const said = problems.length ? `SAVED, with problems to fix:\n${problems.map((p) => `- ${p}`).join("\n")}` : "SAVED — the section passes its check.";
    return { content: [{ type: "text", text: said }], details: { draft_id: draft.id, problems } };
  }

  private async rows(): Promise<Finding[]> {
    Trace.line(import.meta.url, "WriterTools.rows", { runId: this.run.runId });
    return Findings.live(await this.ledger.list(this.run.runId));
  }

  static line(row: Finding): string {
    Trace.tick(import.meta.url, "WriterTools.line");
    const said = DraftText.value(row) ?? "";
    const claim = typeof row.payload.claim === "string" ? ` — ${row.payload.claim}` : "";
    return `${row.id} · ${row.kind}${row.entity ? ` · ${row.entity}` : ""} · ${said}${claim}`;
  }
}
