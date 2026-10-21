import type { ActorLimits, ActorRun, ActorRunner, ChargeMeter } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

/** Charges every actor run to the run that caused it, as Apify billed it once the charge settled, even when the actor then failed. The lookup is handed to `defer` so the run waits for it before totalling its cost. */
export class MeteredActorRunner implements ActorRunner {
  constructor(
    private readonly inner: ActorRunner,
    private readonly meter: ChargeMeter,
    private readonly defer: (work: Promise<void>) => void,
  ) {}

  async run(actor: string, input: Record<string, unknown>, limits: ActorLimits, signal?: AbortSignal): Promise<ActorRun> {
    Trace.line(import.meta.url, "MeteredActorRunner.run", { actor });
    const result = await this.inner.run(actor, input, limits, signal);
    this.defer(this.inner.billed(result).then((usd) => this.meter.charge({ service: "apify", item: actor, units: result.items.length, usd, basis: "billed" })));
    return result;
  }

  billed(run: ActorRun): Promise<number | null> {
    Trace.line(import.meta.url, "MeteredActorRunner.billed", { runId: run.id });
    return this.inner.billed(run);
  }
}
