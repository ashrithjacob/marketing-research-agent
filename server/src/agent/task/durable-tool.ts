import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { JsonValue } from "@earendil-works/chord";
import { defineTool, type ToolRegistration } from "@earendil-works/pi-durable";

import { Trace } from "../../trace/index.js";

/** One of today's research tools as a pi-durable tool: the same name, schema and code, run under its task's trace, its result handed back in pi-durable's shape. Not replay-safe: a call a restart cut off is reported interrupted, never paid for twice. */
export class DurableTool {
  static from(tool: AgentTool<any>, runId: string): ToolRegistration {
    Trace.line(import.meta.url, "DurableTool.from", { name: tool.name, runId });
    return defineTool({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
      ...(tool.executionMode ? { executionMode: tool.executionMode } : {}),
      async execute(args, api, context) {
        Trace.line(import.meta.url, "DurableTool.from.execute", { name: tool.name, call: api.callId });
        const result = await Trace.within(runId, { tool: tool.name, call: api.callId }, () =>
          Trace.withinTool(api.callId, [], () => tool.execute(api.callId, args, context.abortSignal)),
        );
        return {
          output: result.content,
          details: (result.details ?? null) as JsonValue,
          ...(result.isError ? { isError: true } : {}),
          ...(result.terminate ? { control: { terminate: true as const } } : {}),
        };
      },
    });
  }
}
