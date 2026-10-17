import { Trace } from "../trace/index.js";

export const STAGE_NAMES = ["product_market", "sophistication", "reviews", "competitor_ads", "avatars", "gaps", "generation"] as const;
export type StageName = (typeof STAGE_NAMES)[number];

export const STAGE_STATUSES = ["pending", "running", "completed", "invalid", "failed", "cancelled", "skipped", "not_built"] as const;
export type StageStatus = (typeof STAGE_STATUSES)[number];

export interface StagePlan {
  number: number;
  title: string;
  needs: readonly StageName[];
}

/** The seven stages of docs/spec.md and what each must wait for. Stage 4 waits for stage 1, whose brief its keywords come from (spec, 2026-10-17); avatars need all four. */
export const STAGE_PLANS: Readonly<Record<StageName, StagePlan>> = {
  product_market: { number: 1, title: "Product and market research", needs: [] },
  sophistication: { number: 2, title: "Market awareness and sophistication", needs: [] },
  reviews: { number: 3, title: "Review collection", needs: [] },
  competitor_ads: { number: 4, title: "Competitor long-form static ads", needs: ["product_market"] },
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

  static ended(state: StageState): boolean {
    Trace.line(import.meta.url, "Stages.ended", { status: state.status });
    return Stages.ENDED.has(state.status);
  }
}
