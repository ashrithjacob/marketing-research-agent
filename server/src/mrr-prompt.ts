/**
 * The stage-0 MRR judgement: would this product carry a ~28-day subscription?
 *
 * Kept in its own module for the same reason as `prompt.ts` — the wording is
 * tuned against real runs and should be diffable on its own.
 *
 * Two things here are deliberate and were learned the hard way in this repo:
 *
 * 1. **The candidate list goes last, after the example.** `prompt.ts` puts its
 *    worked example last, and the example is a complete magnesium packet: runs
 *    drifted toward magnesium whatever product was briefed, because the last
 *    thing the model read before generating was a finished answer about a
 *    different subject. Recency wins, so the data gets the last word.
 * 2. **The example is shape-only and says so.** It carries no real product,
 *    category or brand, and the prompt states that reusing its contents is an
 *    error. An example that is concrete about *structure* and empty about
 *    *subject* teaches the format without teaching an answer.
 *
 * The judgement itself is about consumption cadence, not category. "Supplement"
 * is not the signal — a 30-day pill bottle and a 12-week course of the same
 * pills score very differently, and a razor blade subscription scores well
 * without being a supplement at all.
 */

import { fencedBlocks } from "./packet.js";

/** One product put to the model, with the shop context that makes it legible. */
export interface MrrCandidate {
  /** Stable index within this batch. The model echoes this, never the title. */
  ref: number;
  domain: string;
  category: string;
  title: string;
  price: number | null;
  currency: string;
}

export interface MrrVerdict {
  ref: number;
  /** 0–10. 10 = depletes on a ~28-day cycle and is reordered without thought. */
  score: number;
  reason: string;
}

export const MRR_SYSTEM_PROMPT = `You judge one thing: whether a product would sustain \
a recurring ~28-day subscription, and how strongly. You answer with a score and one \
sentence of reasoning, as a single fenced JSON block and nothing else.

You are not asked whether the product is good, whether the market is attractive, or \
whether you would buy it. Only whether a typical buyer consumes it on a monthly cycle \
and would let it ship again without deciding again.`;

/**
 * The rubric. Stated as observable properties rather than categories, because a
 * category list is something a model pattern-matches against instead of thinking.
 */
const RUBRIC = `\
## What you are scoring

Score each product 0–10 on how well it would sustain a **recurring ~28-day
subscription**. The question is consumption cadence, not category.

A product scores high when all of these hold:

- **It runs out.** One purchase is depleted by ordinary use in roughly three to
  six weeks. Not two days, not six months.
- **The replacement is identical.** The buyer wants the same thing again, not a
  different colour, size or model next time.
- **Stopping is a decision.** Continuing is the default; the buyer has to act to
  cancel rather than act to repeat.
- **The cadence is close to 28 days.** A product depleted every 4 months can be
  subscribed, but the plan drifts from the billing cycle and churn follows.

Score low when:

- **It is durable.** Bought once and kept — hardware, tools, furniture, apparel,
  jewellery, electronics, a book. A buyer who already owns it has no reason to
  receive another.
- **It is a one-off or occasional purchase.** Gifts, seasonal items, single
  treatments, kits, anything bought when a specific need arises.
- **It is not a product.** Warranties, gift cards, booklets, leaflets, shipping
  insurance, branded merchandise, samples, digital downloads. Score these 0.
- **The title says nothing.** If the title is empty, punctuation, a bare SKU or
  otherwise uninterpretable, score 0 and say the title is unusable. Do not guess
  from the shop's category.

Anchors, so the scale means the same thing across batches:

- **9–10** — depleted monthly by design, reordered without thought
- **6–8** — genuinely consumable, but the natural cycle is longer than a month
  or the buyer varies the choice each time
- **3–5** — consumable only for a subset of buyers, or replaced a few times a year
- **1–2** — durable but with some consumable element
- **0** — durable, one-off, or not a product at all

Judge the title in front of you. A bundle, a multi-pack or a "90 day supply" of a
consumable lasts longer than a month: that is a real point against the 28-day
cadence, and the score should show it.`;

/**
 * A shape-only example. Concrete about structure, empty about subject.
 *
 * The refs are absurd on purpose (`-1`, `-2`) so a copied example is obvious in
 * the output rather than plausible.
 */
const EXAMPLE = `\
## Output

One fenced JSON block, an object with a \`verdicts\` array, and nothing outside
the fence. One entry per candidate, every \`ref\` you were given, exactly once:

\`\`\`json
{
  "verdicts": [
    { "ref": -1, "score": 0, "reason": "one sentence saying why, naming the property that decided it" },
    { "ref": -2, "score": 0, "reason": "one sentence saying why" }
  ]
}
\`\`\`

The block above shows the **shape only**. Its refs, scores and wording are
placeholders and carry no information about the real candidates: do not copy any
part of it into your answer, and do not let it suggest what a plausible score
looks like. Score only the candidates listed below, using their own refs.

- \`ref\` — copy the candidate's ref exactly. Never invent one, never echo a title.
- \`score\` — an integer 0–10.
- \`reason\` — one sentence, naming the property that decided it (depletion rate,
  durability, unusable title). Not a summary of the product.`;

/** The whole user turn for one scoring batch. Candidates last — see the module note. */
export function buildMrrInstructions(candidates: readonly MrrCandidate[]): string {
  const rows = candidates
    .map((c) => {
      const price =
        c.price == null || c.price <= 0 ? "price unknown" : `${c.price} ${c.currency || ""}`.trim();
      return `${c.ref}. ${c.title}\n   shop: ${c.domain} · category: ${c.category || "unknown"} · ${price}`;
    })
    .join("\n");

  return [
    RUBRIC,
    EXAMPLE,
    `## The candidates — score exactly these ${candidates.length}\n\n${rows}`,
  ].join("\n\n");
}

/**
 * Read the model's reply.
 *
 * Deliberately strict about refs and lenient about everything else: a ref that
 * was not asked for is dropped rather than guessed at, because attaching a score
 * to the wrong product is worse than having no score for it. A missing ref is
 * left missing and reported by the caller as unscored — not defaulted to zero,
 * which would read as "durable" when it means "not measured".
 */
export function parseMrrVerdicts(
  output: string,
  known: ReadonlySet<number>,
): { verdicts: MrrVerdict[]; problems: string[] } {
  const problems: string[] = [];
  const parsed = lastJsonBlock(output);
  if (parsed === null) {
    return { verdicts: [], problems: ["the reply contained no block that decoded as JSON"] };
  }

  const raw = (parsed as any)?.verdicts;
  if (!Array.isArray(raw)) {
    return { verdicts: [], problems: ["the JSON block has no `verdicts` array"] };
  }

  const verdicts: MrrVerdict[] = [];
  const seen = new Set<number>();
  for (const entry of raw) {
    const ref = Number((entry as any)?.ref);
    if (!Number.isInteger(ref) || !known.has(ref)) {
      problems.push(`dropped a verdict for unknown ref ${JSON.stringify((entry as any)?.ref)}`);
      continue;
    }
    if (seen.has(ref)) {
      problems.push(`ref ${ref} was scored more than once; kept the first`);
      continue;
    }
    const score = Number((entry as any)?.score);
    if (!Number.isFinite(score)) {
      problems.push(`ref ${ref} had a non-numeric score and was dropped`);
      continue;
    }
    seen.add(ref);
    verdicts.push({
      ref,
      // Clamped rather than rejected: an 11 is a model being emphatic, not a
      // model misunderstanding the task.
      score: Math.max(0, Math.min(10, Math.round(score))),
      reason: String((entry as any)?.reason ?? "").trim(),
    });
  }
  return { verdicts, problems };
}

/**
 * The last fenced block that decodes as JSON.
 *
 * Last, not first: a model that shows its working writes a draft block before the
 * real one — `packet.ts` §extract learned this for stage 1 and the scanner is
 * borrowed from it rather than rewritten. A regex is the obvious tool and gets it
 * wrong, treating one block's closing fence as the next one's opening fence.
 */
function lastJsonBlock(output: string): unknown | null {
  const candidates = fencedBlocks(output);
  const stripped = output.trim();
  // An output that is nothing but JSON is fine too — some models skip fences.
  if (stripped.startsWith("{")) candidates.push(stripped);

  for (let i = candidates.length - 1; i >= 0; i--) {
    const body = candidates[i]?.trim();
    if (!body) continue;
    try {
      return JSON.parse(body);
    } catch {
      continue;
    }
  }
  return null;
}
