import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Type } from "@earendil-works/pi-ai";

import type { Corpus } from "../../adapters/corpus.js";
import { Paragraphs, type StoredRunReview } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";
import { RECORD_QUOTE } from "../prompt/text/voice-tools.js";
import type { RunFindings } from "../run-findings.js";

export const quoteParameters = Type.Object({
  review_ref: Type.Optional(Type.String({ description: "A review's ref, as read_reviews showed it." })),
  source_id: Type.Optional(Type.String({ description: "Or a page's source_id, as web_fetch returned it." })),
  from: Type.Optional(Type.Number({ description: "With source_id: the first paragraph, N of [pN]." })),
  to: Type.Optional(Type.Number({ description: "With source_id: the last paragraph; the same as from for one." })),
  function: Type.Union([Type.Literal("pain"), Type.Literal("outcome"), Type.Literal("objection"), Type.Literal("proof")]),
  buyer_stage: Type.Optional(Type.Union(["beginner", "explorer", "researcher", "skeptic", "hopeless"].map((s) => Type.Literal(s)))),
});

type Copied = { text: string; star: number | null; posted_at: string; source_id: string; review_ref: string; paragraphs: string } | { problem: string };

/** record_quote by reference: the model names a review or a page's paragraphs, code copies the customer's words from the review ledger or the archived page. */
export class QuoteTool {
  constructor(
    private readonly findings: RunFindings,
    private readonly reviews: readonly StoredRunReview[],
    private readonly corpus: Corpus,
  ) {}

  tool(): AgentTool<typeof quoteParameters> {
    Trace.line(import.meta.url, "QuoteTool.tool");
    const quoteTool = this;
    return {
      name: RECORD_QUOTE.name,
      label: "record quote",
      description: RECORD_QUOTE.description,
      parameters: quoteParameters,
      async execute(_id, params) {
        Trace.line(import.meta.url, "QuoteTool.tool.execute", { ref: params.review_ref, sourceId: params.source_id });
        const copied = await quoteTool.copy(params);
        if ("problem" in copied) return QuoteTool.refused(copied.problem);
        const result = await quoteTool.findings.record("quote", { ...copied, function: params.function, buyer_stage: params.buyer_stage ?? null });
        if ("problems" in result) return QuoteTool.refused(result.problems);
        const { recorded } = result;
        return { content: [{ type: "text", text: `RECORDED ${recorded.id} — ${copied.text.length} characters copied` }], details: { recorded: true, id: recorded.id, kind: recorded.kind } };
      },
    };
  }

  private async copy(params: { review_ref?: string; source_id?: string; from?: number; to?: number }): Promise<Copied> {
    Trace.line(import.meta.url, "QuoteTool.copy");
    if (params.review_ref) {
      const review = this.reviews.find((r) => r.ref === params.review_ref);
      if (!review) return { problem: `no review with ref '${params.review_ref}'; use a ref read_reviews showed` };
      return { text: review.text, star: review.star, posted_at: review.posted_at, source_id: review.source_id, review_ref: review.ref, paragraphs: "" };
    }
    if (!params.source_id || params.from === undefined) return { problem: "give a review_ref, or a source_id with from and to" };
    const body = await this.corpus.read(this.findings.runId, params.source_id);
    if (body === null) return { problem: `source '${params.source_id}' is not a page this run archived; fetch it with web_fetch first` };
    const picked = Paragraphs.range(body, params.from, params.to ?? params.from);
    if ("problem" in picked) return { problem: picked.problem };
    return { text: picked.text, star: null, posted_at: "", source_id: params.source_id, review_ref: "", paragraphs: `${params.from}-${params.to ?? params.from}` };
  }

  private static refused(problems: string): { content: { type: "text"; text: string }[]; details: Record<string, unknown> } {
    Trace.line(import.meta.url, "QuoteTool.refused", { problems });
    return { content: [{ type: "text", text: `NOT RECORDED — ${problems}. Fix this and call again.` }], details: { recorded: false, problems } };
  }
}
