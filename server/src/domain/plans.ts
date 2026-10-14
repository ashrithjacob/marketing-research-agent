import type { Scope } from "./accounts.js";
import type { Brief } from "./brief.js";
import type { TaskContract } from "./task-contract.js";

/** One task a plan proposes: its contract, whether the owner keeps it, and the run it became once approved, or why it could not start. */
export interface PlanTask {
  key: string;
  title: string;
  contract: TaskContract;
  selected: boolean;
  run_id: string;
  error: string;
}

export type PlanStatus = "draft" | "approved";

/** What Start proposes for a brief: tasks the owner reviews, changes and approves. Nothing in it runs before approval. */
export interface Plan {
  id: string;
  workspace_id: string;
  brief: Brief;
  tasks: PlanTask[];
  status: PlanStatus;
  created_at: string;
  updated_at: string;
}

/** The plans of every workspace, newest first. */
export interface PlanBook {
  create(workspaceId: string, brief: Brief, tasks: readonly PlanTask[]): Promise<Plan>;
  get(scope: Scope, planId: string): Promise<Plan | null>;
  list(scope: Scope, limit: number): Promise<Plan[]>;
  save(plan: Plan): Promise<Plan>;
}
