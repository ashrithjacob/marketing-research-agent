import type { AgentTool } from "@earendil-works/pi-agent-core";

import type { ToolSteps } from "../tool-steps.js";
import { Trace } from "../../trace/index.js";

/** Runs a tool inside its own trace scope, so every line and request it makes is kept against its call. */
export class TracedTool {
  static wrap(tool: AgentTool<any>, steps: ToolSteps): AgentTool<any> {
    Trace.line(import.meta.url, "TracedTool.wrap", { name: tool.name });
    return {
      ...tool,
      async execute(toolCallId, params, signal, onUpdate) {
        Trace.line(import.meta.url, "TracedTool.wrap.execute", { toolCallId });
        return Trace.withinTool(toolCallId, steps.start(toolCallId), () =>
          tool.execute(toolCallId, params, signal, onUpdate),
        );
      },
    };
  }
}
