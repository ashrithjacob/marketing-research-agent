import type { Scope } from "./accounts.js";
import type { Finding } from "./findings.js";
import { Trace } from "../trace/index.js";

export interface DraftSection {
  key: string;
  text: string;
}

export interface Verdict {
  criterion: string;
  pass: boolean;
  why: string;
}

export type DraftStatus = "writing" | "critique" | "review" | "approved" | "rejected";

/** One version of a draft a write task made (spec §3: `write`). The writer's work is version 1; each owner edit is a new version. Its text names findings by the id they have in its run's ledger. */
export interface Draft {
  id: string;
  version: number;
  workspace_id: string;
  run_id: string;
  playbook: string;
  sections: DraftSection[];
  by: "writer" | "owner";
  status: DraftStatus;
  verdicts: Verdict[];
  created_at: string;
}

export interface DraftBook {
  /** The writer's working copy: created on its first section, changed in place while it writes. */
  write(workspaceId: string, runId: string, playbook: string, section: DraftSection): Promise<Draft>;
  ofRun(runId: string): Promise<Draft | null>;
  get(scope: Scope, draftId: string): Promise<Draft | null>;
  list(scope: Scope, limit: number): Promise<Draft[]>;
  /** A new version, by the owner, with their sections. */
  edit(draftId: string, sections: DraftSection[]): Promise<Draft>;
  mark(draftId: string, status: DraftStatus, verdicts?: Verdict[]): Promise<void>;
}

/** A draft as the owner and the critic read it: each section with its placeholders filled, and the findings it cites as numbered footnotes. */
export interface DraftView {
  sections: { key: string; title: string; text: string }[];
  notes: { id: string; kind: string; value: string }[];
}

/** A draft's text: `[[id]]` cites a finding, `{{id}}` puts a finding's own quote or figure in place (spec §6.8: the model names, code copies). */
export class DraftText {
  static cites(text: string): string[] {
    Trace.line(import.meta.url, "DraftText.cites");
    return [...text.matchAll(/\[\[([^\]\s]+)\]\]/g)].map((m) => m[1]!);
  }

  static places(text: string): string[] {
    Trace.line(import.meta.url, "DraftText.places");
    return [...text.matchAll(/\{\{([^}\s]+)\}\}/g)].map((m) => m[1]!);
  }

  /** Digits written in the text itself, not copied in from a finding: a figure the writer typed. */
  static typedFigures(text: string): string[] {
    Trace.line(import.meta.url, "DraftText.typedFigures");
    return [...text.replace(/\[\[[^\]]*\]\]|\{\{[^}]*\}\}/g, "").matchAll(/\d[\d.,%]*/g)].map((m) => m[0]);
  }

  /** The text as the owner reads it: each placeholder filled from its finding, each citation a footnote number. */
  static render(text: string, rows: readonly Finding[], notes: string[]): string {
    Trace.line(import.meta.url, "DraftText.render", { rows: rows.length });
    const byId = new Map(rows.map((row) => [row.id, row]));
    return text
      .replace(/\{\{([^}\s]+)\}\}/g, (_all, id: string) => DraftText.value(byId.get(id)) ?? `{{${id}}}`)
      .replace(/\[\[([^\]\s]+)\]\]/g, (_all, id: string) => `[${(notes.includes(id) ? notes.indexOf(id) : notes.push(id) - 1) + 1}]`);
  }

  static view(draft: Draft, rows: readonly Finding[], titles: ReadonlyMap<string, string>): DraftView {
    Trace.line(import.meta.url, "DraftText.view", { draftId: draft.id });
    const ids: string[] = [];
    const sections = draft.sections.map((s) => ({ key: s.key, title: titles.get(s.key) ?? s.key, text: DraftText.render(s.text, rows, ids) }));
    const byId = new Map(rows.map((row) => [row.id, row]));
    return { sections, notes: ids.map((id) => ({ id, kind: byId.get(id)?.kind ?? "missing", value: DraftText.value(byId.get(id)) ?? "" })) };
  }

  /** What a finding puts into a draft: an excerpt's words, an attribute's or a measurement's value. */
  static value(row: Finding | undefined): string | undefined {
    Trace.line(import.meta.url, "DraftText.value", { kind: row?.kind });
    if (!row) return undefined;
    const p = row.payload;
    if (row.kind === "excerpt") return `"${String(p.text ?? "")}"`;
    if (row.kind === "measurement") return [p.value, p.unit].filter((part) => part !== undefined && part !== "").join(" ");
    if (row.kind === "attribute") return String(p.value ?? "");
    return String(p.name ?? p.title ?? p.url ?? "");
  }
}
