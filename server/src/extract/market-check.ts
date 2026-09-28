import { Briefs, type StagePacket } from "../domain/index.js";
import type { PacketCheck, PacketContext } from "./check.js";
import { Names } from "./names.js";
import { Trace } from "../trace/index.js";

/** A competitor is recorded only from a market the user chose: its \`market\` must be one the brief names. */
export class MarketCheck implements PacketCheck {
  problems(packet: StagePacket, { brief }: PacketContext): string[] {
    Trace.line(import.meta.url, "MarketCheck.problems", { competitors: packet.competitors.length });
    const chosen = Briefs.markets(brief ?? {});
    if (chosen.length === 0) return [];
    const allowed = new Set(chosen.map(Names.normalise));
    const list = chosen.map((market) => `"${market}"`).join(", ");
    return packet.competitors.flatMap((row) => {
      if (!row.market.trim()) {
        return [`competitor '${row.name}' has no \`market\` — write the market of the page you read, one of ${list}`];
      }
      if (allowed.has(Names.normalise(row.market))) return [];
      return [
        `competitor '${row.name}' is from market '${row.market}', but this run covers only ${list} — ` +
          "a competitor from another market is out of scope: drop it rather than relabel it",
      ];
    });
  }
}
