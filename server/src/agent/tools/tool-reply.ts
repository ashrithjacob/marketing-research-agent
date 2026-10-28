import type { AgentToolResult } from "@earendil-works/pi-agent-core";

import { Trace } from "../../trace/index.js";
import { EXTERNAL_NOTE } from "../prompt/text/external.js";

/** A tool's answer to the agent: plain text, with the open-web note when the text came from outside. */
export class ToolReply {
  static text(text: string, details: Record<string, unknown> = {}): AgentToolResult<Record<string, unknown>> {
    Trace.line(import.meta.url, "ToolReply.text", { chars: text.length });
    return { content: [{ type: "text", text }], details };
  }

  static external(lines: readonly string[], details: Record<string, unknown> = {}): AgentToolResult<Record<string, unknown>> {
    Trace.line(import.meta.url, "ToolReply.external", { lines: lines.length });
    return ToolReply.text([...lines, EXTERNAL_NOTE].join("\n\n"), details);
  }

  static refused(text: string): AgentToolResult<Record<string, unknown>> {
    Trace.line(import.meta.url, "ToolReply.refused");
    return ToolReply.text(text, { refused: true });
  }

  static clip(text: string, chars: number): string {
    Trace.tick(import.meta.url, "ToolReply.clip");
    const flat = [...text.replace(/\s+/g, " ").trim()];
    return flat.length > chars ? `${flat.slice(0, chars).join("")}…` : flat.join("");
  }
}
