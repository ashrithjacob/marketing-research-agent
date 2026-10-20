import type { AgentTool } from "@earendil-works/pi-agent-core";

import type { PageArchive } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";
import type { MarketLog } from "../stages/market/market-log.js";

import { readSnapshotParameters } from "./market-tool-parameters.js";
import { ToolReply } from "./tool-reply.js";

/** The text of one archived snapshot: the headline and mechanism a competitor led with on that date. Free. */
export class ReadSnapshotTool {
  static readonly NAME = "read_snapshot";

  constructor(
    private readonly archive: PageArchive,
    private readonly log: MarketLog,
  ) {}

  tool(): AgentTool<typeof readSnapshotParameters> {
    Trace.line(import.meta.url, "ReadSnapshotTool.tool");
    const self = this;
    return {
      name: ReadSnapshotTool.NAME,
      label: "Read an archived snapshot",
      description: "The text of a snapshot from page_history, by its id. Free; your reads are limited.",
      parameters: readSnapshotParameters,
      async execute(_id, params, signal) {
        Trace.line(import.meta.url, "ReadSnapshotTool.tool.execute", { snapshotId: params.snapshot_id });
        const item = self.log.item(params.snapshot_id);
        if (!item || item.kind !== "snapshot" || !item.url) return ToolReply.refused(`No snapshot ${params.snapshot_id}; use an id page_history gave you.`);
        if (!self.log.spend(ReadSnapshotTool.NAME)) return ToolReply.refused("Your snapshot reads are spent.");
        const text = await self.archive.read({ url: item.url, timestamp: item.date!.replace(/-/g, "") }, signal);
        self.log.add({ ...item, text }, "");
        return ToolReply.external([`[${item.id}] ${item.url} as archived on ${item.date}:`, text || "(no text)"], { chars: text.length });
      },
    };
  }
}
