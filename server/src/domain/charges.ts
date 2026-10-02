import { Trace } from "../trace/index.js";

export const COST_SERVICES = ["openrouter", "apify", "parallel", "trendtrack", "firecrawl", "crawl4ai"] as const;
export type CostService = (typeof COST_SERVICES)[number];

/** `billed`: the service charged this; `listed`: units times its price list; `credits`: a plan allowance, valued at its price per credit. */
export type ChargeBasis = "billed" | "listed" | "credits";

/** One thing a run paid for, as the call that caused it reported it; `usd` is null where the unit has no known price. */
export interface ChargeDraft {
  service: CostService;
  item: string;
  units: number;
  usd: number | null;
  basis: ChargeBasis;
}

/** A charge as stored: the run, and the agent whose tool caused it, or null when code with no agent spent it. */
export interface Charge extends ChargeDraft {
  run_id: string;
  agent_id: string | null;
  created_at: string;
}

/** Where a paid call reports what it cost, bound to one run and one agent. */
export interface ChargeMeter {
  charge(draft: ChargeDraft): void;
}

/** A meter for code that spends nothing, or whose spend nobody reads. */
export class NoCharges implements ChargeMeter {
  charge(draft: ChargeDraft): void {
    Trace.line(import.meta.url, "NoCharges.charge", { service: draft.service });
  }
}

/** What a service reported a call used, before it is priced. */
export interface ServiceUse {
  item: string;
  units: number;
}
