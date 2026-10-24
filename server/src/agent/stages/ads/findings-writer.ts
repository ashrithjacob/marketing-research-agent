import { AdFindingsSchema, type AdFindings, type AdsAnalysis } from "../../../domain/index.js";
import { Trace } from "../../../trace/index.js";
import type { AgentResult } from "../../kernel/agent-runner.js";
import type { RunContext } from "../../pipeline/run-context.js";
import { FINDINGS_WRITER_SYSTEM } from "../../prompt/text/ad-analysis.js";

/** One agent call, given the counted tables and not the ads, that writes one finding per step; code checks every subject and ad exists and that no headline carries a digit, so every number on the page is one code counted (docs/spec-ads-analysis.md D8). */
export class FindingsWriter {
  static readonly AGENT_ID = "ads_findings";
  static readonly MAX_TURNS = 4;
  static readonly TABLES: Readonly<Record<number, (analysis: AdsAnalysis) => string>> = {
    2: (a) => ["Step 2, proven against popular. Angle | ads | proven | brands | median days | longest days", ...a.angles.map((r) => `${r.key} (${r.name}) | ${r.ads} | ${r.proven} | ${r.brands.length} | ${r.median_days ?? "?"} | ${r.longest_days ?? "?"}`)].join("\n"),
    3: (a) => [
      "Step 3, what is being launched now. Angle | launched in 30 days | in 60 days | trend",
      ...a.angles.map((r) => `${r.key} | ${r.launched_30d} | ${r.launched_60d} | ${r.trend}`),
      "Brand | competitor | kept ads | proven | launched in 60 days",
      ...a.brands.map((b) => `${b.domain} | ${b.competitor ? "yes" : "no"} | ${b.ads} | ${b.proven} | ${b.launched_60d}`),
    ].join("\n"),
    4: (a) => ["Step 4, proven ads against the rest. label:value | share of proven | share of the rest | difference in points", ...a.labels.filter((r) => r.ranked).map((r) => `${r.label}:${r.value} | ${FindingsWriter.pct(r.proven_share)} | ${FindingsWriter.pct(r.rest_share)} | ${Math.round(r.difference * 100)}`)].join("\n"),
    5: (a) => ["Step 5, can the client run it. Angle | proven | verdict | share of proven ads with a risky claim | why", ...a.angles.map((r) => `${r.key} | ${r.proven} | ${r.fit ?? "unjudged"} | ${r.risk_share === null ? "-" : FindingsWriter.pct(r.risk_share)} | ${r.fit_why ?? ""}`)].join("\n"),
  };

  async write(context: RunContext, analysis: AdsAnalysis, steps: readonly number[], adIds: readonly string[]): Promise<AgentResult<AdFindings>> {
    Trace.line(import.meta.url, "FindingsWriter.write", { steps });
    const subjects = FindingsWriter.subjects(analysis);
    const tables = steps.map((step) => FindingsWriter.TABLES[step]?.(analysis) ?? "").filter((table) => table !== "");
    const examples = analysis.angles.map((angle) => `${angle.key}: ${angle.hooks.map((hook) => hook.ad_id).join(", ")}`);
    return context.agent({
      agentId: FindingsWriter.AGENT_ID,
      system: FINDINGS_WRITER_SYSTEM,
      instructions: [`Counted tables for steps ${steps.join(", ")}. Write one finding for each of those steps.`, ...tables, `Ads to cite, by angle:\n${examples.join("\n")}`].join("\n\n"),
      tools: [],
      maxTurns: FindingsWriter.MAX_TURNS,
      submission: { schema: AdFindingsSchema, describe: "Hand back one finding per step.", check: (findings) => FindingsWriter.problems(findings, steps, subjects, adIds) },
    });
  }

  static problems(findings: AdFindings, steps: readonly number[], subjects: ReadonlySet<string>, adIds: readonly string[]): string[] {
    Trace.line(import.meta.url, "FindingsWriter.problems", { findings: findings.findings.length });
    const written = findings.findings.map((finding) => finding.step);
    const problems = steps.filter((step) => !written.includes(step)).map((step) => `step ${step} has no finding`);
    problems.push(...written.filter((step, i) => !steps.includes(step) || written.indexOf(step) !== i).map((step) => `step ${step} was not asked for, or is written twice`));
    for (const finding of findings.findings) {
      if (/\d/.test(finding.headline)) problems.push(`step ${finding.step}'s headline has a digit; leave numbers to the page`);
      problems.push(...finding.subjects.filter((subject) => !subjects.has(subject)).map((subject) => `step ${finding.step} names ${subject}, which is not in the tables`));
      problems.push(...finding.ad_ids.filter((id) => !adIds.includes(id)).map((id) => `step ${finding.step} cites ad ${id}, which does not exist`));
    }
    return problems;
  }

  static subjects(analysis: AdsAnalysis): Set<string> {
    Trace.line(import.meta.url, "FindingsWriter.subjects", { angles: analysis.angles.length });
    return new Set([...analysis.angles.map((a) => a.key), ...analysis.labels.map((l) => `${l.label}:${l.value}`), ...analysis.brands.map((b) => b.domain)]);
  }

  private static pct(share: number): string {
    Trace.tick(import.meta.url, "FindingsWriter.pct");
    return `${Math.round(share * 100)}%`;
  }
}
