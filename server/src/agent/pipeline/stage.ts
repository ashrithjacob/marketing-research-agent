import type { Competitor, Product, StageName } from "../../domain/index.js";

import type { RunContext } from "./run-context.js";

/** What a stage is handed: the run's context, and the product and confirmed competitors as they stand when it starts. */
export interface StageInput {
  context: RunContext;
  product: Product;
  competitors: readonly Competitor[];
}

export interface StageOutcome {
  status: "completed" | "invalid" | "failed";
  summary: string;
  error: string;
}

/** One of the seven stages of docs/spec.md. A stage reads what earlier stages stored and writes its own tables; the pipeline decides when it runs. */
export interface Stage {
  readonly name: StageName;
  run(input: StageInput): Promise<StageOutcome>;
}
