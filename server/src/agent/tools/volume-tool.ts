import type { AgentTool } from "@earendil-works/pi-agent-core";

import type { KeywordVolumes } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";
import type { MarketLog } from "../stages/market/market-log.js";

import { volumeParameters } from "./market-tool-parameters.js";
import { ToolReply } from "./tool-reply.js";

/** Monthly Google searches for the queries the reader collected, so a large query outweighs many small ones; about $0.30 a call through Apify. */
export class VolumeTool {
  static readonly NAME = "search_volume";

  constructor(
    private readonly volumes: KeywordVolumes,
    private readonly country: string | null,
    private readonly log: MarketLog,
  ) {}

  tool(): AgentTool<typeof volumeParameters> {
    Trace.line(import.meta.url, "VolumeTool.tool");
    const self = this;
    return {
      name: VolumeTool.NAME,
      label: "Monthly search volume",
      description: "Monthly Google searches for Google queries you collected with search_suggestions, by their ids, in one call (up to 1,000). Paid (about $0.30 a call) and limited: collect your queries first, then call it once.",
      parameters: volumeParameters,
      async execute(_id, params, signal) {
        Trace.line(import.meta.url, "VolumeTool.tool.execute", { queries: params.query_ids.length });
        if (!self.country) return ToolReply.refused("Search volume is not available for this run's market.");
        const items = params.query_ids.map((id) => self.log.item(id)).filter((item) => item?.kind === "google_query");
        if (items.length === 0) return ToolReply.refused("None of those ids is a Google query from search_suggestions.");
        if (!self.log.spend(VolumeTool.NAME)) return ToolReply.refused("Your search volume calls are spent.");
        const found = new Map((await self.volumes.volumes(items.map((item) => item!.text), self.country, signal)).map((row) => [row.keyword.toLowerCase(), row]));
        const lines = items.map((item) => {
          const row = found.get(item!.text.toLowerCase());
          self.log.add({ ...item!, volume: row?.monthly_searches ?? null }, "");
          return `[${item!.id}] ${item!.text}: ${row?.monthly_searches ?? "no data"} a month${row?.intent ? `, ${row.intent}` : ""}${row?.trend ? `, ${row.trend}` : ""}`;
        });
        return ToolReply.text(lines.join("\n"), { looked_up: items.length });
      },
    };
  }
}
