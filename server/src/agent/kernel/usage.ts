import type { Usage } from "@earendil-works/pi-ai";

/** A turn's or a run's token counts, without the dollar figure pi-ai calculates from list prices: what a run cost is what was billed. */
export type TokenCounts = Omit<Usage, "cost">;
import { Trace } from "../../trace/index.js";

/** A turn's token counts, with pi-ai's list-price dollar figure taken out. */
export class UsageTotals {
  static tokens(usage: Partial<Usage>): TokenCounts {
    Trace.line(import.meta.url, "UsageTotals.tokens");
    const { cost: _calculated, ...tokens } = usage;
    return tokens as TokenCounts;
  }
}
