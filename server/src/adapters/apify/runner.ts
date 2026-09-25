import type { Settings } from "../../config/index.js";

export interface ActorRun {
  status: string;
  items: Array<Record<string, unknown>>;
  /** What Apify charged for this actor run — platform usage plus pay-per-event charges. */
  usageUsd?: number | null;
}

export interface ActorCharge {
  actor: string;
  usd: number;
  status: string;
}

export interface ActorRunner {
  run(
    actorId: string,
    input: Record<string, unknown>,
    maxTotalChargeUsd: number,
    signal?: AbortSignal,
  ): Promise<ActorRun>;
}

/** Reports every actor run's charge, so a run's crawler spend is known even when the tool then fails. */
export class MeteredActorRunner implements ActorRunner {
  constructor(
    private readonly inner: ActorRunner,
    private readonly onCharge: (charge: ActorCharge) => void,
  ) {}

  async run(
    actorId: string,
    input: Record<string, unknown>,
    maxTotalChargeUsd: number,
    signal?: AbortSignal,
  ): Promise<ActorRun> {
    const result = await this.inner.run(actorId, input, maxTotalChargeUsd, signal);
    if (typeof result.usageUsd === "number" && Number.isFinite(result.usageUsd)) {
      this.onCharge({ actor: actorId, usd: result.usageUsd, status: result.status });
    }
    return result;
  }
}

export class ApifyActorRunner implements ActorRunner {
  constructor(
    private readonly token: string,
    private readonly timeoutSeconds: number,
  ) {}

  async run(
    actorId: string,
    input: Record<string, unknown>,
    maxTotalChargeUsd: number,
    signal?: AbortSignal,
  ): Promise<ActorRun> {
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
      if (status === 402) {
        throw new Error(
          `Apify returned 402 for ${actorId}: the account is out of credit. ` +
            "This is a billing limit, not an absence of reviews.",
        );
      }
      throw error;
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
    if (!settings.apifyToken) return null;
    return new ApifyActorRunner(settings.apifyToken, settings.apifyWaitSeconds);
  }
}
