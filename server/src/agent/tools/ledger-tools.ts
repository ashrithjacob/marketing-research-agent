import type { AgentTool } from "@earendil-works/pi-agent-core";

import type { FindingKind } from "../../domain/index.js";
import { RETRACT_DESCRIPTION } from "../prompt/text/record-tools.js";
import type { RunFindings } from "../run-findings.js";
import { Trace } from "../../trace/index.js";

import { recordParameters, retractParameters } from "./parameters.js";

/** One record_* tool: the item is checked by its section's schema and appended to the run ledger, or refused with the reason. */
export class RecordTool {
  constructor(
    private readonly spec: { name: string; kind: FindingKind; description: string },
    private readonly findings: RunFindings,
  ) {}

  tool(): AgentTool<typeof recordParameters> {
    Trace.line(import.meta.url, "RecordTool.tool", { name: this.spec.name });
    const { spec, findings } = this;
    return {
      name: spec.name,
      label: spec.name.replace(/_/g, " "),
      description: spec.description,
      parameters: recordParameters,
      async execute(_id, params) {
        Trace.line(import.meta.url, "RecordTool.tool.execute", { name: spec.name });
        const result = findings.record(spec.kind, params.item, params.entity);
        if ("problems" in result) {
          return {
            content: [{ type: "text", text: `NOT RECORDED — ${result.problems}. Fix this one item and call again.` }],
            details: { recorded: false, problems: result.problems },
          };
        }
        const { recorded, replaced } = result;
        const text = `RECORDED ${recorded.id}${replaced ? ` (replaces ${replaced})` : ""}`;
        return {
          content: [{ type: "text", text }],
          details: { recorded: true, id: recorded.id, kind: recorded.kind, entity: recorded.entity, replaced },
        };
      },
    };
  }
}

export class RetractTool {
  constructor(private readonly findings: RunFindings) {}

  tool(): AgentTool<typeof retractParameters> {
    Trace.line(import.meta.url, "RetractTool.tool");
    const findings = this.findings;
    return {
      name: "retract",
      label: "Retract a record",
      description: RETRACT_DESCRIPTION,
      parameters: retractParameters,
      async execute(_id, params) {
        Trace.line(import.meta.url, "RetractTool.tool.execute", { id: params.id });
        const retracted = findings.retract(params.id, params.why);
        const text = retracted
          ? `RETRACTED ${retracted.id}`
          : `NOT RETRACTED — no live row with id ${params.id} in this run's ledger`;
        return { content: [{ type: "text", text }], details: { retracted: retracted !== null, id: params.id } };
      },
    };
  }
}
