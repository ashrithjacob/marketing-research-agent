import type { CompetitorCandidate, CompetitorDiscovery, DiscoveryQuestion, DiscoveryReport } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import type { ParallelTask } from "./parallel-task.js";

interface Basis {
  field?: string;
  citations?: Array<{ url?: string; excerpts?: string[] }>;
}

const TEXT = { type: "string" };

/** Asks Parallel's Task API which brands sell to the champion's customer; what to ask lives here, how to run it in ParallelTask. */
export class ParallelCompetitorDiscovery implements CompetitorDiscovery {
  private static readonly SCHEMA = {
    type: "object",
    properties: {
      competitors: {
        type: "array",
        description:
          "Every brand selling to the same customer as the product (the same people, with the same problem) in the markets named, " +
          "whatever its ingredients. A product for other people or another problem is not a competitor, even when it shares an ingredient. " +
          "Include brands sold direct-to-consumer, through retailers and through Meta or TikTok ads, not only on Amazon.",
        items: {
          type: "object",
          properties: {
            brand: TEXT,
            name: TEXT,
            url: { type: "string", description: "the brand's own product page" },
            form: { type: "string", description: "cream, powder, spray, capsule, soap…" },
            market: { type: "string", description: "which of the markets named it is sold in" },
            icp_as_printed: { type: "string", description: "who its own page says it is for and what it treats, word for word" },
          },
          required: ["brand", "name", "url", "form", "market", "icp_as_printed"],
          additionalProperties: false,
        },
      },
    },
    required: ["competitors"],
    additionalProperties: false,
  };

  constructor(
    private readonly task: ParallelTask,
    private readonly processor: string,
  ) {}

  async discover(question: DiscoveryQuestion, signal?: AbortSignal): Promise<DiscoveryReport> {
    Trace.line(import.meta.url, "ParallelCompetitorDiscovery.discover", { product: question.product, processor: this.processor });
    const body = {
      input: ParallelCompetitorDiscovery.input(question),
      processor: this.processor,
      task_spec: { output_schema: { type: "json", json_schema: ParallelCompetitorDiscovery.SCHEMA } },
    };
    const { runId, result } = await this.task.run(body, signal);
    return { candidates: ParallelCompetitorDiscovery.candidates(result), processor: this.processor, taskRunId: runId };
  }

  private static input(q: DiscoveryQuestion): string {
    Trace.line(import.meta.url, "ParallelCompetitorDiscovery.input", { product: q.product });
    return [
      `Find the competitors of ${q.product}${q.url ? ` (${q.url})` : ""}.`,
      `Its customer, as its own page puts it: ${q.icp || "not stated"}.`,
      `It is a ${q.form} with ${q.actives.join(", ") || "no actives named"}.`,
      `Markets: ${q.markets || "any"}.`,
    ].join(" ");
  }

  private static candidates(result: Record<string, unknown>): CompetitorCandidate[] {
    Trace.line(import.meta.url, "ParallelCompetitorDiscovery.candidates");
    const output = (result.output ?? {}) as { content?: unknown; basis?: Basis[] };
    const content = (typeof output.content === "string" ? JSON.parse(output.content) : output.content ?? {}) as { competitors?: unknown[] };
    const basis = new Map((output.basis ?? []).map((entry) => [entry.field ?? "", entry.citations?.[0]]));
    return (content.competitors ?? []).map((raw, index) => {
      const row = raw as Record<string, unknown>;
      const cited = basis.get(`competitors.${index}`);
      return {
        brand: String(row.brand ?? ""),
        name: String(row.name ?? ""),
        url: String(row.url ?? ""),
        form: String(row.form ?? ""),
        market: String(row.market ?? ""),
        icp_as_printed: String(row.icp_as_printed ?? ""),
        evidence_url: String(cited?.url ?? ""),
        evidence: (cited?.excerpts ?? []).join(" … "),
      };
    });
  }
}
