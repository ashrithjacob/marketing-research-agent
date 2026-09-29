import {
  CODE_ID_KINDS,
  FINDING_SCHEMAS,
  type FindingKind,
  type Node,
} from "../domain/index.js";
import { Trace } from "../trace/index.js";

import { PacketDraft } from "./draft.js";
import { ZodProblems } from "./validator.js";

const COMPETITOR_KINDS: ReadonlySet<FindingKind> = new Set(["competitor", "competitor_reference", "candidate"]);

/** One record, checked when it is written: its section's schema, and a node this run covers. */
export class FindingCheck {
  static check(
    kind: FindingKind,
    item: unknown,
    scope: readonly Node[],
  ): { payload: Record<string, unknown> } | { problems: string } {
    Trace.line(import.meta.url, "FindingCheck.check", { kind, item });
    const coerced = PacketDraft.coerce(item);
    if ("unparseable" in coerced) {
      return { problems: "the item did not decode to one JSON object — pass the record itself, not prose" };
    }
    const { id: _assigned, ...rest } = coerced.draft;
    const draft = CODE_ID_KINDS.has(kind) ? rest : coerced.draft;
    const parsed = FINDING_SCHEMAS[kind].safeParse(draft);
    if (!parsed.success) return { problems: ZodProblems.readable(parsed.error) };
    const payload = parsed.data as Record<string, unknown>;
    const node = COMPETITOR_KINDS.has(kind) ? "competitors" : String(payload.node ?? "");
    if (!scope.includes(node as Node)) {
      return {
        problems: `this belongs to ${node}, which is outside this run's scope (${scope.join(", ")})`,
      };
    }
    return { payload };
  }
}
