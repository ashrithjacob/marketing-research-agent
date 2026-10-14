import type { Agent } from "@earendil-works/pi-agent-core";

import type { DoneCheck } from "./done-check.js";
import type { LimitClosed } from "./limit-close.js";
import type { ToolSteps } from "./tool-steps.js";
import type { Trip } from "../domain/index.js";

import type { TurnBreakers } from "./turn-breakers.js";

/** One agent ready to drive: its first message, its finish check, its breakers, and what closes it when one trips. */
export interface BuiltAgent {
  agent: Agent;
  instructions: string;
  steps: ToolSteps;
  check: DoneCheck;
  breakers: TurnBreakers;
  closeOnLimit: ((trip: Trip) => Promise<LimitClosed>) | null;
}
