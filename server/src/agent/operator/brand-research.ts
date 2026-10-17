import { Brands, ProductFolders, RunStatuses, Runs, Scope, TERMINAL_STATUSES, type Gap, type ResearchRun, type ResearchStore } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

/** One stage of one product as the operator sees it: the run it stands on, what that run found, and what it could not. */
interface StageState {
  status: string;
  ran_on: string;
  figures: Record<string, number>;
  not_found: string[];
}

/** What has been researched for a brand, per product and stage, and the next steps code allows: market research, its gaps, product truth, market truth with its gate, customer voice only when the gate did not say drop, and customer truth once customer voice has its reviews. Stage numbers are the code's: 3 is customer voice, 4 market truth, 5 customer truth. */
export class BrandResearch {
  static readonly STAGES = [1, 2, 3, 4, 5] as const;
  static readonly NAMES: Readonly<Record<number, string>> = { 1: "market research", 2: "product truth", 3: "customer voice", 4: "market truth", 5: "customer truth" };
  static readonly GAPS_SHOWN = 12;

  constructor(private readonly store: ResearchStore) {}

  async report(workspaceId: string, brand: string): Promise<string> {
    Trace.line(import.meta.url, "BrandResearch.report", { workspaceId, brand });
    const products = (await this.store.products.list(Scope.of(workspaceId))).filter((p) => Brands.ofProduct(p.key) === brand);
    if (!brand) return "This chat is about no one brand; open a brand to see its research.";
    if (products.length === 0) return "Nothing has been researched for this brand yet. The next step is stage 1, market research.";
    const heads = await this.store.products.runHeads(Scope.of(workspaceId));
    const out = [];
    for (const product of products) {
      const stages: Record<string, StageState | string> = {};
      const runs: Partial<Record<number, ResearchRun>> = {};
      for (const stage of BrandResearch.STAGES) {
        const run = await this.newest(ProductFolders.runIds(heads.filter((h) => h.stage === stage), product.id));
        if (run) runs[stage] = run;
        stages[BrandResearch.NAMES[stage]!] = run ? BrandResearch.state(run) : "not run";
      }
      out.push({ product: product.key, name: product.label, stages, next_steps: BrandResearch.next(runs) });
    }
    return JSON.stringify(out, null, 1);
  }

  /** The stage run a stage stands on: the newest delivered stage run, else the newest stage run of any status; tasks are not stage runs. */
  private async newest(ids: string[]): Promise<ResearchRun | null> {
    Trace.line(import.meta.url, "BrandResearch.newest", { runs: ids.length });
    const runs = (await Promise.all(ids.map((id) => this.store.getRun(id)))).filter((r): r is ResearchRun => !!r && r.contract === null);
    return runs.find((r) => RunStatuses.delivered(r.status)) ?? runs[0] ?? null;
  }

  private static state(run: ResearchRun): StageState {
    Trace.line(import.meta.url, "BrandResearch.state", { runId: run.id });
    const { counts } = Runs.summary(run);
    const gaps = ((run.packet as { gaps?: Gap[] } | null)?.gaps ?? []).map((g) => `${g.node}: ${g.missing}`);
    const competitors = counts.competitors ? counts.competitors.direct + counts.competitors.indirect_form + counts.competitors.indirect_active : 0;
    return {
      status: run.status,
      ran_on: run.created_at.slice(0, 10),
      figures: { sources: counts.sources, facts: counts.attributes, figures: counts.measurements, quotes: counts.excerpts, competitors, not_found: counts.gaps },
      not_found: [...gaps.slice(0, BrandResearch.GAPS_SHOWN), ...(gaps.length > BrandResearch.GAPS_SHOWN ? [`and ${gaps.length - BrandResearch.GAPS_SHOWN} more`] : [])],
    };
  }

  /** What may be offered next, in order: a stage still running is waited for; market research first; then its gaps; product truth; market truth and its gate; customer voice, the expensive step, only when the gate did not say drop; then customer truth. */
  static next(runs: Partial<Record<number, ResearchRun>>): string[] {
    Trace.line(import.meta.url, "BrandResearch.next");
    const delivered = (n: number) => !!runs[n] && RunStatuses.delivered(runs[n]!.status);
    const running = BrandResearch.STAGES.filter((n) => runs[n] && !TERMINAL_STATUSES.has(runs[n]!.status));
    if (running.length > 0) return [`${running.map((n) => BrandResearch.NAMES[n]).join(", ")} is still running: wait for it.`];
    if (!delivered(1)) return ["Market research (propose_stage 1)."];
    const steps: string[] = [];
    if ((Runs.summary(runs[1]!).counts.gaps ?? 0) > 0) steps.push("Plug market research's gaps: propose_stage 1 again, only the parts the gaps belong to, with `focus` naming what is missing.");
    if (!delivered(2)) return [...steps, "Product truth (propose_stage 2): ask for the landed cost per unit first, for its margins."];
    if (!delivered(4)) return [...steps, "Market truth (propose_stage 4): market size, offers, sophistication, breaking point, and the viability gate. No paid Amazon search; it decides whether customer voice is worth paying for."];
    const verdict = BrandResearch.verdict(runs[4]!);
    if (verdict === "drop") return [...steps, "The viability gate said drop: tell the owner why, from its criteria. Offer customer voice only if the owner asks for it anyway."];
    if (!delivered(3)) steps.push(`Customer voice (start_customer_voice): the expensive step, paid Amazon review pulls behind the owner's approval. The gate said ${verdict || "nothing"}${verdict === "reposition" ? ": say what to reposition first" : ""}.`);
    else if (!delivered(5)) steps.push("Customer truth (propose_stage 5): avatars with sub-avatars, the language bank in customers' own words, the identity under them, and awareness per channel, read from customer voice's reviews. No paid search.");
    return steps;
  }

  /** The gate's verdict word from a market-truth run: go, reposition, drop, or "" when it gave none. */
  static verdict(run: ResearchRun): string {
    Trace.line(import.meta.url, "BrandResearch.verdict", { runId: run.id });
    const row = ((run.packet as { attributes?: { key: string; value: string }[] } | null)?.attributes ?? []).find((a) => a.key === "verdict");
    return row?.value.trim().toLowerCase().split(/[^a-z]+/)[0] ?? "";
  }
}
