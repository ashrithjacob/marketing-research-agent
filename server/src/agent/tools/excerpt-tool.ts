import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Type } from "@earendil-works/pi-ai";

import type { Corpus } from "../../adapters/corpus.js";
import { Clock, Paragraphs, type Node } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";
import { EXCERPT_RECORD } from "../prompt/text/excerpt-tool.js";
import type { RunFindings } from "../run-findings.js";

export const excerptParameters = Type.Object({
  source_id: Type.String({ description: "The source_id web_fetch returned for the page." }),
  from: Type.Number({ description: "The first paragraph of the quote, N of [pN]." }),
  to: Type.Number({ description: "The last paragraph of the quote; the same as from for one paragraph." }),
  entity: Type.Optional(Type.String({ description: "Who this is about: product, category, or a competitor id such as c3." })),
});

/** record_excerpt by reference: the model names paragraphs, code copies their text and character range from the archived body. */
export class ExcerptTool {
  constructor(
    private readonly findings: RunFindings,
    private readonly corpus: Corpus,
    private readonly node: Node,
  ) {}

  tool(): AgentTool<typeof excerptParameters> {
    Trace.line(import.meta.url, "ExcerptTool.tool", { node: this.node });
    const { findings, corpus, node } = this;
    return {
      name: EXCERPT_RECORD.name,
      label: "record excerpt",
      description: EXCERPT_RECORD.description,
      parameters: excerptParameters,
      async execute(_id, params) {
        Trace.line(import.meta.url, "ExcerptTool.tool.execute", { sourceId: params.source_id, from: params.from, to: params.to });
        const body = await corpus.read(findings.runId, params.source_id);
        if (body === null) return ExcerptTool.refused(`source '${params.source_id}' is not a page this task archived; fetch it with web_fetch first`);
        const picked = Paragraphs.range(body, params.from, params.to);
        if ("problem" in picked) return ExcerptTool.refused(picked.problem);
        const item = {
          source_id: params.source_id,
          text: picked.text,
          locator: { kind: "char_range", start: picked.start, end: picked.end },
          captured_at: Clock.nowIso(),
          node,
        };
        const result = await findings.record("excerpt", item, params.entity);
        if ("problems" in result) return ExcerptTool.refused(result.problems);
        const { recorded } = result;
        return {
          content: [{ type: "text", text: `RECORDED ${recorded.id} — p${params.from}–p${params.to}, ${picked.text.length} characters copied from the page` }],
          details: { recorded: true, id: recorded.id, kind: recorded.kind, entity: recorded.entity },
        };
      },
    };
  }

  private static refused(problems: string): { content: { type: "text"; text: string }[]; details: Record<string, unknown> } {
    Trace.line(import.meta.url, "ExcerptTool.refused", { problems });
    return { content: [{ type: "text", text: `NOT RECORDED — ${problems}. Fix this and call again.` }], details: { recorded: false, problems } };
  }
}
