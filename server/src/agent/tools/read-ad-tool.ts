import type { AgentTool } from "@earendil-works/pi-agent-core";

import { Trace } from "../../trace/index.js";
import { EXTERNAL_NOTE } from "../prompt/text/external.js";
import type { ScoutLog } from "../stages/ads/scout-log.js";

import { readAdParameters } from "./tool-parameters.js";

/** The full copy of an ad the scout has already seen; free, nothing is fetched. */
export class ReadAdTool {
  constructor(private readonly log: ScoutLog) {}

  tool(): AgentTool<typeof readAdParameters> {
    Trace.line(import.meta.url, "ReadAdTool.tool");
    const log = this.log;
    return {
      name: "read_ad",
      label: "Read an ad",
      description: "The full copy of an ad you have seen in search_ads, by its id. Free.",
      parameters: readAdParameters,
      async execute(_id, params) {
        Trace.line(import.meta.url, "ReadAdTool.tool.execute", { adId: params.ad_id });
        const ad = log.ad(params.ad_id);
        const text = ad ? `[${ad.ad_id}] ${ad.advertiser} → ${ad.landing_url}\n\n${ad.body}\n\n${EXTERNAL_NOTE}` : `No ad ${params.ad_id} in your searches; copy the id exactly as search_ads gave it.`;
        return { content: [{ type: "text", text }], details: { found: Boolean(ad) } };
      },
    };
  }
}
