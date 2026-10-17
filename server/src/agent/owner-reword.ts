import { Type, type Models, type TSchema, type Tool } from "@earendil-works/pi-ai";

import type { OpenRouterPrices, RunBilling } from "../adapters/index.js";
import { Briefs, MARKET_TRUTH_AGENTS, Roles, rewordsSchema, stagePacketSchema, VERDICT_SECTIONS, type Attribute, type FieldSpec, type ResearchStore } from "../domain/index.js";
import { RewordCheck } from "../extract/index.js";
import { Trace } from "../trace/index.js";

import { ModelChain } from "./model-chain.js";
import { ModelPricing } from "./pricing.js";
import { MarketTruthPrompts } from "./prompt/index.js";
import { REWORD_INPUT, REWORD_SYSTEM } from "./prompt/text/reword.js";
import { StructuredAsk } from "./review-analysis/structured-ask.js";

/** The gate's owner-facing values, rewritten by the judge model to read on their own; a rewrite that changes the leading verdict word or the sources it cites is dropped, and the original shown. */
export class OwnerReword {
  static readonly MAX_TOKENS = 16000;
  static readonly VERDICT = "verdict";

  static readonly tool: Tool<TSchema> = {
    name: "record_rewrites",
    description: "Record the rewritten judgements, one per key.",
    constrainedSampling: { type: "json_schema", strict: "prefer" },
    parameters: Type.Object({
      rewrites: Type.Array(
        Type.Object({
          key: Type.String({ description: "The judgement's key, exactly as given." }),
          text: Type.String({ description: "The rewrite: the same first word, a dash, then text that reads on its own." }),
        }),
      ),
      verdict: Type.Object({
        stands: Type.String({ description: "Where it stands: the verdict and which criteria pass, fail or are unknown, and why, in two or three sentences." }),
        change: Type.String({ description: "What has to change, as points separated by \" | \"; empty for a go." }),
        from_you: Type.String({ description: "Figures only the owner has (their landed unit cost, their budget), each with why it is needed, separated by \" | \"; empty when none." }),
        would_change: Type.String({ description: "What research could still find that would change the verdict, separated by \" | \"; empty when nothing would." }),
      }),
    }),
  };

  constructor(
    private readonly store: ResearchStore,
    private readonly models: Models,
    private readonly costs: OpenRouterPrices,
    private readonly modelId: string,
  ) {}

  /** Rewrites the stored packet's reworded fields, tracking the call on `billing`; returns how many now carry a rewrite. */
  async apply(runId: string, billing: RunBilling): Promise<number> {
    Trace.line(import.meta.url, "OwnerReword.apply", { runId, model: this.modelId });
    const run = await this.store.getRun(runId);
    const packet = stagePacketSchema.safeParse(run?.packet);
    if (!run || !packet.success) return 0;
    const fields = OwnerReword.fields();
    const targets = packet.data.attributes.filter((a) => fields.has(OwnerReword.slot(a)));
    if (targets.length === 0) return 0;
    const resolved = ModelChain.resolve([this.modelId], this.models, new ModelPricing(this.costs));
    if ("unknown" in resolved) throw new Error(`unknown judge model ${JSON.stringify(resolved.unknown)} for provider openrouter`);
    const user = REWORD_INPUT.replace("{subject}", Briefs.label(run.brief))
      .replace("{notes}", MarketTruthPrompts.found(await this.store.findings.list(runId)))
      .replace("{judgements}", targets.map((a) => `## ${a.key}\n\nIt answers: ${fields.get(OwnerReword.slot(a))!.describe}\n\n${a.value}`).join("\n\n"));
    const answer = await new StructuredAsk(this.models, resolved.chain, OwnerReword.MAX_TOKENS).ask(
      { system: REWORD_SYSTEM, user, tool: OwnerReword.tool, schema: rewordsSchema },
      (_usage, responseId) => void billing.track(responseId),
    );
    const rewrites = new Map(answer.rewrites.map((r) => [r.key, r.text.trim()]));
    const verdict = answer.verdict ? VERDICT_SECTIONS.map((s) => ({ title: s.title, text: answer.verdict![s.key].trim() })) : null;
    const original = targets.find((a) => a.key === OwnerReword.VERDICT);
    if (verdict && original) rewrites.set(OwnerReword.VERDICT, `${original.value.trim().split(/[^A-Za-z]+/)[0]} — ${verdict.map((s) => s.text).join(" ")}`);
    const attributes = packet.data.attributes.map((a) => {
      const reworded = OwnerReword.reworded(a, fields.get(OwnerReword.slot(a)), rewrites.get(a.key));
      return reworded.reads_as && a.key === OwnerReword.VERDICT && verdict ? { ...reworded, sections: verdict.filter((s) => s.text) } : reworded;
    });
    await this.store.updateRun(runId, { packet: { ...packet.data, attributes } as unknown as Record<string, unknown> });
    return attributes.filter((a) => a.reads_as).length;
  }

  private static reworded(attribute: Attribute, field: FieldSpec | undefined, rewrite: string | undefined): Attribute {
    Trace.tick(import.meta.url, "OwnerReword.reworded");
    if (!field || !rewrite || !RewordCheck.keeps(attribute.value, rewrite, field.rule)) return attribute;
    return { ...attribute, reads_as: rewrite };
  }

  private static slot(attribute: Attribute): string {
    Trace.tick(import.meta.url, "OwnerReword.slot");
    return `${attribute.node}:${attribute.key}`;
  }

  /** Every market-truth field marked `reword`, by node and key. */
  private static fields(): Map<string, FieldSpec> {
    Trace.line(import.meta.url, "OwnerReword.fields");
    const out = new Map<string, FieldSpec>();
    for (const id of MARKET_TRUTH_AGENTS) {
      const deliverable = Roles.of(id).deliverable;
      if (deliverable.shape !== "fields" || !deliverable.node) continue;
      for (const field of deliverable.fields) if (field.reword) out.set(`${deliverable.node}:${field.key}`, field);
    }
    return out;
  }
}
