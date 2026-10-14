import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { ConversationView, EntryRecord } from "@earendil-works/pi-durable";

import type { ChatMessage } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

/** The owner's chat, read off the operator conversation: only what the owner wrote and what the operator wrote back, and the answer still being written. Code's notes and tool calls stay in the transcript and are not shown; questions are cards. */
export class ChatView {
  static of(view: ConversationView): ChatMessage[] {
    Trace.line(import.meta.url, "ChatView.of", { entries: view.entries.length });
    const lines = view.entries.flatMap((entry) => ChatView.lines(entry));
    const partial = (view.docs["pi.live"] as { generation?: { message?: AssistantMessage } } | undefined)?.generation?.message;
    const writing = partial ? ChatView.text(partial) : "";
    return writing ? [...lines, { id: "live", role: "operator", text: writing, partial: true }] : lines;
  }

  private static lines(entry: EntryRecord): ChatMessage[] {
    Trace.tick(import.meta.url, "ChatView.lines", { kind: entry.kind });
    const data = (entry.data ?? {}) as { text?: string };
    const id = String(entry.id);
    if (entry.kind === "mra.owner") return [{ id, role: "owner", text: data.text ?? "", partial: false }];
    if (entry.kind !== "pi.assistant") return [];
    const message = entry.model?.[0] as AssistantMessage | undefined;
    const text = message ? ChatView.text(message) : "";
    return text ? [{ id, role: "operator", text, partial: false }] : [];
  }

  private static text(message: AssistantMessage): string {
    Trace.tick(import.meta.url, "ChatView.text");
    return message.content.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("").trim();
  }
}
