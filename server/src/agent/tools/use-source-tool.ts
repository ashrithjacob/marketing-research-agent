import type { AgentTool } from "@earendil-works/pi-agent-core";

import type { Node, Source } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { RunFindings } from "../run-findings.js";

import { useSourceParameters } from "./parameters.js";

/** A source an earlier stage read, brought into this run by its id so a row can cite it: code copies the source under the calling agent and its node, since each agent's part of the packet must hold what its rows cite; the agent only names it (spec-always-on §6.8). */
export class UseSourceTool {
  constructor(
    private readonly findings: RunFindings,
    private readonly earlier: readonly Source[],
    private readonly node: Node,
  ) {}

  tool(): AgentTool<typeof useSourceParameters> {
    Trace.line(import.meta.url, "UseSourceTool.tool", { earlier: this.earlier.length });
    const self = this;
    return {
      name: "use_source",
      label: "Use an earlier source",
      description: "Bring a source the earlier stages read into this run by its id, so the rows you record can cite it as their source_id. It reads nothing and costs nothing.",
      parameters: useSourceParameters,
      async execute(_id, params) {
        Trace.line(import.meta.url, "UseSourceTool.tool.execute", { params });
        const text = await self.use(params.source_id.trim());
        return { content: [{ type: "text", text }], details: { source_id: params.source_id } };
      },
    };
  }

  private async use(sourceId: string): Promise<string> {
    Trace.line(import.meta.url, "UseSourceTool.use", { sourceId });
    if ((await this.findings.own()).some((row) => row.kind === "source" && row.payload.id === sourceId)) return `${sourceId} is already yours in this run; cite it.`;
    const source = this.earlier.find((s) => s.id === sourceId);
    if (!source) return `No earlier source ${sourceId}. Use an id from the earlier stages listed in your instructions, or read the page yourself.`;
    const recorded = await this.findings.record("source", { ...source, node: this.node });
    if ("problems" in recorded) return `Could not bring ${sourceId} in: ${recorded.problems}`;
    return `${sourceId} (${source.title || source.url}) is in this run; cite it as source_id.`;
  }
}
