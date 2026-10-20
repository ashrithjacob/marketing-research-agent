import { z } from "zod/v4";

import { Trace } from "../trace/index.js";

export const STAGE_NAMES = ["product_market", "reviews", "competitor_ads", "sophistication", "avatars", "gaps", "generation"] as const;
export type StageName = (typeof STAGE_NAMES)[number];

export const STAGE_STATUSES = ["pending", "running", "completed", "invalid", "failed", "cancelled", "skipped", "not_built"] as const;
export type StageStatus = (typeof STAGE_STATUSES)[number];

export interface StagePlan {
  number: number;
  title: string;
  needs: readonly StageName[];
}

/** The seven stages of docs/spec.md and what each must wait for. Stage 3 waits for stage 1, whose brief and competitors brief its scout; stage 4 reads the market off stages 1 to 3 (docs/spec-stage4.md); avatars need all four. */
export const STAGE_PLANS: Readonly<Record<StageName, StagePlan>> = {
  product_market: { number: 1, title: "Product and market research", needs: [] },
  reviews: { number: 2, title: "Review collection", needs: [] },
  competitor_ads: { number: 3, title: "Competitor long-form static ads", needs: ["product_market"] },
  sophistication: { number: 4, title: "Market awareness and sophistication", needs: ["product_market", "reviews", "competitor_ads"] },
  avatars: { number: 5, title: "Avatar and sub-avatar synthesis", needs: ["product_market", "sophistication", "reviews", "competitor_ads"] },
  gaps: { number: 6, title: "Gap detection", needs: ["avatars"] },
  generation: { number: 7, title: "Long-form static generation", needs: ["gaps"] },
};

export interface StageState {
  status: StageStatus;
  started_at: string;
  ended_at: string;
  error: string;
  summary: string;
}

export type StageStates = Record<StageName, StageState>;

export class Stages {
  static readonly ENDED: ReadonlySet<StageStatus> = new Set(["completed", "invalid", "failed", "cancelled", "skipped", "not_built"]);

  static initial(built: readonly StageName[]): StageStates {
    Trace.line(import.meta.url, "Stages.initial", { built });
    const blank = { started_at: "", ended_at: "", error: "", summary: "" };
    return Object.fromEntries(
      STAGE_NAMES.map((name) => [name, { ...blank, status: built.includes(name) ? "pending" : "not_built" }]),
    ) as StageStates;
  }

  /** A run's stages set up to run again: each stage in `rerunning` waits to run, every other built stage keeps its state, and a stage not built is marked so. */
  static rerun(states: StageStates, built: readonly StageName[], rerunning: readonly StageName[]): StageStates {
    Trace.line(import.meta.url, "Stages.rerun", { built, rerunning });
    const blank = { started_at: "", ended_at: "", error: "", summary: "" };
    return Object.fromEntries(
      STAGE_NAMES.map((name) => {
        if (!built.includes(name)) return [name, { ...blank, status: "not_built" }];
        return [name, rerunning.includes(name) || !states[name] ? { ...blank, status: "pending" } : states[name]];
      }),
    ) as StageStates;
  }

  /** The built stages that did not complete. */
  static unfinished(states: StageStates, built: readonly StageName[]): StageName[] {
    Trace.line(import.meta.url, "Stages.unfinished", { built });
    return built.filter((name) => states[name]?.status !== "completed");
  }

  /** A stage and every built stage that uses it, however indirectly: what has to run again when it does, because their input changes. */
  static downstream(name: StageName, built: readonly StageName[]): StageName[] {
    Trace.line(import.meta.url, "Stages.downstream", { name });
    const reached = new Set<StageName>([name]);
    for (let grew = true; grew; ) {
      grew = false;
      for (const other of built) {
        if (reached.has(other) || !STAGE_PLANS[other].needs.some((need) => reached.has(need))) continue;
        reached.add(other);
        grew = true;
      }
    }
    return STAGE_NAMES.filter((stage) => reached.has(stage) && built.includes(stage));
  }

  /** What a rerun of the chosen stages runs: each of them and everything downstream, plus every stage that did not complete; with nothing chosen, only the stages that did not complete. */
  static toRerun(states: StageStates, built: readonly StageName[], chosen: readonly StageName[]): StageName[] {
    Trace.line(import.meta.url, "Stages.toRerun", { chosen });
    const picked = new Set([...Stages.unfinished(states, built), ...chosen.flatMap((name) => Stages.downstream(name, built))]);
    return STAGE_NAMES.filter((name) => picked.has(name));
  }

  static ended(state: StageState): boolean {
    Trace.line(import.meta.url, "Stages.ended", { status: state.status });
    return Stages.ENDED.has(state.status);
  }
}

/** A rerun request: the stages to run again; none means every stage that did not complete. */
export const RerunRequestSchema = z.object({ stages: z.array(z.enum(STAGE_NAMES)).default([]) });
export type RerunRequest = z.infer<typeof RerunRequestSchema>;
