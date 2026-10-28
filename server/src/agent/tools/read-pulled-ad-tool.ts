import type { AgentTool } from "@earendil-works/pi-agent-core";

import { Trace } from "../../trace/index.js";
import type { RingLog } from "../stages/ads/ring-log.js";

import { readPulledAdParameters } from "./ad-pull-parameters.js";
import { ToolReply } from "./tool-reply.js";

/** The whole copy and landing page of an ad pull_ads already showed. Free. */
export class ReadPulledAdTool {
  static readonly NAME = "read_ad";

  constructor(private readonly log: RingLog) {}

  tool(): AgentTool<typeof readPulledAdParameters> {
    Trace.line(import.meta.url, "ReadPulledAdTool.tool");
    const { log } = this;
    return {
      name: ReadPulledAdTool.NAME,
      label: "Read a pulled ad",
      description: "The full copy and landing page of an ad pull_ads showed, by its ref. Free. Use it when the opening does not say what the ad sells or to whom.",
      parameters: readPulledAdParameters,
      async execute(_id, params) {
        Trace.line(import.meta.url, "ReadPulledAdTool.tool.execute", { ref: params.ref });
        const hit = log.hit(params.ref);
        if (!hit) return ToolReply.refused(`No ad ${params.ref}; use a ref pull_ads showed you.`);
        return ToolReply.external([`[${params.ref}] ${hit.advertiser}, lands on ${hit.landing_url || hit.landing_domain || "no landing page"}`, hit.body], { chars: hit.body.length });
      },
    };
  }
}
