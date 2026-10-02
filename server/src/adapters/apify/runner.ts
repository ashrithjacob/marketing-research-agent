import type { Settings } from "../../config/index.js";
import type { ChargeMeter } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

/** Apify said the account is out of credit: a billing limit, not an absence of reviews, and not worth retrying. */
export class ApifyCreditError extends Error {
  constructor(actorId: string) {
    super(
      `Apify returned 402 for ${actorId}: the account is out of credit. ` +
        "This is a billing limit, not an absence of reviews.",
    );
    Trace.line(import.meta.url, "ApifyCreditError.constructor", { actorId });
    this.name = "ApifyCreditError";
  }
}

export interface ActorRun {
  status: string;
  items: Array<Record<string, unknown>>;
  /** What Apify charged for this actor run — platform usage plus pay-per-event charges. */
  usageUsd?: number | null;
}

export interface ActorRunner {
  run(
    actorId: string,
    input: Record<string, unknown>,
    maxTotalChargeUsd: number,
    signal?: AbortSignal,
  ): Promise<ActorRun>;
}

/** Reports every actor run's charge, as Apify billed it, so a run's crawler spend is known even when the tool then fails. */
export class MeteredActorRunner implements ActorRunner {
  constructor(
    private readonly inner: ActorRunner,
    private readonly meter: ChargeMeter,
  ) {}

  async run(
    actorId: string,
    input: Record<string, unknown>,
    maxTotalChargeUsd: number,
    signal?: AbortSignal,
  ): Promise<ActorRun> {
    Trace.line(import.meta.url, "MeteredActorRunner.run", { actorId, input, maxTotalChargeUsd });
    const result = await this.inner.run(actorId, input, maxTotalChargeUsd, signal);
    if (typeof result.usageUsd === "number" && Number.isFinite(result.usageUsd)) {
      this.meter.charge({ service: "apify", item: actorId, units: 1, usd: result.usageUsd, basis: "billed" });
    }
    return result;
  }
}

/** Runs an actor and waits for it; a run still going when the wait ends is waited on again, not restarted, so it is not charged twice. */
export class ApifyActorRunner implements ActorRunner {
  static readonly STILL_GOING: ReadonlySet<string> = new Set(["READY", "RUNNING"]);

  constructor(
    private readonly token: string,
    private readonly timeoutSeconds: number,
    private readonly extraWaits = 1,
  ) {}

  async run(
    actorId: string,
    input: Record<string, unknown>,
    maxTotalChargeUsd: number,
    signal?: AbortSignal,
  ): Promise<ActorRun> {
    Trace.line(import.meta.url, "ApifyActorRunner.run", { actorId, input, maxTotalChargeUsd });
    if (!this.token) {
      throw new Error("APIFY_TOKEN is not set — review mining cannot reach Amazon or Trustpilot");
    }
    const { ApifyClient } = await import("apify-client");
    const client = new ApifyClient({ token: this.token });

    let run: { id: string; status: string; defaultDatasetId: string; usageTotalUsd?: number };
    try {
      run = (await client.actor(actorId).call(input, {
        maxTotalChargeUsd,
        waitSecs: this.timeoutSeconds,
      })) as typeof run;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 402) throw new ApifyCreditError(actorId);
      throw error;
    }
    for (let wait = 0; wait < this.extraWaits && ApifyActorRunner.STILL_GOING.has(run.status); wait++) {
      signal?.throwIfAborted();
      run = (await client.run(run.id).waitForFinish({ waitSecs: this.timeoutSeconds })) as typeof run;
    }
    signal?.throwIfAborted();
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    return {
      status: run.status,
      items: items as Array<Record<string, unknown>>,
      usageUsd: typeof run.usageTotalUsd === "number" ? run.usageTotalUsd : null,
    };
  }
}

/** No token means no review route at all, so the tools are withheld rather than stubbed. */
export class ActorRunners {
  static forSettings(settings: Settings): ActorRunner | null {
    Trace.line(import.meta.url, "ActorRunners.forSettings", { settings });
    if (!settings.apifyToken) return null;
    return new ApifyActorRunner(settings.apifyToken, settings.apifyWaitSeconds, settings.apifyPullRetries);
  }
}
