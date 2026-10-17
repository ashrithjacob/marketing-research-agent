import type { AgentTurnContext, AgentTurnDecision } from "@earendil-works/pi-agent-core";

import { Trace } from "../../trace/index.js";

/** Ends an agent at its turn ceiling, and answers a turn that ends in text alone with a reminder to submit, at most twice. */
export class TurnPolicy {
  static readonly REMINDERS = 2;
  private turns = 0;
  private reminders = 0;

  constructor(
    private readonly maxTurns: number,
    private readonly submitted: () => boolean,
    private readonly remind: (text: string) => void,
  ) {}

  get reachedLimit(): boolean {
    Trace.line(import.meta.url, "TurnPolicy.reachedLimit", { turns: this.turns });
    return this.turns >= this.maxTurns;
  }

  readonly finishTurn = (turn: AgentTurnContext): AgentTurnDecision | undefined => {
    Trace.line(import.meta.url, "TurnPolicy.finishTurn", { turns: this.turns });
    this.turns += 1;
    if (this.submitted()) return { action: "end" };
    if (this.turns >= this.maxTurns) return { action: "end" };
    const calledTools = turn.toolResults.length > 0;
    if (!calledTools && turn.message.stopReason === "stop" && this.reminders < TurnPolicy.REMINDERS) {
      this.reminders += 1;
      this.remind("You have not called submit. Your work only counts once submit accepts it: call submit now, or keep researching and then submit.");
    }
    return undefined;
  };
}
