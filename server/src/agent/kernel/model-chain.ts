import type { Agent } from "@earendil-works/pi-agent-core";
import type { Api, Model, Models, SimpleStreamOptions } from "@earendil-works/pi-ai";

import { Trace } from "../../trace/index.js";

type PayloadHook = NonNullable<SimpleStreamOptions["onPayload"]>;

/** A run's models in .env order, the primary then its backups: OpenRouter is asked to fall back through them, and a dropped stream moves the agent to the next one. */
export class ModelChain {
  private position = 0;

  private constructor(private readonly models: readonly Model<Api>[]) {}

  static resolve(ids: readonly string[], catalogue: Models): { chain: ModelChain } | { unknown: string } {
    Trace.line(import.meta.url, "ModelChain.resolve", { ids });
    const models: Model<Api>[] = [];
    for (const id of ids) {
      const listed = catalogue.getModel("openrouter", id);
      if (!listed) return { unknown: id };
      models.push(listed);
    }
    return { chain: new ModelChain(models) };
  }

  get current(): Model<Api> {
    Trace.line(import.meta.url, "ModelChain.current");
    return this.models[this.position]!;
  }

  /** The model after `model` in the chain, for one agent to move to on its own; null at the end. */
  after(model: Model<Api>): Model<Api> | null {
    Trace.line(import.meta.url, "ModelChain.after", { model: model.id });
    const index = this.models.findIndex((m) => m.id === model.id);
    return index < 0 ? null : (this.models[index + 1] ?? null);
  }

  failover(agent: Agent): { from: string; to: string } | null {
    Trace.line(import.meta.url, "ModelChain.failover", { position: this.position });
    if (this.position >= this.models.length - 1) return null;
    const from = this.current.id;
    this.position += 1;
    agent.state.model = this.current;
    return { from, to: this.current.id };
  }

  withFallbacks(previous?: PayloadHook): PayloadHook {
    Trace.line(import.meta.url, "ModelChain.withFallbacks");
    return async (payload, model) => {
      const base = ((await previous?.(payload, model)) ?? payload) as Record<string, unknown>;
      const index = this.models.findIndex((m) => m.id === model.id);
      const fallbacks = index < 0 ? [] : this.models.slice(index + 1).map((m) => m.id);
      return fallbacks.length > 0 ? { ...base, models: fallbacks } : base;
    };
  }
}
