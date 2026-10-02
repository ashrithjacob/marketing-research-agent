import type { AgentTool } from "@earendil-works/pi-agent-core";

import type { Corpus } from "../../adapters/corpus.js";
import type { CompetitorDiscovery, DiscoveryQuestion, DiscoveryReport } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { discoverParameters } from "./parameters.js";

/** One research pass over the web for the brands selling to the champion's customer, asked once per agent: the answer is archived as a source and its brands are candidates, never competitors. */
export class DiscoverCompetitorsTool {
  constructor(
    private readonly discovery: CompetitorDiscovery,
    private readonly question: DiscoveryQuestion,
    private readonly corpus: Corpus,
    private readonly runId: string,
  ) {}

  tool(): AgentTool<typeof discoverParameters> {
    Trace.line(import.meta.url, "DiscoverCompetitorsTool.tool");
    const self = this;
    let answered: Promise<{ text: string; report: DiscoveryReport; sourceId: string }> | null = null;
    return {
      name: "discover_competitors",
      label: "Discover competitors",
      description:
        "Once per run: a research pass over the whole web (Parallel) names brands selling to the champion's customer, " +
        "with each one's page and who it says it is for. Takes one to three minutes. Every brand it names is a candidate: " +
        "web_fetch its own page before recording it. A second call returns the same list; after a failure it asks again.",
      parameters: discoverParameters,
      async execute(_id, _params, signal) {
        Trace.line(import.meta.url, "DiscoverCompetitorsTool.tool.execute", { repeat: answered !== null });
        const repeat = answered !== null;
        answered ??= self.answer(signal).catch((error: unknown) => {
          answered = null;
          throw error;
        });
        const { text, report, sourceId } = await answered;
        return {
          content: [{ type: "text", text: repeat ? `Already asked this run; the same list.\n\n${text}` : text }],
          details: { candidates: report.candidates, processor: report.processor, task_run_id: report.taskRunId, source_id: sourceId },
        };
      },
    };
  }

  private async answer(signal?: AbortSignal): Promise<{ text: string; report: DiscoveryReport; sourceId: string }> {
    Trace.line(import.meta.url, "DiscoverCompetitorsTool.answer", { product: this.question.product });
    const report = await this.discovery.discover(this.question, signal);
    const { sourceId, archived } = await this.corpus.write(this.runId, JSON.stringify(report, null, 2));
    return { text: DiscoverCompetitorsTool.render(report, sourceId, archived), report, sourceId };
  }

  private static render(report: DiscoveryReport, sourceId: string, archived: boolean): string {
    Trace.line(import.meta.url, "DiscoverCompetitorsTool.render", { candidates: report.candidates.length });
    const head =
      `${report.candidates.length} candidates from Parallel (processor ${report.processor}, task run ${report.taskRunId}), ` +
      `archived as source_id ${sourceId} (archived: ${archived}). To cite this list in a saturation curve, record_source it ` +
      `with kind "reference". A candidate is not a competitor: web_fetch its own page, compare who it is for with the ` +
      "champion's icp, then record_competitor it or skip it.";
    if (report.candidates.length === 0) return `${head}\n\nNo candidates.`;
    const rows = report.candidates.map(
      (c, i) =>
        `${i + 1}. ${c.brand} — ${c.name} (${c.form}, ${c.market})\n   ${c.url}\n   for: ${c.icp_as_printed}` +
        (c.evidence_url ? `\n   seen at: ${c.evidence_url}` : ""),
    );
    return [head, ...rows].join("\n\n");
  }
}
