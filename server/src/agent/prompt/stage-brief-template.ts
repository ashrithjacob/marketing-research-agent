import { Roles, type Deliverable, type RoleId, type RoleSpec } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

const TITLES: Partial<Record<RoleId, string>> = {
  champion: "The category's best-seller, to measure the product against",
  product: "Product facts",
  competitors: "Competitors",
  category: "Category numbers",
  formula: "The formula",
  mechanism: "How each ingredient works",
  dose_vs_study: "Doses against the studies",
  claim_limits: "What ads may claim",
  cogs_refills: "Prices and refills",
  market_size: "Market size",
  offers: "Offers",
  sophistication: "Sophistication",
  breaking_point: "Breaking point",
  gate: "The viability gate",
  voices: "The language bank: customers' own words",
  identity: "The identity under the words",
  avatars: "The avatars",
  awareness: "How aware each avatar is, per channel",
};

const STAGE_NAMES: Readonly<Record<number, string>> = { 1: "Market research", 2: "Product truth", 4: "Market truth", 5: "Customer truth" };

const GUIDANCE = `## Your guidance

- Add anything the research should focus on, leave out, or already know: a market to stay in, a competitor to include, a source to trust or to ignore. Delete a line above to have it left out.`;

/** A stage's brief as the owner first sees it: what each of its research agents will look for, in plain words, from the same deliverables code checks them against, then room for the owner's guidance. */
export class StageBriefTemplate {
  static of(stage: number, roles: readonly RoleSpec[], subject: string, focus = ""): string {
    Trace.line(import.meta.url, "StageBriefTemplate.of", { stage, roles: roles.map((r) => r.id) });
    const sections = roles.map((role) => `## ${TITLES[role.id] ?? role.id}\n\n${StageBriefTemplate.lines(role.deliverable).join("\n")}`);
    const guidance = focus ? `${GUIDANCE}\n- Look first for what the last research could not find: ${focus}` : GUIDANCE;
    return [`${STAGE_NAMES[stage] ?? `Stage ${stage}`} for ${subject} will look for the following. Edit anything: what you approve here is what the research agents are told.`, ...sections, guidance].join("\n\n");
  }

  /** The roles a stage runs, given which stage-1 parts are kept. */
  static roles(ids: readonly RoleId[]): RoleSpec[] {
    Trace.line(import.meta.url, "StageBriefTemplate.roles", { ids });
    return ids.map((id) => Roles.of(id));
  }

  private static lines(deliverable: Deliverable): string[] {
    Trace.line(import.meta.url, "StageBriefTemplate.lines", { shape: deliverable.shape });
    const words = (key: string) => key.replace(/_/g, " ");
    if (deliverable.shape === "fields") return deliverable.fields.map((f) => `- ${words(f.key)}${f.required ? "" : " (if found)"}: ${f.brief ?? f.describe}`);
    if (deliverable.shape === "list") {
      return [`- Every competitor, as ${deliverable.classes.map(words).join(", ")}, until new searches stop finding new ones. For each:`, ...deliverable.parts.map((p) => `  - ${words(p.key)}${p.required ? "" : " (if found)"}: ${p.describe}`)];
    }
    const over = deliverable.over.from === "markets" ? `For each market and ad platform (${deliverable.over.times.map(words).join(", ")})` : "For each active ingredient";
    const marked = deliverable.oneMarked ? [`- Then ${deliverable.oneMarked.describe}`] : [];
    return [`- ${over}: ${deliverable.needs.map((n) => n.brief ?? words(n.key)).join("; ")}`, ...marked];
  }
}
