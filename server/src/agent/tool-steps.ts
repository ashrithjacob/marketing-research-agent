import { Trace, type TraceStep } from "../trace/index.js";

/** The trace lines each tool call wrote, held from when it starts until its end event reports them. */
export class ToolSteps {
  private readonly open = new Map<string, TraceStep[]>();

  start(toolCallId: string): TraceStep[] {
    Trace.line(import.meta.url, "ToolSteps.start", { toolCallId });
    const steps: TraceStep[] = [];
    this.open.set(toolCallId, steps);
    return steps;
  }

  take(toolCallId: string): TraceStep[] {
    Trace.line(import.meta.url, "ToolSteps.take", { toolCallId });
    const steps = this.open.get(toolCallId) ?? [];
    this.open.delete(toolCallId);
    return steps;
  }
}
