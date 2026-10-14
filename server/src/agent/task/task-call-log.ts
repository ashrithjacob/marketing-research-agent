import { getCurrentSystemPrompt, getCurrentTools, type AssistantMessage, type Message } from "@earendil-works/pi-ai";

import { RunBilling, type OpenRouterPrices } from "../../adapters/index.js";
import type { ResearchStore } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { UsageTotals } from "../usage.js";

/** A task's LLM calls, written to the call log from the generation hooks: the request when it is sent, the answer when it lands, then its billed cost. */
export class TaskCallLog {
  private readonly open = new Map<string, { started: number; messages: readonly Message[] }>();
  private readonly billing: RunBilling;
  private readonly pending = new Set<Promise<void>>();
  private logged = 0;
  private lastSystem: string | undefined;
  private lastTools: string | undefined;

  constructor(
    private readonly store: ResearchStore,
    private readonly runId: string,
    private readonly agentId: string,
    costs: OpenRouterPrices,
  ) {
    Trace.line(import.meta.url, "TaskCallLog.constructor", { runId });
    this.billing = new RunBilling(costs);
  }

  sent(generationTaskId: string, messages: readonly Message[]): void {
    Trace.line(import.meta.url, "TaskCallLog.sent", { generationTaskId, messages: messages.length });
    this.open.set(generationTaskId, { started: Date.now(), messages });
  }

  async answered(generationTaskId: string, message: AssistantMessage): Promise<void> {
    Trace.line(import.meta.url, "TaskCallLog.answered", { generationTaskId, stopReason: message.stopReason });
    const request = this.open.get(generationTaskId) ?? { started: Date.now(), messages: [] };
    this.open.delete(generationTaskId);
    const conversation = request.messages.filter((m) => m.role !== "system");
    const reset = conversation.length < this.logged;
    const input = JSON.parse(JSON.stringify(reset ? conversation : conversation.slice(this.logged))) as unknown[];
    this.logged = conversation.length;
    const ended = Date.now();
    const { usage, ...answer } = message;
    await this.store.addLlmCall({
      run_id: this.runId,
      seq: (await this.store.listLlmCalls(this.runId)).length + 1,
      agent_id: this.agentId,
      started_at: new Date(request.started).toISOString(),
      ended_at: new Date(ended).toISOString(),
      duration_ms: ended - request.started,
      model: message.responseModel || message.model,
      system_prompt: this.changedSystem(request.messages),
      tools: this.changedTools(request.messages),
      context_reset: reset,
      context_messages: conversation.length,
      input,
      output: answer,
      stop_reason: message.stopReason,
      error: message.errorMessage ?? "",
      usage: UsageTotals.tokens(usage) as unknown as Record<string, unknown>,
      response_id: message.responseId ?? "",
    });
    this.bill(message.responseId ?? "");
  }

  async count(): Promise<number> {
    Trace.line(import.meta.url, "TaskCallLog.count");
    return (await this.store.listLlmCalls(this.runId)).length;
  }

  /** Every billed-cost lookup this process started has landed. */
  async written(): Promise<void> {
    Trace.line(import.meta.url, "TaskCallLog.written", { pending: this.pending.size });
    await Promise.all([...this.pending]);
  }

  private bill(responseId: string): void {
    Trace.line(import.meta.url, "TaskCallLog.bill", { responseId });
    const lookup = this.billing.track(responseId);
    if (!lookup) return;
    const write = lookup
      .then((generation) => (generation ? this.store.setLlmCallGeneration(this.runId, responseId, generation) : undefined))
      .catch((error: unknown) => console.error(`research task ${this.runId}: storing a billed cost failed`, error));
    this.pending.add(write);
    void write.finally(() => this.pending.delete(write));
  }

  private changedSystem(messages: readonly Message[]): string | null {
    Trace.line(import.meta.url, "TaskCallLog.changedSystem");
    const system = getCurrentSystemPrompt(messages);
    const changed = system !== this.lastSystem ? (system ?? null) : null;
    this.lastSystem = system;
    return changed;
  }

  private changedTools(messages: readonly Message[]): unknown[] | null {
    Trace.line(import.meta.url, "TaskCallLog.changedTools");
    const key = JSON.stringify(getCurrentTools(messages).map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })));
    const changed = key !== this.lastTools ? (JSON.parse(key) as unknown[]) : null;
    this.lastTools = key;
    return changed;
  }
}
