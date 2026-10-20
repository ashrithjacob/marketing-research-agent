import type { AgentTool } from "@earendil-works/pi-agent-core";

import type { PageFetcher } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";
import type { MarketLog } from "../stages/market/market-log.js";

import { readLandingParameters } from "./market-tool-parameters.js";
import { ToolReply } from "./tool-reply.js";

/** Where one of this run's ads sends people: an advertorial meets a reader who knows the problem, a product page one who knows the product. One page read, billed. */
export class ReadLandingTool {
  static readonly NAME = "read_landing";
  static readonly SHOWN_CHARS = 3000;

  constructor(
    private readonly pages: PageFetcher,
    private readonly log: MarketLog,
  ) {}

  tool(): AgentTool<typeof readLandingParameters> {
    Trace.line(import.meta.url, "ReadLandingTool.tool");
    const self = this;
    return {
      name: ReadLandingTool.NAME,
      label: "Read an ad's landing page",
      description: `The landing page of an ad from list_ads: the first ${ReadLandingTool.SHOWN_CHARS} characters, under a new id to label. One billed page read; limited.`,
      parameters: readLandingParameters,
      async execute(_id, params, signal) {
        Trace.line(import.meta.url, "ReadLandingTool.tool.execute", { adId: params.ad_id });
        const ad = self.log.item(params.ad_id);
        if (!ad || ad.kind !== "stage_ad" || !ad.url) return ToolReply.refused(`No ad ${params.ad_id} with a landing page in list_ads.`);
        if (self.log.ofKind("landing_page").some((item) => item.url === ad.url)) return ToolReply.refused(`${ad.url} is already read; use its id.`);
        if (!self.log.spend(ReadLandingTool.NAME)) return ToolReply.refused("Your landing page reads are spent.");
        const page = await self.pages.scrape(ad.url, signal);
        const text = page.text.slice(0, ReadLandingTool.SHOWN_CHARS);
        const item = self.log.add({ kind: "landing_page", text, url: ad.url, brand: ad.brand, date: null, days_running: null, active: null, volume: null }, "lp-");
        return ToolReply.external([`[${item.id}] ${ad.url}:`, text], { chars: text.length });
      },
    };
  }
}
