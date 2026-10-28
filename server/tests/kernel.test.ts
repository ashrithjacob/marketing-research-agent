/** The agent kernel's turn policy and submit tool: a turn that ends without submit gets a reminder, a submit whose array or object arrives as JSON text is parsed back, and an agent repeating its last turn's tool calls is moved to the next model. */
import { describe, expect, it } from "vitest";

import type { AgentTool, AgentTurnContext } from "@earendil-works/pi-agent-core";
import { Type, createModels, type Model, type TSchema } from "@earendil-works/pi-ai";
import { fauxProvider, type FauxResponseFactory } from "@earendil-works/pi-ai/providers/faux";
import { z } from "zod/v4";

import { AgentRunner } from "../src/agent/kernel/agent-runner.js";
import { CallSequence } from "../src/agent/kernel/llm-call-log.js";
import { ModelChain } from "../src/agent/kernel/model-chain.js";
import { SubmitTool } from "../src/agent/kernel/submit-tool.js";
import { TurnPolicy } from "../src/agent/kernel/turn-policy.js";
import type { CallLog, LlmCall } from "../src/domain/index.js";

import { ScriptedAgents } from "./scripted-agents.js";

const turn = (stopReason: string): AgentTurnContext => ({ message: { stopReason }, toolResults: [] }) as unknown as AgentTurnContext;

describe("TurnPolicy", () => {
  it("reminds an agent cut off at the output cap to submit, at most twice", () => {
    const reminders: string[] = [];
    const policy = new TurnPolicy(10, () => false, (text) => reminders.push(text));
    policy.finishTurn(turn("length"));
    policy.finishTurn(turn("stop"));
    policy.finishTurn(turn("length"));
    expect(reminders).toHaveLength(2);
    expect(reminders[0]).toContain("cut off at the output limit");
    expect(reminders[1]).toContain("You have not called submit");
  });
});

describe("SubmitTool.unpacked", () => {
  it("parses an array or object field the model sent as JSON text, and leaves anything else for the schema to refuse", () => {
    const schema = { type: "object", properties: { ads: { type: "array" }, note: { type: "string" }, meta: { type: "object" } } } as unknown as TSchema;
    expect(SubmitTool.unpacked({ ads: '[{"ad_id":"a"}]', note: "[1]", meta: '{"k":1}' }, schema)).toEqual({ ads: [{ ad_id: "a" }], note: "[1]", meta: { k: 1 } });
    expect(SubmitTool.unpacked({ ads: "not json", meta: "[1]" }, schema)).toEqual({ ads: "not json", meta: "[1]" });
  });
});

describe("an agent repeating its last turn's tool calls", () => {
  it("is moved to the next model in the chain, told why, and the run is told", async () => {
    const provider = fauxProvider({ provider: "openrouter", models: [{ id: "first/model" }, { id: "second/model" }] });
    const models = createModels();
    models.setProvider(provider.provider);
    const resolved = ModelChain.resolve(["first/model", "second/model"], models);
    if (!("chain" in resolved)) throw new Error("chain did not resolve");
    const used: string[] = [];
    const told: string[] = [];
    const step = (reply: (turn: number) => ReturnType<FauxResponseFactory>): FauxResponseFactory => (context, _options, _state, model: Model<string>) => {
      used.push(model.id);
      const last = context.messages.at(-1);
      if (last?.role === "user" && typeof last.content === "string") told.push(last.content);
      return reply(used.length);
    };
    const stuck = ScriptedAgents.call("echo", { word: "lung" });
    provider.setResponses([step(() => stuck), step(() => stuck), step(() => ScriptedAgents.call("echo", { word: "detox" })), step(() => ScriptedAgents.call("submit", { done: true }))]);
    const echo: AgentTool<any> = { name: "echo", label: "echo", description: "echo", parameters: Type.Object({ word: Type.String() }), execute: async () => ({ content: [{ type: "text", text: "ok" }], details: {} }) };
    const calls: CallLog = { add: async (call) => call as unknown as LlmCall, setGeneration: async () => undefined, list: async () => [] };
    const events: [string, Record<string, unknown>][] = [];
    const runner = new AgentRunner({ runId: "r", models, chain: resolved.chain, calls, sequence: new CallSequence(), signal: new AbortController().signal, emit: (kind, payload) => events.push([kind, payload]), onCall: () => undefined });

    const result = await runner.run({ agentId: "scout", system: "s", instructions: "go", tools: [echo], maxTurns: 6, submission: { schema: z.object({ done: z.boolean() }), describe: "d" } });

    expect(result.status).toBe("completed");
    expect(used).toEqual(["first/model", "first/model", "second/model", "second/model"]);
    expect(told.some((text) => text.includes("sent exactly the same tool calls"))).toBe(true);
    expect(events).toContainEqual(["agent.model_switched", { agent_id: "scout", from: "first/model", to: "second/model", why: "repeated tool calls" }]);
    expect(resolved.chain.current.id).toBe("first/model");
  });
});
