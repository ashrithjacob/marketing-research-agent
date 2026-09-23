import type { Settings } from "../../config/index.js";

export interface ActorRunner {
  run(
    actorId: string,
    input: Record<string, unknown>,
    maxTotalChargeUsd: number,
    signal?: AbortSignal,
  ): Promise<{ status: string; items: Array<Record<string, unknown>> }>;
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
  ): Promise<{ status: string; items: Array<Record<string, unknown>> }> {
    if (!this.token) {
      throw new Error("APIFY_TOKEN is not set — review mining cannot reach Amazon or Trustpilot");
    }
    const { ApifyClient } = await import("apify-client");
    const client = new ApifyClient({ token: this.token });

    let run: { id: string; status: string; defaultDatasetId: string };
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
    return { status: run.status, items: items as Array<Record<string, unknown>> };
  }
}

/** No token means no review route at all, so the tools are withheld rather than stubbed. */
export class ActorRunners {
  static forSettings(settings: Settings): ActorRunner | null {
    if (!settings.apifyToken) return null;
    return new ApifyActorRunner(settings.apifyToken, settings.apifyWaitSeconds);
  }
}
