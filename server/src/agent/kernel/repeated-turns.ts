import type { AgentLoopTurnUpdate, PrepareNextTurnContext } from "@earendil-works/pi-agent-core";
import type { Api, Model } from "@earendil-works/pi-ai";

import { Trace } from "../../trace/index.js";

import type { ModelChain } from "./model-chain.js";

/** Moves one agent to the next model in the chain when a turn sends exactly the tool calls its previous turn sent: a model stuck emitting one call shape does not recover by being asked again. Only this agent moves; the run's other agents keep their model. */
export class RepeatedTurns {
  private previous = "";
  private model: Model<Api>;

  constructor(
    private readonly chain: ModelChain,
    private readonly moved: (from: string, to: string) => void,
  ) {
    Trace.line(import.meta.url, "RepeatedTurns.constructor", { model: chain.current.id });
    this.model = chain.current;
  }

  readonly prepareNextTurn = (turn: PrepareNextTurnContext): AgentLoopTurnUpdate | undefined => {
    Trace.line(import.meta.url, "RepeatedTurns.prepareNextTurn", { model: this.model.id });
    const calls = turn.message.content.filter((part) => part.type === "toolCall").map((call) => [call.name, call.arguments]);
    const shape = calls.length > 0 ? JSON.stringify(calls) : "";
    const repeated = shape !== "" && shape === this.previous;
    this.previous = shape;
    if (!repeated) return undefined;
    const next = this.chain.after(this.model);
    if (!next) return undefined;
    this.moved(this.model.id, next.id);
    this.model = next;
    this.previous = "";
    const text = "Your last two turns sent exactly the same tool calls, with the same arguments. You have been moved to another model. Check each tool's result for the settings it actually received, and send what you mean.";
    return { model: next, messages: [{ role: "user", content: text, timestamp: Date.now() }] };
  };
}
