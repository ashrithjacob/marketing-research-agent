import type { Agent } from "@earendil-works/pi-agent-core";
import type { Api, Model, Models, SimpleStreamOptions } from "@earendil-works/pi-ai";

import type { Pricing } from "../adapters/index.js";
import { Trace } from "../trace/index.js";

import type { ModelPricing } from "./pricing.js";

type PayloadHook = NonNullable<SimpleStreamOptions["onPayload"]>;

/** A run's models in .env order — the primary, then its backups — priced, and which one is answering now. */
export class ModelChain {
  private position = 0;

  private constructor(
    private readonly models: readonly Model<Api>[],
    readonly pricing: Pricing,
  ) {}

  static resolve(
    ids: readonly string[],
    catalogue: Models,
    prices: ModelPricing,
  ): { chain: ModelChain } | { unknown: string } {
    Trace.line(import.meta.url, "ModelChain.resolve", { ids });
    const priced: { model: Model<Api>; pricing: Pricing }[] = [];
    for (const id of ids) {
      const listed = catalogue.getModel("openrouter", id);
      if (!listed) return { unknown: id };
      priced.push(prices.apply(listed));
    }
    return { chain: new ModelChain(priced.map((p) => p.model), priced[0]!.pricing) };
  }

  get current(): Model<Api> {
    Trace.line(import.meta.url, "ModelChain.current");
    return this.models[this.position]!;
  }

  get sequence(): readonly Model<Api>[] {
    Trace.line(import.meta.url, "ModelChain.sequence");
    return this.models;
  }

  fallbacksAfter(id: string): string[] {
    Trace.line(import.meta.url, "ModelChain.fallbacksAfter", { id });
    const index = this.models.findIndex((m) => m.id === id);
    return index < 0 ? [] : this.models.slice(index + 1).map((m) => m.id);
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
      const fallbacks = this.fallbacksAfter(model.id);
      return fallbacks.length > 0 ? { ...base, models: fallbacks } : base;
    };
  }
}
