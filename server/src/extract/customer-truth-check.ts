import { CHANNELS, CheckProblems, Findings, type CheckProblem, type Finding } from "../domain/index.js";
import { Trace } from "../trace/index.js";

/** What customer truth must hold across rows when an agent finishes: two to four top-level avatars, and awareness for every top-level avatar on every channel; pure. */
export class CustomerTruthCheck {
  static readonly AVATARS = { min: 2, max: 4 };

  static avatars(rows: readonly Finding[]): CheckProblem[] {
    Trace.line(import.meta.url, "CustomerTruthCheck.avatars", { rows: rows.length });
    const top = CustomerTruthCheck.topLevel(rows);
    const { min, max } = CustomerTruthCheck.AVATARS;
    if (top.length >= min && top.length <= max) return [];
    return [CheckProblems.of(`${top.length} top-level avatars recorded (${top.join(", ") || "none"}); record ${min} to ${max}, each with its sub-avatars under \`parent\``)];
  }

  static awareness(rows: readonly Finding[]): CheckProblem[] {
    Trace.line(import.meta.url, "CustomerTruthCheck.awareness", { rows: rows.length });
    const covered = new Set(Findings.live(rows).filter((row) => row.kind === "awareness").map((row) => `${String(row.payload.avatar_id)}:${String(row.payload.channel)}`));
    const open = CustomerTruthCheck.topLevel(rows).flatMap((avatar) => CHANNELS.filter((channel) => !covered.has(`${avatar}:${channel}`)).map((channel) => `${avatar} on ${channel}`));
    return open.length === 0 ? [] : [CheckProblems.of(`no awareness recorded for ${open.join(", ")}`)];
  }

  private static topLevel(rows: readonly Finding[]): string[] {
    Trace.line(import.meta.url, "CustomerTruthCheck.topLevel");
    const avatars = Findings.live(rows).filter((row) => row.kind === "avatar");
    return [...new Set(avatars.filter((row) => !row.payload.parent).map((row) => String(row.payload.id)))];
  }
}
