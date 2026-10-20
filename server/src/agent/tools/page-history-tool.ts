import type { AgentTool } from "@earendil-works/pi-agent-core";

import type { PageArchive } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";
import type { MarketLog } from "../stages/market/market-log.js";

import { pageHistoryParameters } from "./market-tool-parameters.js";
import { ToolReply } from "./tool-reply.js";

/** A page's snapshots in the Wayback Machine, about one a month; free. read_snapshot reads one. */
export class PageHistoryTool {
  static readonly NAME = "page_history";

  constructor(
    private readonly archive: PageArchive,
    private readonly log: MarketLog,
  ) {}

  tool(): AgentTool<typeof pageHistoryParameters> {
    Trace.line(import.meta.url, "PageHistoryTool.tool");
    const self = this;
    return {
      name: PageHistoryTool.NAME,
      label: "List a page's archived snapshots",
      description: "The Wayback Machine's snapshots of a page, about one a month, each with an id and date. Free. Small brands often have none.",
      parameters: pageHistoryParameters,
      async execute(_id, params, signal) {
        Trace.line(import.meta.url, "PageHistoryTool.tool.execute", { url: params.url });
        if (!self.log.spend(PageHistoryTool.NAME)) return ToolReply.refused("You have listed enough page histories. Read the snapshots you have.");
        const snapshots = await self.archive.snapshots(params.url, signal);
        if (snapshots.length === 0) return ToolReply.text(`The Wayback Machine has no snapshots of ${params.url}.`);
        const items = snapshots.map((page) => self.log.add({ kind: "snapshot", text: "", url: page.url, brand: PageHistoryTool.host(page.url), date: `${page.timestamp.slice(0, 4)}-${page.timestamp.slice(4, 6)}-${page.timestamp.slice(6, 8)}`, days_running: null, active: null, volume: null }, "ws-"));
        return ToolReply.text([`${items.length} snapshots of ${params.url}:`, ...items.map((item) => `[${item.id}] ${item.date}`)].join("\n"), { snapshots: items.length });
      },
    };
  }

  static host(url: string): string | null {
    Trace.tick(import.meta.url, "PageHistoryTool.host");
    try {
      return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
    } catch {
      return null;
    }
  }
}
