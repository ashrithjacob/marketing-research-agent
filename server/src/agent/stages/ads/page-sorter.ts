import { PageKindsSchema, type PageKind, type PageKinds, type StoredAd } from "../../../domain/index.js";
import { Trace } from "../../../trace/index.js";
import type { AgentResult } from "../../kernel/agent-runner.js";
import type { RunContext } from "../../pipeline/run-context.js";
import { PAGE_SORTER_SYSTEM } from "../../prompt/text/page-sorter.js";
import { ToolReply } from "../../tools/tool-reply.js";

/** Tags each advertiser page of the run as brand, community, persona or authority; an agent sees each page once, by a short handle, in batches; code checks every page is sorted exactly once and gives every ad its page's kind. */
export class PageSorter {
  static readonly BATCH = 60;
  static readonly MAX_TURNS = 3;
  static readonly OPENING_CHARS = 160;

  async sort(context: RunContext, ads: readonly StoredAd[]): Promise<{ kinds: Map<string, PageKind>; unsorted: number }> {
    Trace.line(import.meta.url, "PageSorter.sort", { ads: ads.length });
    const pages = new Map<string, StoredAd[]>();
    for (const ad of ads) pages.set(ad.advertiser, [...(pages.get(ad.advertiser) ?? []), ad]);
    const all = [...pages.entries()];
    const batches = Array.from({ length: Math.ceil(all.length / PageSorter.BATCH) }, (_, i) => all.slice(i * PageSorter.BATCH, (i + 1) * PageSorter.BATCH));
    const kinds = new Map<string, PageKind>();
    let unsorted = 0;
    const results = await Promise.all(batches.map((batch, i) => this.sortBatch(context, batch, i + 1)));
    results.forEach((result, i) => {
      const batch = batches[i]!;
      if (result.status !== "completed") {
        unsorted += batch.length;
        return;
      }
      for (const { page, kind } of result.value.pages) kinds.set(batch[Number(page.slice(1)) - 1]![0], kind);
    });
    return { kinds, unsorted };
  }

  static problems(sorted: PageKinds, handles: readonly string[]): string[] {
    Trace.line(import.meta.url, "PageSorter.problems", { given: handles.length, sorted: sorted.pages.length });
    const named = sorted.pages.map((entry) => entry.page);
    const problems = handles.filter((handle) => !named.includes(handle)).map((handle) => `${handle} is not sorted`);
    problems.push(...[...new Set(named.filter((handle) => !handles.includes(handle)))].map((handle) => `${handle} was not given; copy each handle exactly`));
    problems.push(...[...new Set(named.filter((handle, i) => named.indexOf(handle) !== i))].map((handle) => `${handle} is sorted twice`));
    return problems;
  }

  private sortBatch(context: RunContext, batch: readonly (readonly [string, StoredAd[]])[], number: number): Promise<AgentResult<PageKinds>> {
    Trace.line(import.meta.url, "PageSorter.sortBatch", { pages: batch.length, number });
    const handles = batch.map((_, i) => `p${i + 1}`);
    return context.agent({
      agentId: `page_sorter:${number}`,
      system: PAGE_SORTER_SYSTEM,
      instructions: ["Pages to sort:", ...batch.map(([name, ads], i) => PageSorter.line(handles[i]!, name, ads))].join("\n"),
      tools: [],
      maxTurns: PageSorter.MAX_TURNS,
      reasoning: "low",
      submission: { schema: PageKindsSchema, describe: "Hand back every page with its kind.", check: (sorted) => PageSorter.problems(sorted, handles) },
    });
  }

  private static line(handle: string, name: string, ads: readonly StoredAd[]): string {
    Trace.tick(import.meta.url, "PageSorter.line");
    const first = ads[0]!;
    return `[${handle}] "${name}" → ${first.landing_domain || "no landing page"} | ${ads.length} ad(s) | "${ToolReply.clip(first.copy, PageSorter.OPENING_CHARS)}"`;
  }
}
