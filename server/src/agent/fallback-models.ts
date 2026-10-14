import type { Api, Context, Model, Models, SimpleStreamOptions } from "@earendil-works/pi-ai";

import { Trace } from "../trace/index.js";

type StreamSimple = Models["streamSimple"];

/** The harness's models with the backup chain of spec §9.3: every OpenRouter request carries the models after it as OpenRouter's fallback list, and once a conversation's attempt fails its retry goes to the next model in the chain. */
export class FallbackModels {
  private readonly failures = new Map<string, number>();

  private constructor(
    private readonly inner: Models,
    private readonly chain: readonly string[],
  ) {}

  /** `inner` itself, but for `streamSimple`: pi-durable calls only that, and everything else passes through untouched. */
  static wrap(inner: Models, chain: readonly string[]): Models {
    Trace.line(import.meta.url, "FallbackModels.wrap", { chain });
    const fallbacks = new FallbackModels(inner, chain);
    const streamSimple: StreamSimple = (model, context, options) => fallbacks.streamSimple(model, context, options);
    return new Proxy(inner, { get: (target, key, receiver) => (key === "streamSimple" ? streamSimple : Reflect.get(target, key, receiver)) });
  }

  private streamSimple(model: Model<Api>, context: Context, options?: Parameters<StreamSimple>[2]): ReturnType<StreamSimple> {
    Trace.line(import.meta.url, "FallbackModels.streamSimple", { model: model.id, provider: model.provider });
    if (model.provider !== "openrouter") return this.inner.streamSimple(model, context, options);
    const session = options?.sessionId ?? "";
    const picked = this.next(model, this.failures.get(session) ?? 0);
    const stream = this.inner.streamSimple(picked, context, { ...options, onPayload: this.withFallbacks(options?.onPayload) });
    void stream.result().then(
      (message) => (message.stopReason === "error" ? this.failures.set(session, (this.failures.get(session) ?? 0) + 1) : this.failures.delete(session)),
      () => this.failures.set(session, (this.failures.get(session) ?? 0) + 1),
    );
    return stream;
  }

  /** After `failed` failed attempts, the model that many places down the chain from the one asked for; the last one once the chain runs out. */
  private next(model: Model<Api>, failed: number): Model<Api> {
    Trace.line(import.meta.url, "FallbackModels.next", { model: model.id, failed });
    const at = this.chain.indexOf(model.id);
    if (failed === 0 || at < 0) return model;
    const id = this.chain[Math.min(at + failed, this.chain.length - 1)]!;
    return this.inner.getModel("openrouter", id) ?? model;
  }

  private withFallbacks(previous: SimpleStreamOptions["onPayload"]): NonNullable<SimpleStreamOptions["onPayload"]> {
    Trace.line(import.meta.url, "FallbackModels.withFallbacks");
    return async (payload, model) => {
      const base = ((await previous?.(payload, model)) ?? payload) as Record<string, unknown>;
      const at = this.chain.indexOf(model.id);
      const after = at < 0 ? [] : this.chain.slice(at + 1);
      return after.length > 0 ? { ...base, models: after } : base;
    };
  }
}
