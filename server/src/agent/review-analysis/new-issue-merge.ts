import { Type, type TSchema, type Tool, type Usage } from "@earendil-works/pi-ai";

import { ISSUE_KINDS, issueMergeSchema, type Issue, type IssueKind, type ReviewTag } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import type { StructuredAsk } from "./structured-ask.js";

/** Folds the points taggers found outside the catalogue into it: one call maps each proposed label to an existing or new issue. */
export class NewIssueMerge {
  static readonly tool: Tool<TSchema> = {
    name: "record_issue_merge",
    description: "Record the new issues and where every proposed label belongs.",
    constrainedSampling: { type: "json_schema", strict: "prefer" },
    parameters: Type.Object({
      new_issues: Type.Array(
        Type.Object({
          id: Type.String({ description: "snake_case id, not already in the catalogue" }),
          label: Type.String({ description: "Two to five plain words" }),
          kind: Type.Union(ISSUE_KINDS.map((kind) => Type.Literal(kind))),
          description: Type.String({ description: "One sentence: what a review must say to count." }),
        }),
      ),
      mapping: Type.Array(
        Type.Object({
          proposed: Type.String({ description: "A proposed label, exactly as given." }),
          issue_id: Type.String({ description: "A catalogue id or one of new_issues' ids." }),
        }),
      ),
    }),
  };

  constructor(private readonly asker: StructuredAsk) {}

  async apply(
    issues: readonly Issue[],
    tags: ReadonlyMap<string, ReviewTag>,
    onUsage: (usage: Usage) => void,
  ): Promise<{ issues: Issue[]; tags: Map<string, ReviewTag> }> {
    Trace.line(import.meta.url, "NewIssueMerge.apply", { issues: issues.length, tags: tags.size });
    const proposed = NewIssueMerge.proposals(tags);
    if (proposed.size === 0) return { issues: [...issues], tags: new Map(tags) };
    const merge = await this.asker.ask(
      { system: NewIssueMerge.system(issues), user: NewIssueMerge.user(proposed), tool: NewIssueMerge.tool, schema: issueMergeSchema },
      onUsage,
    );
    const known = new Set(issues.map((issue) => issue.id));
    const added = merge.new_issues.filter((issue) => !known.has(issue.id));
    const valid = new Set([...known, ...added.map((issue) => issue.id)]);
    const target = new Map(merge.mapping.filter((m) => valid.has(m.issue_id)).map((m) => [NewIssueMerge.key(m.proposed), m.issue_id]));
    const merged = new Map<string, ReviewTag>();
    for (const [ref, tag] of tags) {
      const id = target.get(NewIssueMerge.key(tag.new_label));
      merged.set(ref, id ? { ...tag, issues: [...new Set([...tag.issues, id])] } : tag);
    }
    return { issues: [...issues, ...added], tags: merged };
  }

  private static proposals(tags: ReadonlyMap<string, ReviewTag>): Map<string, { label: string; kind: IssueKind; count: number }> {
    Trace.line(import.meta.url, "NewIssueMerge.proposals", { tags: tags.size });
    const out = new Map<string, { label: string; kind: IssueKind; count: number }>();
    for (const tag of tags.values()) {
      const key = NewIssueMerge.key(tag.new_label);
      if (key === "" || tag.off_product) continue;
      const seen = out.get(key);
      out.set(key, { label: seen?.label ?? tag.new_label.trim(), kind: seen?.kind ?? tag.new_kind, count: (seen?.count ?? 0) + 1 });
    }
    return out;
  }

  private static key(label: string): string {
    Trace.tick(import.meta.url, "NewIssueMerge.key", {});
    return label.trim().toLowerCase().replace(/\s+/g, " ");
  }

  private static system(issues: readonly Issue[]): string {
    Trace.line(import.meta.url, "NewIssueMerge.system", { issues: issues.length });
    return [
      "Reviewers were tagged against this issue catalogue. Some raised points it misses, and the taggers",
      "named those in their own words. Fold every proposed label into the catalogue.",
      "",
      ...issues.map((issue) => `- ${issue.id} (${issue.kind}): ${issue.label} — ${issue.description}`),
      "",
      "- Map a proposed label to an existing id only when it means the same thing as that issue.",
      "- Otherwise merge proposals that mean the same thing into one new issue, concrete enough that two",
      "  readers would tag a review the same way, and map each of them to it.",
      "- Every proposed label gets exactly one mapping, spelled exactly as given.",
    ].join("\n");
  }

  private static user(proposed: ReadonlyMap<string, { label: string; kind: IssueKind; count: number }>): string {
    Trace.line(import.meta.url, "NewIssueMerge.user", { proposed: proposed.size });
    return [...proposed.values()]
      .sort((a, b) => b.count - a.count)
      .map((p) => `- ${p.label} (${p.kind}, ${p.count} review${p.count === 1 ? "" : "s"})`)
      .join("\n");
  }
}
