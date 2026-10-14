import { Trace } from "../trace/index.js";

export type BreakerName = "refused_finish" | "no_progress" | "step_ceiling" | "spend_cap" | "time_cap";

/** A breaker that tripped, and the words a gap, a status row and a repair use for it. */
export interface Trip {
  breaker: BreakerName;
  status: string;
  gap: string;
  at: string;
}

/** What has happened so far in one agent's or task's work; null where nothing bounds it. */
export interface BreakerReadings {
  responses: number;
  quietResponses: number;
  refusedFinishes: number;
  spentUsd: number | null;
  minutes: number | null;
}

export interface BreakerLimits {
  stepCeiling: number;
  maxUsd: number | null;
  maxMinutes: number | null;
}

export const REFUSED_FINISH_LIMIT = 3;
export const QUIET_RESPONSE_LIMIT = 5;
export const CEILING_WARNING = 0.8;

/** The four circuit breakers of spec §3.2: whichever trips first ends the work, partly done, never as complete. */
export class Breakers {
  static trip(readings: BreakerReadings, limits: BreakerLimits): Trip | null {
    Trace.line(import.meta.url, "Breakers.trip", { readings, limits });
    if (readings.refusedFinishes >= REFUSED_FINISH_LIMIT) {
      return Breakers.said("refused_finish", `finish was refused ${REFUSED_FINISH_LIMIT} times`);
    }
    if (readings.quietResponses >= QUIET_RESPONSE_LIMIT) {
      return Breakers.said("no_progress", `${QUIET_RESPONSE_LIMIT} responses in a row added nothing new`);
    }
    if (readings.responses >= limits.stepCeiling) {
      return { breaker: "step_ceiling", status: `the ${limits.stepCeiling}-turn limit was reached`, gap: `not found within the ${limits.stepCeiling}-turn limit`, at: `at the ${limits.stepCeiling}-turn limit` };
    }
    if (limits.maxUsd !== null && readings.spentUsd !== null && readings.spentUsd >= limits.maxUsd) {
      return Breakers.said("spend_cap", `the $${limits.maxUsd} spend cap was reached`);
    }
    if (limits.maxMinutes !== null && readings.minutes !== null && readings.minutes >= limits.maxMinutes) {
      return Breakers.said("time_cap", `the ${limits.maxMinutes}-minute time cap was reached`);
    }
    return null;
  }

  /** True on the one response at which the model is told to record what it has and finish. */
  static warnNow(responses: number, stepCeiling: number): boolean {
    Trace.line(import.meta.url, "Breakers.warnNow", { responses, stepCeiling });
    return responses === Math.floor(stepCeiling * CEILING_WARNING);
  }

  private static said(breaker: BreakerName, status: string): Trip {
    Trace.line(import.meta.url, "Breakers.said", { breaker });
    return { breaker, status, gap: `not found: ${status}`, at: `when ${status}` };
  }
}

/** Which ended runs hold a packet later work can build on. */
export class RunStatuses {
  static delivered(status: string): boolean {
    Trace.line(import.meta.url, "RunStatuses.delivered", { status });
    return status === "completed" || status === "partial";
  }
}
