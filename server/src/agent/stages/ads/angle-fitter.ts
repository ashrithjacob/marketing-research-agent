import { AngleFitsSchema, type AngleFits, type AngleRow, type Product } from "../../../domain/index.js";
import { Trace } from "../../../trace/index.js";
import type { AgentResult } from "../../kernel/agent-runner.js";
import type { RunContext } from "../../pipeline/run-context.js";
import { ANGLE_FITTER_SYSTEM } from "../../prompt/text/ad-analysis.js";

/** One agent call that judges, per angle, whether the client's own claims already back it; code checks one verdict per angle and that every cited claim exists (docs/spec-ads-analysis.md D7). */
export class AngleFitter {
  static readonly AGENT_ID = "angle_fitter";
  static readonly MAX_TURNS = 4;

  async fit(context: RunContext, product: Product, angles: readonly AngleRow[]): Promise<AgentResult<AngleFits>> {
    Trace.line(import.meta.url, "AngleFitter.fit", { angles: angles.length });
    const claims = product.claims_on_page.map((claim) => claim.text);
    const keys = angles.map((angle) => angle.key);
    return context.agent({
      agentId: AngleFitter.AGENT_ID,
      system: ANGLE_FITTER_SYSTEM,
      instructions: AngleFitter.brief(product, claims, angles),
      tools: [],
      maxTurns: AngleFitter.MAX_TURNS,
      submission: { schema: AngleFitsSchema, describe: "Hand back one verdict per angle.", check: (fits) => AngleFitter.problems(fits, keys, claims.length) },
    });
  }

  static problems(fits: AngleFits, keys: readonly string[], claimCount: number): string[] {
    Trace.line(import.meta.url, "AngleFitter.problems", { fits: fits.fits.length, angles: keys.length });
    const judged = fits.fits.map((fit) => fit.angle_key);
    const problems = keys.filter((key) => !judged.includes(key)).map((key) => `angle ${key} has no verdict`);
    problems.push(...judged.filter((key) => !keys.includes(key)).map((key) => `angle ${key} was not given; copy each key exactly`));
    problems.push(...[...new Set(judged.filter((key, i) => judged.indexOf(key) !== i))].map((key) => `angle ${key} has more than one verdict`));
    for (const fit of fits.fits) {
      problems.push(...fit.claim_indexes.filter((index) => index >= claimCount).map((index) => `angle ${fit.angle_key} cites claim ${index}, which does not exist`));
      if (fit.verdict === "supported" && fit.claim_indexes.length === 0) problems.push(`angle ${fit.angle_key} is supported but cites no claim`);
    }
    return problems;
  }

  private static brief(product: Product, claims: readonly string[], angles: readonly AngleRow[]): string {
    Trace.line(import.meta.url, "AngleFitter.brief", { angles: angles.length });
    return [
      "Angles to check against the client's claims.",
      `The client: ${product.brand} ${product.name}, a ${product.category || "product"} (${product.form_factor ?? "form unknown"}) sold on ${product.key_active || "its key ingredient"}.`,
      `Its claims:\n${claims.map((claim, index) => `${index}. ${claim}`).join("\n") || "none recorded"}`,
      ...angles.map((angle) => [`<angle key="${angle.key}">`, `${angle.name}: ${angle.description}`, ...angle.hooks.map((hook) => `- "${hook.hook}"`), "</angle>"].join("\n")),
    ].join("\n\n");
  }
}
