import type { AgentTurnDecision } from "@earendil-works/pi-agent-core";

import { Breakers, type BreakerLimits, type Trip } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import type { FinishTally } from "./tools/finish-tool.js";

/** One in-process agent's circuit breakers: counts its responses, the ones that added no row, and its refused finishes, and ends it at the first breaker that trips. */
export class TurnBreakers implements FinishTally {
  private responses = 0;
  private quiet = 0;
  private seen = 0;
  private refused = 0;
  private trip: Trip | null = null;

  constructor(
    private readonly limits: BreakerLimits,
    private readonly rowsWritten: () => Promise<number>,
  ) {}

  get refusedFinishes(): number {
    Trace.line(import.meta.url, "TurnBreakers.refusedFinishes", { refused: this.refused });
    return this.refused;
  }

  refuse(): void {
    Trace.line(import.meta.url, "TurnBreakers.refuse", { refused: this.refused });
    this.refused += 1;
  }

  readonly finishTurn = async (): Promise<AgentTurnDecision | undefined> => {
    Trace.line(import.meta.url, "TurnBreakers.finishTurn", { responses: this.responses, quiet: this.quiet });
    this.responses += 1;
    const rows = await this.rowsWritten();
    this.quiet = rows > this.seen ? 0 : this.quiet + 1;
    this.seen = rows;
    const readings = { responses: this.responses, quietResponses: this.quiet, refusedFinishes: this.refused, spentUsd: null, minutes: null };
    this.trip = Breakers.trip(readings, this.limits);
    return this.trip ? { action: "end" } : undefined;
  };

  get tripped(): Trip | null {
    Trace.line(import.meta.url, "TurnBreakers.tripped", { breaker: this.trip?.breaker ?? null });
    return this.trip;
  }

  get ceiling(): number {
    Trace.line(import.meta.url, "TurnBreakers.ceiling");
    return this.limits.stepCeiling;
  }
}
