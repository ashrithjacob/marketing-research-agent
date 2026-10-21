import type { Competitor, Product, Run } from "../src/domain/index.js";
import type { App } from "../src/http/index.js";

export type View = { run: Run; product: Product | null; competitors: Competitor[] };

/** Drives a run through the http routes the way the cockpit does: start, wait for a status, confirm. */
export class RunDriver {
  constructor(private readonly app: App) {}

  async api(path: string, body?: unknown): Promise<Response> {
    const init = body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
    return this.app.fetch(new Request(`http://test/api/research${path}`, init));
  }

  async delete(runId: string): Promise<Response> {
    return this.app.fetch(new Request(`http://test/api/research/runs/${runId}`, { method: "DELETE" }));
  }

  async json<T>(path: string): Promise<T> {
    return (await (await this.api(path)).json()) as T;
  }

  async view(runId: string): Promise<View> {
    return this.json<View>(`/runs/${runId}`);
  }

  async start(input: Record<string, unknown>): Promise<string> {
    const response = await this.api("/runs", input);
    if (response.status !== 201) throw new Error(`start refused: ${response.status} ${await response.text()}`);
    return ((await response.json()) as { run: Run }).run.id;
  }

  async settle(runId: string, statuses: readonly string[]): Promise<View> {
    for (let i = 0; i < 600; i++) {
      const seen = await this.view(runId);
      if (statuses.includes(seen.run.status)) return seen;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`run ${runId} never reached ${statuses.join("/")}: ${(await this.view(runId)).run.status}`);
  }

  async confirmAndFinish(runId: string, confirmation: unknown): Promise<View> {
    await this.settle(runId, ["awaiting_confirmation"]);
    const confirmed = await this.api(`/runs/${runId}/confirm`, confirmation);
    if (confirmed.status !== 200) throw new Error(`confirm refused: ${await confirmed.text()}`);
    return this.settle(runId, ["completed", "invalid", "failed", "cancelled"]);
  }
}
