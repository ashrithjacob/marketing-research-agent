import type { ActorLimits, ActorRun, ActorRunner, ChargeMeter } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

/** Charges every actor run to the run that caused it, as Apify billed it, even when the actor then failed. */
export class MeteredActorRunner implements ActorRunner {
  constructor(
    private readonly inner: ActorRunner,
    private readonly meter: ChargeMeter,
  ) {}

  async run(actor: string, input: Record<string, unknown>, limits: ActorLimits, signal?: AbortSignal): Promise<ActorRun> {
    Trace.line(import.meta.url, "MeteredActorRunner.run", { actor });
    const result = await this.inner.run(actor, input, limits, signal);
    await this.meter.charge({ service: "apify", item: actor, units: result.items.length, usd: result.usd, basis: "billed" });
    return result;
  }
}
