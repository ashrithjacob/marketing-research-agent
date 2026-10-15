import type { Scope } from "./accounts.js";
import type { Brief } from "./brief.js";
import type { ProductTruthInputs } from "./product-truth-rows.js";
import type { TaskContract } from "./task-contract.js";

/** One task a plan proposes: its contract, whether it is kept (`auto`: by the plan, not the owner), the tasks it starts after, and the run it became once approved, or why it could not start. */
export interface PlanTask {
  key: string;
  title: string;
  contract: TaskContract;
  selected: boolean;
  auto: boolean;
  after: string[];
  run_id: string;
  error: string;
}

/** A later stage a plan runs once its stage-1 tasks have ended: product truth (2) and review mining (3), as the stage runs they are today, on the plan's combined stage-1 run. Review mining always waits for the owner's approval card, because it spends Apify money. */
export interface PlanStage {
  stage: 2 | 3;
  title: string;
  selected: boolean;
  run_id: string;
  error: string;
  inputs?: ProductTruthInputs;
}

export type PlanStatus = "draft" | "approved";

/** What Start proposes for a brief: tasks the owner reviews, changes and approves. Nothing in it runs before approval. */
export interface Plan {
  id: string;
  workspace_id: string;
  brief: Brief;
  tasks: PlanTask[];
  stages: PlanStage[];
  /** The one stage-1 run made from the plan's ended tasks, which later stages read; empty until then. */
  stage_one_run_id: string;
  status: PlanStatus;
  created_at: string;
  updated_at: string;
}

/** The plans of every workspace, newest first. */
export interface PlanBook {
  create(workspaceId: string, brief: Brief, tasks: readonly PlanTask[], stages?: readonly PlanStage[]): Promise<Plan>;
  get(scope: Scope, planId: string): Promise<Plan | null>;
  list(scope: Scope, limit: number): Promise<Plan[]>;
  save(plan: Plan): Promise<Plan>;
}
