import { createModels, type AssistantMessage, type Model } from "@earendil-works/pi-ai";
import { fauxAssistantMessage, fauxProvider, type FauxResponseStep } from "@earendil-works/pi-ai/providers/faux";
import { describe, expect, it } from "vitest";

import { FallbackModels } from "../src/agent/index.js";

const CHAIN = ["primary", "backup-1", "backup-2"];

describe("the harness's backup models", () => {
  it("send each request with the models after it as OpenRouter's fallback list, and retry a failed conversation on the next model", async () => {
    const faux = fauxProvider({ provider: "openrouter", models: CHAIN.map((id) => ({ id })) });
    const inner = createModels();
    inner.setProvider(faux.provider);
    const seen: Array<{ model: string; payload: unknown }> = [];
    const answer =
      (fail: boolean): FauxResponseStep =>
      async (_context, options, _state, model: Model<string>) => {
        seen.push({ model: model.id, payload: await options?.onPayload?.({ messages: [] }, model as never) });
        return fauxAssistantMessage(fail ? "" : "ok", fail ? { stopReason: "error", errorMessage: "upstream dropped the stream" } : {});
      };
    faux.setResponses([answer(true), answer(true), answer(false), answer(false)]);
    const models = FallbackModels.wrap(inner, CHAIN);
    const primary = inner.getModel("openrouter", "primary")!;
    const ask = async (session: string): Promise<AssistantMessage> => models.streamSimple(primary, { messages: [] }, { sessionId: session }).result();

    expect((await ask("s1")).stopReason).toBe("error");
    expect((await ask("s1")).stopReason).toBe("error");
    expect((await ask("s1")).stopReason).toBe("stop");
    expect((await ask("s1")).stopReason).toBe("stop");
    expect(seen.map((s) => s.model)).toEqual(["primary", "backup-1", "backup-2", "primary"]);
    expect(seen[0]!.payload).toEqual({ messages: [], models: ["backup-1", "backup-2"] });
    expect(seen[2]!.payload).toEqual({ messages: [] });
    expect(models.getModel("openrouter", "backup-1")?.id).toBe("backup-1");
  });
});
