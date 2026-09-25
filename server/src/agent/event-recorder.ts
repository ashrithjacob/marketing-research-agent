import type { AgentEvent } from "@earendil-works/pi-agent-core";
import type { Usage } from "@earendil-works/pi-ai";

import { Frames } from "./frames.js";
import type { LiveRuns } from "./live-runs.js";
import { TOOL_LANES } from "./tools/index.js";

interface TurnEnd {
  usage?: Usage;
  responseId?: string;
}

/** Turns one run's agent events into cockpit frames and the run's assistant text. */
export class AgentEventRecorder {
  private readonly messageText = new Map<string, string>();
  private readonly output: string[] = [];

  constructor(
    private readonly runs: LiveRuns,
    private readonly runId: string,
    private readonly onTurnEnd: (message: TurnEnd) => void,
  ) {}

  record(event: AgentEvent): void {
    switch (event.type) {
      case "message_update":
      case "message_end": {
        const message = event.message as any;
        if (message?.role !== "assistant") return;
        const text: string = (message.content ?? [])
          .filter((c: any) => c?.type === "text")
          .map((c: any) => c.text ?? "")
          .join("");
        const key = String(message.responseId ?? message.timestamp ?? this.messageText.size);
        const already = this.messageText.get(key) ?? "";
        if (text.length > already.length) {
          const delta = text.slice(already.length);
          this.messageText.set(key, text);
          if (delta) this.runs.emit(this.runId, "message.delta", { delta });
        }
        if (event.type === "message_end") {
          this.output.push(this.messageText.get(key) ?? text);
          this.messageText.delete(key);
          this.onTurnEnd(message);
          const thinking: string = (message.content ?? [])
            .filter((c: any) => c?.type === "thinking")
            .map((c: any) => c.thinking ?? c.text ?? "")
            .join("");
          if (thinking.trim()) {
            this.runs.emit(this.runId, "reasoning.available", { text: thinking });
          }
        }
        return;
      }
      case "tool_execution_start":
        this.runs.emit(this.runId, "tool.started", {
          tool: event.toolName,
          preview: Frames.toolPreview(event.toolName, event.args),
          lane: TOOL_LANES[event.toolName] ?? "other",
        });
        return;
      case "tool_execution_end":
        this.runs.emit(this.runId, "tool.completed", {
          tool: event.toolName,
          error: Boolean(event.isError),
          ...(event.isError ? { error_text: Frames.toolErrorText(event.result) } : {}),
          lane: TOOL_LANES[event.toolName] ?? "other",
        });
        return;
      default:
        return;
    }
  }

  text(): string {
    return this.output.join("");
  }
}
