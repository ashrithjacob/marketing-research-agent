import { Trace } from "../trace/index.js";

/** Turns a record tool's `item` — an object, or the JSON string some models send — into a draft, or says it cannot. */
export class PacketDraft {
  /** The packet arrives as an object or as its JSON in one string; either is the packet. */
  static coerce(
    raw: unknown,
  ): { draft: Record<string, unknown> } | { unparseable: true } {
    Trace.line(import.meta.url, "PacketDraft.coerce", { raw });
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      return { draft: raw as Record<string, unknown> };
    }
    if (typeof raw === "string") {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return { draft: parsed as Record<string, unknown> };
        }
      } catch {
        return { unparseable: true };
      }
    }
    return { unparseable: true };
  }
}
