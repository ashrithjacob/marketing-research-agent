import type { AgentTurnDecision } from "@earendil-works/pi-agent-core";

import { Trace } from "../trace/index.js";

/** How many model turns one agent may take; pi-agent-core's finishTurn hook ends it on the last. */
export class TurnBudget {
  private used = 0;

  constructor(readonly limit: number) {}

  readonly finishTurn = (): AgentTurnDecision | undefined => {
    Trace.line(import.meta.url, "TurnBudget.finishTurn", { used: this.used, limit: this.limit });
    this.used += 1;
    return this.used >= this.limit ? { action: "end" } : undefined;
  };

  get spent(): boolean {
    Trace.line(import.meta.url, "TurnBudget.spent", { used: this.used, limit: this.limit });
    return this.used >= this.limit;
  }
}
