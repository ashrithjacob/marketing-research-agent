import { Trace } from "../../trace/index.js";

import type { FinishTally } from "../tools/finish-tool.js";

/** A task's refused finishes, starting from what the store already counted, so a restart does not reset the breaker. */
export class CountedTally implements FinishTally {
  constructor(private refused: number) {}

  get refusedFinishes(): number {
    Trace.line(import.meta.url, "CountedTally.refusedFinishes", { refused: this.refused });
    return this.refused;
  }

  refuse(): void {
    Trace.line(import.meta.url, "CountedTally.refuse", { refused: this.refused });
    this.refused += 1;
  }
}
