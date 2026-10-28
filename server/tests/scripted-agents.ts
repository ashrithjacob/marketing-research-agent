import type { AssistantMessage, Message, TranscriptContext } from "@earendil-works/pi-ai";
import { fauxAssistantMessage, fauxToolCall, type FauxResponseFactory } from "@earendil-works/pi-ai/providers/faux";

type Turn = AssistantMessage | ((messages: Message[]) => AssistantMessage | Promise<AssistantMessage>);

/** Replies to each agent by what its first instruction says and how many turns it has had, so agents running at once each get their own script. */
export class ScriptedAgents {
  private readonly scripts: Array<{ when: string; turns: Turn[] }> = [];
  readonly unmatched: string[] = [];

  on(firstInstructionContains: string, turns: Turn[]): this {
    this.scripts.push({ when: firstInstructionContains, turns });
    return this;
  }

  static call(tool: string, args: Record<string, unknown>): AssistantMessage {
    return fauxAssistantMessage(fauxToolCall(tool, args as Parameters<typeof fauxToolCall>[1]), { stopReason: "toolUse" });
  }

  static text(text: string): AssistantMessage {
    return fauxAssistantMessage(text);
  }

  readonly respond: FauxResponseFactory = (context: TranscriptContext) => {
    const first = context.messages.find((m) => m.role === "user");
    const instruction = typeof first?.content === "string" ? first.content : JSON.stringify(first?.content ?? "");
    const script = this.scripts.find((s) => instruction.includes(s.when));
    const turn = context.messages.filter((m) => m.role === "assistant").length;
    const step = script?.turns[turn];
    if (!script || !step) {
      this.unmatched.push(`${instruction.slice(0, 60)} turn ${turn}`);
      return fauxAssistantMessage("nothing scripted");
    }
    return typeof step === "function" ? step(context.messages) : step;
  };

  steps(count = 200): FauxResponseFactory[] {
    return Array.from({ length: count }, () => this.respond);
  }
}
