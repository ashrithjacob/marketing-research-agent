import { AdReadingsSchema, type AdReadings, type StoredAd } from "../../../domain/index.js";
import { Trace } from "../../../trace/index.js";
import type { AgentResult } from "../../kernel/agent-runner.js";
import type { RunContext } from "../../pipeline/run-context.js";
import { AD_READER_SYSTEM } from "../../prompt/text/ad-reader.js";

/** Reads one batch of ads: what each targets and claims, and a judged bucket with its reason. Code checks that every ad in the batch is read exactly once. */
export class AdReader {
  static readonly MAX_TURNS = 4;

  async read(context: RunContext, batch: readonly StoredAd[], number: number): Promise<AgentResult<AdReadings>> {
    Trace.line(import.meta.url, "AdReader.read", { size: batch.length, number });
    const ids = batch.map((ad) => ad.id);
    return context.agent({
      agentId: `ad_reader:${number}`,
      system: AD_READER_SYSTEM,
      instructions: batch.map(AdReader.describe).join("\n\n"),
      tools: [],
      maxTurns: AdReader.MAX_TURNS,
      submission: { schema: AdReadingsSchema, describe: "Hand back one reading per ad.", check: (readings) => AdReader.problems(readings, ids) },
    });
  }

  static problems(readings: AdReadings, ids: readonly string[]): string[] {
    Trace.line(import.meta.url, "AdReader.problems", { given: ids.length, read: readings.ads.length });
    const read = readings.ads.map((reading) => reading.ad_id);
    const problems = ids.filter((id) => !read.includes(id)).map((id) => `ad ${id} was given but not read`);
    problems.push(...read.filter((id) => !ids.includes(id)).map((id) => `ad ${id} was not given; copy each id exactly`));
    problems.push(...read.filter((id, i) => read.indexOf(id) !== i).map((id) => `ad ${id} is read twice`));
    return problems;
  }

  private static describe(ad: StoredAd): string {
    Trace.tick(import.meta.url, "AdReader.describe");
    const delta = ad.reach_delta ? `reach growth ${ad.reach_delta.d7 ?? "?"} in 7 days, ${ad.reach_delta.d30 ?? "?"} in 30 days` : "reach growth unknown";
    return [
      `<ad id="${ad.id}">`,
      `advertiser: ${ad.advertiser}; lands on ${ad.landing_domain}; status ${ad.status}`,
      `first seen ${ad.first_seen ?? "?"}, last seen ${ad.last_seen ?? "still running"}, ${ad.days_running ?? "?"} days running, ${ad.duplicates ?? "?"} duplicates, reach ${ad.reach ?? "?"}, ${delta}, rank ${ad.ad_rank ?? "?"}`,
      ad.copy,
      "</ad>",
    ].join("\n");
  }
}
