import type { ToolName } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

const PAID: ReadonlySet<string> = new Set<ToolName>(["web_search", "web_fetch", "evidence_search", "evidence_fetch", "discover_competitors", "ad_library_search", "amazon_find_product"]);
const APIFY: ReadonlySet<string> = new Set<ToolName>(["amazon_find_product"]);

/** The mra.money rule (spec §7.4), decided in code before a tool runs: an Apify call only in a task the owner approved, and no paid call once the daily cap is reached. */
export class MoneyGate {
  static block(tool: string, approved: boolean, overCap: string | null): string | null {
    Trace.line(import.meta.url, "MoneyGate.block", { tool, approved, overCap: overCap !== null });
    if (APIFY.has(tool) && !approved) return `${tool} spends Apify money, and the owner has not approved this task; it is blocked`;
    if (PAID.has(tool) && overCap) return `${tool} costs money and ${overCap}; it is blocked until tomorrow or a higher cap`;
    return null;
  }

  static paid(tool: string): boolean {
    Trace.line(import.meta.url, "MoneyGate.paid", { tool });
    return PAID.has(tool);
  }
}
