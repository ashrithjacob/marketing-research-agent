import type { FieldRule } from "../domain/index.js";
import { Trace } from "../trace/index.js";

const SOURCE_ID = /sha256:([0-9a-f]{6,64})\b|\b([0-9a-f]{40,64})\b/g;

/** Whether a rewrite of a recorded value may stand in for it: it opens on the same closed-choice word and cites exactly the same sources. */
export class RewordCheck {
  static keeps(original: string, rewrite: string, rule?: FieldRule): boolean {
    Trace.line(import.meta.url, "RewordCheck.keeps", { chars: rewrite.length });
    if (rule?.kind === "one_of" && RewordCheck.firstWord(original) !== RewordCheck.firstWord(rewrite)) return false;
    const before = RewordCheck.sourceIds(original);
    const after = RewordCheck.sourceIds(rewrite);
    return before.length === after.length && before.every((id, i) => id === after[i]);
  }

  static sourceIds(text: string): string[] {
    Trace.line(import.meta.url, "RewordCheck.sourceIds", { chars: text.length });
    return [...new Set([...text.matchAll(SOURCE_ID)].map((match) => match[1] ?? match[2]!))].sort();
  }

  private static firstWord(text: string): string {
    Trace.line(import.meta.url, "RewordCheck.firstWord");
    return text.trim().toLowerCase().split(/[^a-z0-9]+/)[0] ?? "";
  }
}
