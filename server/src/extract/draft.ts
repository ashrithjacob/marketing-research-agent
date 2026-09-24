/** Turns a validate_packet argument into a draft packet, or says it cannot. */
export class PacketDraft {
  /** The packet arrives as an object or as its JSON in one string; either is the packet. */
  static coerce(
    raw: unknown,
  ): { draft: Record<string, unknown> } | { unparseable: true } {
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
