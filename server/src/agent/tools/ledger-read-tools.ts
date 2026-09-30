import type { AgentTool } from "@earendil-works/pi-agent-core";

import type { Finding } from "../../domain/index.js";
import type { AgentRoster } from "../agent-roster.js";
import { READ_LEDGER_DESCRIPTION, WAIT_FOR_DESCRIPTION } from "../prompt/text/record-tools.js";
import type { RunFindings } from "../run-findings.js";
import { Trace } from "../../trace/index.js";

import { readLedgerParameters, waitForParameters } from "./parameters.js";

export const LEDGER_POLL_MS = 15_000;
export const LEDGER_WAIT_POLLS = 40;
const SHOWN_ROWS = 60;

/** Ledger rows as the agent reads them: one line each, with who wrote it. */
export class LedgerRows {
  static render(rows: readonly Finding[]): string {
    Trace.line(import.meta.url, "LedgerRows.render", { rows: rows.length });
    const shown = rows.slice(-SHOWN_ROWS).map((row) => `${row.id} [${row.agent_id}] ${row.kind}: ${JSON.stringify(row.payload)}`);
    const hidden = rows.length - shown.length;
    return [hidden > 0 ? `(${hidden} older rows not shown — narrow by agent or kind)` : "", ...shown].filter(Boolean).join("\n");
  }
}

export class ReadLedgerTool {
  constructor(private readonly findings: RunFindings) {}

  tool(): AgentTool<typeof readLedgerParameters> {
    Trace.line(import.meta.url, "ReadLedgerTool.tool");
    const findings = this.findings;
    return {
      name: "read_ledger",
      label: "Read the ledger",
      description: READ_LEDGER_DESCRIPTION,
      parameters: readLedgerParameters,
      async execute(_id, params) {
        Trace.line(import.meta.url, "ReadLedgerTool.tool.execute", { params });
        const rows = findings
          .live()
          .filter((row) => (!params.agent || row.agent_id === params.agent) && (!params.kind || row.kind === params.kind));
        const text = rows.length > 0 ? LedgerRows.render(rows) : "No live rows match.";
        return { content: [{ type: "text", text }], details: { rows: rows.length } };
      },
    };
  }
}

export class WaitForTool {
  constructor(
    private readonly findings: RunFindings,
    private readonly roster: AgentRoster,
    private readonly pollMs: number = LEDGER_POLL_MS,
  ) {}

  tool(): AgentTool<typeof waitForParameters> {
    Trace.line(import.meta.url, "WaitForTool.tool");
    const waiter = this;
    return {
      name: "wait_for",
      label: "Wait for another agent",
      description: WAIT_FOR_DESCRIPTION,
      parameters: waitForParameters,
      async execute(_id, params, signal) {
        Trace.line(import.meta.url, "WaitForTool.tool.execute", { params });
        const outcome = await waiter.poll(params.agent, params.kind, signal);
        const text =
          outcome.rows.length > 0
            ? `READY — ${params.agent} has recorded ${params.kind}:\n${LedgerRows.render(outcome.rows)}`
            : `NOT AVAILABLE — ${outcome.why}. Carry on without it and record a gap for what it blocks.`;
        return { content: [{ type: "text", text }], details: { ready: outcome.rows.length > 0, polls: outcome.polls } };
      },
    };
  }

  private async poll(agent: string, kind: string, signal?: AbortSignal): Promise<{ rows: Finding[]; polls: number; why: string }> {
    Trace.line(import.meta.url, "WaitForTool.poll", { agent, kind });
    for (let polls = 1; polls <= LEDGER_WAIT_POLLS; polls++) {
      const rows = this.findings.live().filter((row) => row.agent_id === agent && row.kind === kind);
      if (rows.length > 0) return { rows, polls, why: "" };
      if (this.roster.hasEnded(agent)) return { rows: [], polls, why: `${agent} has ended without recording ${kind}` };
      if (signal?.aborted) return { rows: [], polls, why: "the run is stopping" };
      await WaitForTool.sleep(this.pollMs, signal);
    }
    return { rows: [], polls: LEDGER_WAIT_POLLS, why: `${agent} recorded no ${kind} in ${LEDGER_WAIT_POLLS} checks` };
  }

  private static sleep(ms: number, signal?: AbortSignal): Promise<void> {
    Trace.line(import.meta.url, "WaitForTool.sleep", { ms });
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, ms);
      signal?.addEventListener("abort", () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
    });
  }
}
