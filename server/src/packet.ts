/**
 * Get the stage-1 packet out of a run's output, and refuse it if it is wrong.
 *
 * Two jobs, kept separate because they fail for different reasons:
 *
 * * **extract** — find the JSON in whatever prose the agent wrapped it in.
 *   Forgiving, because the model's formatting is not the contract.
 * * **validate** — check it against `spec-stage-1.md` §4.1. Unforgiving, because
 *   the *shape* is the contract, and a lenient validator here quietly re-permits
 *   the exact failure stage 1 exists to prevent.
 */

import { z } from "zod";

import {
  COMPETITOR_RELATIONS,
  NODES,
  isPartial,
  stagePacketSchema,
  type CompetitorRelation,
  type Node,
  type StagePacket,
} from "./schema.js";

/** The output carried no packet, or one that violates the contract. */
export class PacketError extends Error {
  override readonly name = "PacketError";
}

/**
 * Every ``` … ``` block, in order, by scanning lines.
 *
 * A regex is the obvious tool and gets this wrong: with a non-greedy body it
 * happily treats one block's *closing* fence as the next block's opening one,
 * so a reply that contains a ```python block before the packet yields one
 * garbage candidate and no packet. Line-at-a-time is longer and correct.
 */
export function fencedBlocks(text: string): string[] {
  const blocks: string[] = [];
  let body: string[] | null = null;
  for (const line of text.split("\n")) {
    if (line.trimStart().startsWith("```")) {
      if (body === null) {
        body = [];
      } else {
        blocks.push(body.join("\n"));
        body = null;
      }
      continue;
    }
    if (body !== null) body.push(line);
  }
  if (body !== null) blocks.push(body.join("\n")); // unterminated fence — the model ran out of room
  return blocks;
}

/**
 * Pull the packet object out of a run's final output.
 *
 * The *last* decodable block wins: an agent that shows its working writes an
 * example first and the real packet last.
 */
export function extract(output: string): Record<string, unknown> {
  if (!output || !output.trim()) {
    throw new PacketError("run produced no output to read a packet from");
  }

  const candidates = fencedBlocks(output);
  // An output that is nothing but JSON is fine too — some models skip fences.
  const stripped = output.trim();
  if (stripped.startsWith("{")) candidates.push(stripped);

  for (let i = candidates.length - 1; i >= 0; i--) {
    let decoded: unknown;
    try {
      decoded = JSON.parse(candidates[i]!);
    } catch {
      continue;
    }
    if (decoded && typeof decoded === "object" && !Array.isArray(decoded) && "stage" in decoded) {
      return decoded as Record<string, unknown>;
    }
  }

  if (candidates.length === 0) {
    throw new PacketError(
      "no fenced JSON block in the run output — the packet must be emitted as ```json … ```",
    );
  }
  throw new PacketError("found fenced blocks but none decoded to a stage packet object");
}

/**
 * Parse into the contract, then apply the §4.1 rules the schema cannot.
 *
 * The `.strict()` objects already reject an unknown key — which is what makes
 * "stage 1 contains no judgements" structural rather than advisory. Everything
 * below is a cross-object rule.
 */
export function validate(
  data: unknown,
  scope: readonly Node[] = NODES,
  brief?: { product?: unknown },
): StagePacket {
  const parsed = stagePacketSchema.safeParse(data);
  if (!parsed.success) throw new PacketError(readable(parsed.error));
  const packet = parsed.data;

  const problems: string[] = [];

  // 1. A run that covers part of the stage records nothing outside it — the
  //    worked example shows all four nodes, and copying it is the easy mistake.
  //    It must also say how each node it did cover ended.
  if (isPartial(scope)) {
    const allowed = new Set<string>(scope);
    const outside = new Map<string, number>();
    const tally = (items: ReadonlyArray<{ node: string }>) => {
      for (const { node } of items) {
        if (!allowed.has(node)) outside.set(node, (outside.get(node) ?? 0) + 1);
      }
    };
    for (const items of [
      packet.sources,
      packet.excerpts,
      packet.measurements,
      packet.attributes,
      packet.saturation,
      packet.nodes,
      packet.gaps,
    ]) {
      tally(items);
    }
    // Competitor rows carry no `node` field — they are the competitors node.
    const competitorRows = packet.competitors.length + (packet.competitor_reference ? 1 : 0);
    if (competitorRows > 0 && !allowed.has("competitors")) {
      outside.set("competitors", (outside.get("competitors") ?? 0) + competitorRows);
    }
    for (const [node, count] of outside) {
      problems.push(
        `${count} entr${count === 1 ? "y is" : "ies are"} recorded against ${node}, ` +
          `which is outside this run's scope (${scope.join(", ")})`,
      );
    }
    const reported = new Set(packet.nodes.map((n) => n.node));
    for (const node of scope) {
      if (!reported.has(node)) problems.push(`nodes has no entry for ${node}, the node this run covers`);
    }
  }
  const sourceIds = new Set(packet.sources.map((s) => s.id));

  // 2. The packet answers the brief the run was given, not the worked example.
  //    The example names a product, and a model that anchors on it researches
  //    the example instead — a "completed" run about the wrong product is the
  //    most expensive failure here, and the quietest. Containment, not
  //    equality: "mullein" researched as "Mullein leaf 500mg capsules" is the
  //    agent doing its job.
  //    A brief can also be a store URL, which no product name ever contains.
  //    Then the brand in the domain ("surity" from https://www.surity.care/)
  //    stands in for the name.
  const wanted = typeof brief?.product === "string" ? normaliseName(brief.product) : "";
  const got = normaliseName(packet.brief.product);
  const labels = wanted ? brandLabels(wanted) : null;
  const matches = labels
    ? labels.some((label) => got.includes(label))
    : got.includes(wanted) || wanted.includes(got);
  if (wanted && got && !matches) {
    problems.push(
      `packet brief is about '${packet.brief.product}', but this run's brief is ` +
        `'${String(brief?.product)}' — the worked example is not the assignment`,
    );
  }

  // 3. Every reference resolves. A dangling source_id is an excerpt from nowhere.
  for (const excerpt of packet.excerpts) {
    if (!sourceIds.has(excerpt.source_id)) {
      problems.push(
        `excerpt '${excerpt.id}' cites source '${excerpt.source_id}', which is not in the packet`,
      );
    }
  }
  for (const [label, items] of [
    ["measurement", packet.measurements],
    ["attribute", packet.attributes],
  ] as const) {
    for (const item of items) {
      if (!sourceIds.has(item.source_id)) {
        problems.push(
          `${label} '${item.id}' cites source '${item.source_id}', which is not in the packet`,
        );
      }
    }
  }
  for (const entry of packet.saturation) {
    for (const point of entry.curve) {
      if (!sourceIds.has(point.source_id)) {
        problems.push(
          `saturation curve for ${entry.node} cites source '${point.source_id}', ` +
            "which is not in the packet",
        );
      }
    }
  }

  const gappedNodes = new Set(packet.gaps.map((g) => g.node));

  // 4. An ad with no first-seen date is a hole in the sophistication read that
  //    stage 3 depends on. Capture it, but say so.
  for (const source of packet.sources) {
    if (source.kind === "ad_library" && source.admitted && !source.first_seen) {
      if (!gappedNodes.has("competitors")) {
        problems.push(
          `ad-library source '${source.url}' has no first_seen and no gap records the missing dates`,
        );
        break;
      }
    }
  }

  const complete = new Set(packet.nodes.filter((n) => n.status === "complete").map((n) => n.node));

  // 5. 3★ is mandatory coverage, not a preference — it is where the honest
  //    text lives, so a review node without it has not mined reviews.
  if (complete.has("review_mining")) {
    if (!packet.excerpts.some((e) => e.star_rating === 3)) {
      problems.push("review_mining is complete but no 3-star excerpt was captured");
    }
  }

  // 6. spec.md §4.3 — an empty gap list means the run stopped looking.
  if (packet.gaps.length === 0) {
    problems.push(
      "gap list is empty; real research always has holes, so the run is treated as failed",
    );
  }

  // 7. Saturation is the done-criterion for everything except the finite
  //    product-data checklist. Competitor discovery saturates per class (§2.2):
  //    one combined curve lets a long direct list end the indirect search.
  const curves = new Set(packet.saturation.filter((s) => s.curve.length > 0).map((s) => s.node));
  for (const node of complete) {
    if (node === "product_data") continue;
    if (node === "competitors") {
      for (const relation of COMPETITOR_RELATIONS) {
        const has = packet.saturation.some(
          (s) => s.node === "competitors" && s.class === relation && s.curve.length > 0,
        );
        if (!has) {
          problems.push(
            `competitors is complete with no ${relation} saturation curve — discovery ` +
              "saturates per class, so each class needs its own",
          );
        }
      }
      continue;
    }
    if (!curves.has(node)) {
      problems.push(
        `node ${node} is complete with no saturation curve — 'done' has to be a ` +
          "measurement, not an assertion",
      );
    }
  }

  // 8. Competitor rows (§2.2). Direct vs indirect is a mechanical test — same
  //    active and same form, or same active and a different form — so it is
  //    recomputed here rather than taken on trust. A label the forms contradict
  //    is a judgement that slipped in, and "shared" actives the row does not
  //    list are a competitor that shares nothing.
  problems.push(...competitorProblems(packet, sourceIds));

  if (problems.length > 0) throw new PacketError(problems.join("; "));
  return packet;
}

export function parse(
  output: string,
  scope: readonly Node[] = NODES,
  brief?: { product?: unknown },
): StagePacket {
  return validate(extract(output), scope, brief);
}

/** Lowercase, whitespace-collapsed — the echo need not be character-perfect. */
function normaliseName(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * The brand-bearing labels of a URL brief: its host without `www`, the TLD,
 * or short second-level labels like `co` in `.co.uk`. Null when the brief is
 * not a URL. A bare domain ("surity.care") counts as one.
 */
export function brandLabels(brief: string): string[] | null {
  if (/\s/.test(brief)) return null;
  let host: string;
  try {
    host = new URL(/^[a-z][a-z0-9+.-]*:\/\//.test(brief) ? brief : `https://${brief}`).hostname;
  } catch {
    return null;
  }
  const parts = host.split(".");
  if (parts.length < 2) return null;
  const labels = parts.slice(0, -1).filter((label) => label.length > 1 && !NON_BRAND.has(label));
  return labels.length > 0 ? labels : null;
}

/** Host labels that name no brand: `www`, second-level domains, shop subdomains. */
const NON_BRAND = new Set(["www", "co", "com", "net", "org", "gov", "edu", "ac", "shop", "store"]);

/** The §2.2 test, and nothing else. */
export function expectedRelation(competitorForm: string, referenceForm: string): CompetitorRelation {
  return competitorForm === referenceForm ? "direct" : "indirect";
}

function competitorProblems(packet: StagePacket, sourceIds: ReadonlySet<string>): string[] {
  const problems: string[] = [];
  const reference = packet.competitor_reference;
  if (packet.competitors.length > 0 && !reference) {
    problems.push(
      "competitors are listed but competitor_reference is missing — direct and " +
        "indirect are measured against the product's own form and actives",
    );
  }
  if (reference && !sourceIds.has(reference.source_id)) {
    problems.push(
      `competitor_reference cites source '${reference.source_id}', which is not in the packet`,
    );
  }
  const referenceActives = new Set((reference?.actives ?? []).map(normaliseName));
  const kinds = new Map(packet.sources.map((s) => [s.id, s.kind]));
  const seen = new Set<string>();

  for (const row of packet.competitors) {
    const label = `competitor '${row.name}'`;
    if (seen.has(row.id)) problems.push(`${label} repeats id '${row.id}'`);
    seen.add(row.id);
    if (!sourceIds.has(row.source_id)) {
      problems.push(`${label} cites source '${row.source_id}', which is not in the packet`);
    }
    for (const adId of row.ad_source_ids) {
      if (!sourceIds.has(adId)) {
        problems.push(`${label} links ad source '${adId}', which is not in the packet`);
      } else if (kinds.get(adId) !== "ad_library") {
        problems.push(`${label} links '${adId}' as an ad, but that source is ${kinds.get(adId)}`);
      }
    }
    const ownActives = new Set(row.active_ingredients.map((a) => normaliseName(a.name_normalised)));
    for (const shared of row.shared_actives.map(normaliseName)) {
      if (!ownActives.has(shared)) {
        problems.push(`${label} lists '${shared}' as shared, but not among its own actives`);
      } else if (reference && !referenceActives.has(shared)) {
        problems.push(
          `${label} lists '${shared}' as shared, but the reference product's actives are ` +
            `${[...referenceActives].join(", ")} — a brand with a different active is neither ` +
            "direct nor indirect; gap it as \"same problem, different active\"",
        );
      }
    }
    if (reference) {
      const expected = expectedRelation(row.form, reference.form);
      if (row.relation !== expected) {
        problems.push(
          `${label} is labelled ${row.relation}, but its form (${row.form}) ` +
            `${expected === "direct" ? "matches" : "differs from"} the reference's ` +
            `(${reference.form}), which makes it ${expected}`,
        );
      }
    }
  }
  return problems;
}

/**
 * zod's report, trimmed to the part that says what to fix.
 *
 * `unrecognized_keys` gets its own wording: the agent wrote a field that does
 * not exist, and nine times out of ten that field is a conclusion.
 */
function readable(error: z.ZodError): string {
  const all: string[] = [];
  for (const issue of error.issues) {
    const where = issue.path.join(".") || "(root)";
    if (issue.code === "unrecognized_keys") {
      for (const key of issue.keys) {
        all.push(
          `${where === "(root)" ? key : `${where}.${key}`}: field not in the stage-1 ` +
            "contract. Stage 1 gathers material and records nothing else — a " +
            "conclusion has no field to live in",
        );
      }
    } else {
      all.push(`${where}: ${issue.message}`);
    }
  }
  const lines = all.slice(0, 8);
  const remaining = all.length - lines.length;
  if (remaining > 0) lines.push(`(+${remaining} more)`);
  return lines.join("; ");
}
