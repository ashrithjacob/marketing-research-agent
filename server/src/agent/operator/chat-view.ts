import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { ConversationView, EntryRecord } from "@earendil-works/pi-durable";

import type { ChatMessage } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

/** The owner's chat, read off the operator conversation: the owner's messages, the operator's answers and what it did, the notes code wrote, and the answer still being written. */
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
    if (entry.kind === "mra.note") return [{ id, role: "note", text: data.text ?? "", partial: false }];
    if (entry.kind !== "pi.assistant") return [];
    const message = entry.model?.[0] as AssistantMessage | undefined;
    if (!message) return [];
    const actions = message.content.flatMap((part, i) =>
      part.type === "toolCall" ? [{ id: `${id}.${i}`, role: "action" as const, text: ChatView.action(part.name, part.arguments), partial: false }] : [],
    );
    const text = ChatView.text(message);
    return [...(text ? [{ id, role: "operator" as const, text, partial: false }] : []), ...actions];
  }

  private static text(message: AssistantMessage): string {
    Trace.tick(import.meta.url, "ChatView.text");
    return message.content.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("").trim();
  }

  private static action(name: string, args: Record<string, unknown>): string {
    Trace.tick(import.meta.url, "ChatView.action", { name });
    const shown = Object.entries(args).filter(([key]) => key !== "text").map(([key, value]) => `${key}: ${JSON.stringify(value)}`);
    return `${name}${shown.length > 0 ? ` (${shown.join(", ")})` : ""}`;
  }
}
