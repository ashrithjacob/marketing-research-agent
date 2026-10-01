import { CheckProblems, type CheckProblem, type Finding } from "../domain/index.js";
import { Trace } from "../trace/index.js";

/** Every product-truth row cites a source recorded in the run's ledger, so what it says can be re-read from the archived page. */
export class TruthCitations {
  static problems(own: readonly Finding[], live: readonly Finding[]): CheckProblem[] {
    Trace.line(import.meta.url, "TruthCitations.problems", { own: own.length });
    const recorded = new Set(live.filter((row) => row.kind === "source").map((row) => String(row.payload.id ?? "")));
    return own
      .filter((row) => row.kind !== "source" && row.kind !== "gap")
      .flatMap((row) => {
        const cited = Array.isArray(row.payload.source_ids) ? (row.payload.source_ids as string[]) : [String(row.payload.source_id ?? "")];
        return cited
          .filter((id) => !recorded.has(id))
          .map((id) => CheckProblems.at(row.kind, row.payload, `${row.kind} ${row.id} cites source '${id}', which no one recorded with record_source`));
      });
  }
}
