import type { Judgement } from "./logs.js";
import type { RunRequest } from "./request.js";
import { DEFAULT_REJECTED_KINDS, type SourceKind } from "./vocabulary.js";

/** A judgement only ever adds; dropping a default takes an explicit reject_kinds on the request. */
export class RejectKinds {
  static effective(request: RunRequest, judgements: readonly Judgement[]): SourceKind[] {
    const kinds: SourceKind[] =
      request.reject_kinds.length > 0 ? [...request.reject_kinds] : [...DEFAULT_REJECTED_KINDS];
    for (const judgement of judgements) {
      for (const kind of judgement.rejects_kinds) {
        if (!kinds.includes(kind)) kinds.push(kind);
      }
    }
    return kinds;
  }
}
