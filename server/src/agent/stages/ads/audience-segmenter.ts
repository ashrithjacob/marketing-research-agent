import { AudienceSegmentsSchema, SegmentPicksSchema, type AdMarket, type AdRing, type AudienceSegments, type ReadAd, type SegmentPicks } from "../../../domain/index.js";
import { AdScripts } from "../../../extract/index.js";
import { Trace } from "../../../trace/index.js";
import type { RunContext } from "../../pipeline/run-context.js";
import { SEGMENT_NAMER_SYSTEM, SEGMENT_SORTER_SYSTEM } from "../../prompt/text/audience-segments.js";
import { ToolReply } from "../../tools/tool-reply.js";

export interface Segmented {
  segmentByAd: Map<string, string>;
  segments: number;
  unsorted: number;
}

/** Who each market's ads are written for: per market, one agent names the audience segments from every distinct copy's reading, then copies are sorted into them in batches; code checks every copy lands in exactly one named segment and gives every ad of a copy its segment. General ads are not segmented. */
export class AudienceSegmenter {
  static readonly BATCH = 25;
  static readonly MAX_TURNS = 3;
  static readonly HOOK_CHARS = 140;
  static readonly MARKET: Readonly<Record<AdRing, AdMarket | null>> = { direct_competitor: "client_market", same_problem: "client_market", same_buyer: "same_buyer", general: null };

  async segment(context: RunContext, ads: readonly ReadAd[]): Promise<Segmented> {
    Trace.line(import.meta.url, "AudienceSegmenter.segment", { ads: ads.length });
    const markets = (["client_market", "same_buyer"] as const).map((market) => AdScripts.group(ads.filter((ad) => ad.ring && AudienceSegmenter.MARKET[ad.ring] === market)));
    const results = await Promise.all(markets.map((scripts, i) => (scripts.length > 0 ? this.market(context, i === 0 ? "client_market" : "same_buyer", scripts) : Promise.resolve({ segmentByAd: new Map<string, string>(), segments: 0, unsorted: 0 }))));
    return { segmentByAd: new Map(results.flatMap((r) => [...r.segmentByAd])), segments: results.reduce((n, r) => n + r.segments, 0), unsorted: results.reduce((n, r) => n + r.unsorted, 0) };
  }

  static nameProblems(named: AudienceSegments): string[] {
    Trace.line(import.meta.url, "AudienceSegmenter.nameProblems", { segments: named.segments.length });
    const keys = named.segments.map((s) => s.key);
    return [...new Set(keys.filter((key, i) => keys.indexOf(key) !== i))].map((key) => `segment key ${key} is used twice`);
  }

  static pickProblems(picks: SegmentPicks, handles: readonly string[], keys: readonly string[]): string[] {
    Trace.line(import.meta.url, "AudienceSegmenter.pickProblems", { given: handles.length, picked: picks.picks.length });
    const named = picks.picks.map((p) => p.copy);
    const problems = handles.filter((h) => !named.includes(h)).map((h) => `${h} is not sorted`);
    problems.push(...[...new Set(named.filter((h) => !handles.includes(h)))].map((h) => `${h} was not given; copy each handle exactly`));
    problems.push(...[...new Set(named.filter((h, i) => named.indexOf(h) !== i))].map((h) => `${h} is sorted twice`));
    problems.push(...picks.picks.filter((p) => !keys.includes(p.segment)).map((p) => `${p.copy} is put in ${p.segment}, which is not one of the segments; use a key exactly as given`));
    return problems;
  }

  private async market(context: RunContext, market: AdMarket, scripts: readonly (readonly ReadAd[])[]): Promise<Segmented> {
    Trace.line(import.meta.url, "AudienceSegmenter.market", { market, scripts: scripts.length });
    const lines = scripts.map((script, i) => AudienceSegmenter.line(`c${i + 1}`, script[0]!));
    const ads = scripts.reduce((n, script) => n + script.length, 0);
    const named = await context.agent({
      agentId: `segment_namer:${market}`,
      system: SEGMENT_NAMER_SYSTEM,
      instructions: ["Copies in this market:", ...lines].join("\n"),
      tools: [],
      maxTurns: AudienceSegmenter.MAX_TURNS,
      reasoning: "low",
      submission: { schema: AudienceSegmentsSchema, describe: "Hand back the audience segments.", check: (s) => AudienceSegmenter.nameProblems(s) },
    });
    if (named.status !== "completed") return { segmentByAd: new Map(), segments: 0, unsorted: ads };
    const segments = named.value.segments;
    const nameOf = new Map(segments.map((s) => [s.key, s.name]));
    const menu = ["Segments:", ...segments.map((s) => `${s.key}: ${s.name}. ${s.description}`)].join("\n");
    const segmentByAd = new Map<string, string>();
    let unsorted = 0;
    const starts = Array.from({ length: Math.ceil(scripts.length / AudienceSegmenter.BATCH) }, (_, b) => b * AudienceSegmenter.BATCH);
    await Promise.all(
      starts.map(async (start, b) => {
        const handles = lines.slice(start, start + AudienceSegmenter.BATCH).map((_, i) => `c${start + i + 1}`);
        const sorted = await context.agent({
          agentId: `segment_sorter:${market}:${b + 1}`,
          system: SEGMENT_SORTER_SYSTEM,
          instructions: [menu, "", "Copies to sort:", ...lines.slice(start, start + AudienceSegmenter.BATCH)].join("\n"),
          tools: [],
          maxTurns: AudienceSegmenter.MAX_TURNS,
          reasoning: "low",
          submission: { schema: SegmentPicksSchema, describe: "Hand back every copy with its segment.", check: (p) => AudienceSegmenter.pickProblems(p, handles, [...nameOf.keys()]) },
        });
        if (sorted.status !== "completed") {
          unsorted += handles.reduce((n, h) => n + scripts[Number(h.slice(1)) - 1]!.length, 0);
          return;
        }
        for (const pick of sorted.value.picks) for (const ad of scripts[Number(pick.copy.slice(1)) - 1]!) segmentByAd.set(ad.id, nameOf.get(pick.segment)!);
      }),
    );
    return { segmentByAd, segments: segments.length, unsorted };
  }

  private static line(handle: string, ad: ReadAd): string {
    Trace.tick(import.meta.url, "AudienceSegmenter.line");
    return `[${handle}] speaks to: ${ad.reading?.avatar ?? "not read"} | "${ToolReply.clip(ad.copy, AudienceSegmenter.HOOK_CHARS)}"`;
  }
}
