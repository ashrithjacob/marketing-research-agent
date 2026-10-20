import type { AgentTool } from "@earendil-works/pi-agent-core";

import type { ReadAd } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";
import type { MarketLog } from "../stages/market/market-log.js";

import { listAdsParameters } from "./market-tool-parameters.js";
import { ToolReply } from "./tool-reply.js";

/** This run's long-form statics as stage 3 read them: brand, ring, claim, mechanism, opening awareness, dates. Free; the raw material of the claim census. */
export class ListAdsTool {
  constructor(
    private readonly ads: readonly ReadAd[],
    private readonly log: MarketLog,
  ) {}

  tool(): AgentTool<typeof listAdsParameters> {
    Trace.line(import.meta.url, "ListAdsTool.tool", { ads: this.ads.length });
    const { ads } = this;
    return {
      name: "list_ads",
      label: "List this run's ads",
      description: "Every long-form static stage 3 kept and read: id, brand, ring, claim type, mechanism, the awareness its opening assumes, first seen, days running, whether it is still running, and its opening. Free.",
      parameters: listAdsParameters,
      async execute() {
        Trace.line(import.meta.url, "ListAdsTool.tool.execute", { ads: ads.length });
        if (ads.length === 0) return ToolReply.text("Stage 3 kept no ads for this run.");
        return ToolReply.external([`${ads.length} ads.`, ...ads.map(ListAdsTool.row)], { ads: ads.length });
      },
    };
  }

  static row(ad: ReadAd): string {
    Trace.tick(import.meta.url, "ListAdsTool.row");
    const reading = ad.reading;
    return `[${ad.id}] ${ad.landing_domain || ad.advertiser} | ${ad.ring ?? "competitor"} | ${reading?.claim_type ?? "unread"}${reading?.mechanism ? `, mechanism: ${reading.mechanism}` : ""} | opens ${reading?.awareness ?? "?"} | first seen ${ad.first_seen ?? "?"}, ${ad.days_running ?? "?"} days, ${ad.status}\n   "${ToolReply.clip(ad.copy, 160)}"`;
  }
}
