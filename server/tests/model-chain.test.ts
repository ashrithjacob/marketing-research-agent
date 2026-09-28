/** The model chain: the .env primary and backups, resolved once, handed to OpenRouter as fallbacks, and advanced on a failed stream. */
import { createModels } from "@earendil-works/pi-ai";
import { fauxProvider } from "@earendil-works/pi-ai/providers/faux";
import { describe, expect, it } from "vitest";

import { OpenRouterPrices } from "../src/adapters/index.js";
import { ModelChain } from "../src/agent/model-chain.js";
import { ModelPricing } from "../src/agent/pricing.js";

const catalogue = () => {
  const models = createModels();
  models.setProvider(fauxProvider({ provider: "openrouter", models: [{ id: "a/one" }, { id: "b/two" }, { id: "c/three" }] }).provider);
  return models;
};
const pricing = new ModelPricing(new OpenRouterPrices({ apiKey: "" }));
const chainOf = (ids: string[]) => {
  const resolved = ModelChain.resolve(ids, catalogue(), pricing);
  if ("unknown" in resolved) throw new Error(`unexpected unknown ${resolved.unknown}`);
  return resolved.chain;
};

describe("ModelChain", () => {
  it("names the first id the catalogue does not know, backups included", () => {
    expect(ModelChain.resolve(["a/one", "x/missing", "c/three"], catalogue(), pricing)).toEqual({ unknown: "x/missing" });
  });

  it("sends the models after the one answering as OpenRouter's fallbacks, and none from the last", async () => {
    const chain = chainOf(["a/one", "b/two", "c/three"]);
    const hook = chain.withFallbacks(async (payload) => ({ ...(payload as object), seen: true }));
    expect(await hook({ model: "a/one" }, chain.current)).toEqual({ model: "a/one", seen: true, models: ["b/two", "c/three"] });
    expect(await hook({ model: "c/three" }, { ...chain.current, id: "c/three" })).toEqual({ model: "c/three", seen: true });
  });

  it("moves the agent to the next model on each failover, then stays on the last", () => {
    const chain = chainOf(["a/one", "b/two", "c/three"]);
    const agent = { state: { model: chain.current } } as any;
    expect(chain.failover(agent)).toEqual({ from: "a/one", to: "b/two" });
    expect(agent.state.model.id).toBe("b/two");
    expect(chain.failover(agent)).toEqual({ from: "b/two", to: "c/three" });
    expect(chain.failover(agent)).toBeNull();
    expect(agent.state.model.id).toBe("c/three");
  });

  it("does nothing without backups", () => {
    const chain = chainOf(["a/one"]);
    expect(chain.failover({ state: { model: chain.current } } as any)).toBeNull();
    expect(chain.fallbacksAfter("a/one")).toEqual([]);
  });
});
