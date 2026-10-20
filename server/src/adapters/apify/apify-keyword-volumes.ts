import type { ActorRunner, KeywordVolume, KeywordVolumes } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { ActorResult } from "./actor-result.js";

/** Google Ads monthly search volumes through `memo23/keyword-metrics`: $0.05 a run plus $0.25 per batch of up to 1,000 keywords (2026-10-20). Bing is a second billed batch, so it is turned off. */
export class ApifyKeywordVolumes implements KeywordVolumes {
  static readonly ACTOR = "memo23/keyword-metrics";
  static readonly LIMITS = { maxTotalChargeUsd: 1, timeoutSeconds: 600, memoryMb: 512 };

  constructor(private readonly runner: ActorRunner) {}

  async volumes(keywords: readonly string[], country: string, signal?: AbortSignal): Promise<KeywordVolume[]> {
    Trace.line(import.meta.url, "ApifyKeywordVolumes.volumes", { keywords: keywords.length, country });
    const run = await this.runner.run(ApifyKeywordVolumes.ACTOR, { mode: "metrics", keywords: [...keywords], country, includeGoogle: true, includeBing: false }, ApifyKeywordVolumes.LIMITS, signal);
    return ActorResult.items(run, ApifyKeywordVolumes.ACTOR).map((row) => ({
      keyword: String(row.keyword ?? ""),
      monthly_searches: ActorResult.number(row.google_search_volume),
      intent: typeof row.search_intent === "string" ? row.search_intent : null,
      trend: typeof row.trend === "string" ? row.trend : null,
    }));
  }
}
