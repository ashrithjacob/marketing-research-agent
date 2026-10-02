import { Trace } from "../trace/index.js";

/** A competitor sells to the champion's customer: the agent that read both pages judges the match, code checks both sides wrote down who that customer is. */
export class CompetitorIcp {
  static problems(label: string, icpAsPrinted: string, championIcp: string): string[] {
    Trace.line(import.meta.url, "CompetitorIcp.problems", { label });
    const problems: string[] = [];
    if (!championIcp.trim()) {
      problems.push(`the champion records no icp, so nothing says who ${label} must be sold to — the champion agent records it with record_reference`);
    }
    if (!icpAsPrinted.trim()) {
      problems.push(
        `${label} has no icp_as_printed — copy who its own page says it is for and what it treats; ` +
          `a product for other people or another problem than the champion's (${championIcp || "its icp"}) is not a competitor`,
      );
    }
    return problems;
  }
}
