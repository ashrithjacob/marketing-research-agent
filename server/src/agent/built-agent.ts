import type { Agent } from "@earendil-works/pi-agent-core";

import type { DoneCheck } from "./done-check.js";
import type { LimitClosed } from "./limit-close.js";
import type { ToolSteps } from "./tool-steps.js";
import type { TurnBudget } from "./turn-budget.js";

/** One agent ready to drive: its first message, its finish check, its turn budget, and what closes it at the limit. */
export interface BuiltAgent {
  agent: Agent;
  instructions: string;
  steps: ToolSteps;
  check: DoneCheck;
  budget: TurnBudget;
  closeOnLimit: (() => LimitClosed) | null;
}
