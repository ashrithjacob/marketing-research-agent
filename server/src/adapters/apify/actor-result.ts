import type { ActorRun } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

/** Reads an actor's dataset. A run that did not succeed, or succeeded with nothing in it, is a failure to read, never an empty answer: a blocked page can fetch successfully. */
export class ActorResult {
  static items(run: ActorRun, actor: string): Array<Record<string, unknown>> {
    Trace.line(import.meta.url, "ActorResult.items", { actor, status: run.status, items: run.items.length });
    if (run.status !== "SUCCEEDED") throw new Error(`${actor} ended ${run.status} with ${run.items.length} results`);
    if (run.items.length === 0) throw new Error(`${actor} succeeded with an empty dataset, which is a failure to read, not "no results"`);
    return run.items;
  }

  static number(value: unknown): number | null {
    Trace.tick(import.meta.url, "ActorResult.number");
    const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value.replace(/[^0-9.]/g, "")) : NaN;
    return Number.isFinite(parsed) && !(typeof value === "string" && value.trim() === "") ? parsed : null;
  }
}
