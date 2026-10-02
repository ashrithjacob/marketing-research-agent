import type { Usage } from "@earendil-works/pi-ai";

/** A turn's or a run's token counts, without the dollar figure pi-ai calculates from list prices: what a run cost is what was billed. */
export type TokenCounts = Omit<Usage, "cost">;
import { Trace } from "../trace/index.js";

/** Per-turn usage summed across a run; pi-ai reports each turn separately. */
export class UsageTotals {
  static empty(): Usage {
    Trace.line(import.meta.url, "UsageTotals.empty");
    return {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      reasoning: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    };
  }

  static tokens(usage: Partial<Usage>): TokenCounts {
    Trace.line(import.meta.url, "UsageTotals.tokens");
    const { cost: _calculated, ...tokens } = usage;
    return tokens as TokenCounts;
  }

  static add(total: Usage, next: Usage | undefined): Usage {
    Trace.line(import.meta.url, "UsageTotals.add", { total, next });
    if (!next) return total;
    return {
      input: total.input + (next.input ?? 0),
      output: total.output + (next.output ?? 0),
      cacheRead: total.cacheRead + (next.cacheRead ?? 0),
      cacheWrite: total.cacheWrite + (next.cacheWrite ?? 0),
      reasoning: (total.reasoning ?? 0) + (next.reasoning ?? 0),
      totalTokens: total.totalTokens + (next.totalTokens ?? 0),
      cost: {
        input: total.cost.input + (next.cost?.input ?? 0),
        output: total.cost.output + (next.cost?.output ?? 0),
        cacheRead: total.cost.cacheRead + (next.cost?.cacheRead ?? 0),
        cacheWrite: total.cost.cacheWrite + (next.cost?.cacheWrite ?? 0),
        total: total.cost.total + (next.cost?.total ?? 0),
      },
    };
  }
}
