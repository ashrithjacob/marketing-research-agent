import type { AgentTool } from "@earendil-works/pi-agent-core";

import { MarketReadSchema, type Competitor, type MarketRead, type Product } from "../../../domain/index.js";
import { MarketTally } from "../../../extract/index.js";
import { Trace } from "../../../trace/index.js";
import type { AgentResult } from "../../kernel/agent-runner.js";
import type { RunContext } from "../../pipeline/run-context.js";
import { MARKET_READER_SYSTEM } from "../../prompt/text/market-reader.js";

import type { MarketLog } from "./market-log.js";

/** The agent that reads the market's sophistication off its ads and labels buyer evidence by awareness; code refuses anything it cites that no tool showed it. */
export class MarketReader {
  static readonly AGENT_ID = "market_reader";
  static readonly MAX_TURNS = 50;

  async read(context: RunContext, product: Product, competitors: readonly Competitor[], tools: AgentTool<any>[], log: MarketLog, ads: number): Promise<AgentResult<MarketRead>> {
    Trace.line(import.meta.url, "MarketReader.read", { tools: tools.length, ads });
    return context.agent({
      agentId: MarketReader.AGENT_ID,
      system: MARKET_READER_SYSTEM,
      instructions: [
        `The client: ${product.brand} ${product.name}, a ${product.category || "product"} sold on ${product.key_active || "its key ingredient"}.`,
        `Confirmed competitors: ${competitors.map((c) => `${c.brand} (${c.url})`).join("; ") || "none"}.`,
        `Markets: ${context.run.input.markets.join(", ")}. This run kept ${ads} ads; list_ads shows them.`,
        `Your tools: ${tools.map((tool) => tool.name).join(", ")}.`,
      ].join("\n"),
      tools,
      maxTurns: MarketReader.MAX_TURNS,
      submission: { schema: MarketReadSchema, describe: "Hand back the claim groups, the sophistication stage and your awareness labels.", check: (read) => MarketReader.problems(read, log) },
    });
  }

  static problems(read: MarketRead, log: MarketLog): string[] {
    Trace.line(import.meta.url, "MarketReader.problems", { groups: read.claim_groups.length, labels: read.labels.length });
    const keys = read.claim_groups.map((group) => group.key);
    const problems = keys.filter((key, i) => keys.indexOf(key) !== i).map((key) => `claim group ${key} appears twice`);
    for (const group of read.claim_groups) {
      for (const id of group.ad_ids) if (!["stage_ad", "history_ad"].includes(log.item(id)?.kind ?? "")) problems.push(`claim group ${group.key} cites ${id}, which is not an ad from list_ads or search_ad_history`);
    }
    problems.push(...read.sophistication.claim_group_keys.filter((key) => !keys.includes(key)).map((key) => `the stage rests on claim group ${key}, which you did not submit`));
    for (const id of read.sophistication.snapshot_ids) if (log.item(id)?.kind !== "snapshot" || !log.item(id)?.text) problems.push(`snapshot ${id} was never read with read_snapshot`);
    const ids = read.labels.map((label) => label.id);
    problems.push(...ids.filter((id, i) => ids.indexOf(id) !== i).map((id) => `${id} is labelled twice`));
    for (const id of ids) {
      const item = log.item(id);
      if (!item) problems.push(`${id} was not shown to you by any tool; copy ids exactly`);
      else if (!MarketTally.CHANNEL[item.kind]) problems.push(`${id} is ${item.kind === "snapshot" ? "a snapshot" : "an ad"} and takes no awareness label; ads carry theirs from stage 3`);
    }
    const labelable = [...log.all.values()].some((item) => MarketTally.CHANNEL[item.kind]);
    if (labelable && ids.length === 0) problems.push("you gathered buyer evidence but labelled none of it; label what you read");
    return problems;
  }
}
