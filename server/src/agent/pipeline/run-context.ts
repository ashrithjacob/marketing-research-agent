import type { Models } from "@earendil-works/pi-ai";

import type { ChargeMeter, GenerationSource, ResearchStore, Run } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";
import { AgentRunner, type AgentJob, type AgentResult } from "../kernel/agent-runner.js";
import { BilledCosts } from "../kernel/billed-costs.js";
import { CallSequence } from "../kernel/llm-call-log.js";
import type { ModelChain } from "../kernel/model-chain.js";
import type { RetryPolicy } from "../kernel/retry.js";
import { RunMeter } from "../kernel/run-meter.js";
import type { AgentKit, Toolbox, ToolName } from "../tools/toolbox.js";

import type { RunEvents } from "./run-events.js";

/** What every run shares with the process: the store, the model catalogue, the tools, the billing lookups. */
export interface RunServices {
  store: ResearchStore;
  models: Models;
  toolbox: Toolbox;
  generations: GenerationSource;
  events: RunEvents;
  retry?: RetryPolicy;
}

/** One run's working state: its stop signal, its call numbering, its pending billed costs; agents are built and run through it. */
export class RunContext {
  readonly sequence = new CallSequence();
  readonly billing: BilledCosts;
  private readonly runner: AgentRunner;

  constructor(
    readonly run: Run,
    readonly signal: AbortSignal,
    private readonly services: RunServices,
    chain: ModelChain,
  ) {
    Trace.line(import.meta.url, "RunContext.constructor", { runId: run.id });
    this.billing = new BilledCosts(services.store, services.generations);
    this.runner = new AgentRunner({
      runId: run.id,
      models: services.models,
      chain,
      calls: services.store.calls,
      sequence: this.sequence,
      signal,
      emit: (kind, payload) => void this.emit(kind, payload),
      onCall: this.billing.onCall,
      ...(services.retry ? { retry: services.retry } : {}),
    });
  }

  get store(): ResearchStore {
    Trace.line(import.meta.url, "RunContext.store");
    return this.services.store;
  }

  kit(agentId: string, tools: readonly ToolName[]): AgentKit {
    Trace.line(import.meta.url, "RunContext.kit", { agentId, tools });
    return this.services.toolbox.kit(tools, this.meter(agentId), this.run.input.markets);
  }

  meter(agentId: string): ChargeMeter {
    Trace.line(import.meta.url, "RunContext.meter", { agentId });
    return new RunMeter(this.services.store.charges, this.run.id, agentId);
  }

  agent<T>(job: AgentJob<T>): Promise<AgentResult<T>> {
    Trace.line(import.meta.url, "RunContext.agent", { agentId: job.agentId });
    return this.runner.run(job);
  }

  emit(kind: string, payload: Record<string, unknown>): Promise<void> {
    Trace.line(import.meta.url, "RunContext.emit", { kind });
    return this.services.events.emit(this.run.id, kind, payload);
  }

  async settled(): Promise<void> {
    Trace.line(import.meta.url, "RunContext.settled");
    await this.sequence.written();
    await this.billing.settled();
    await this.services.events.flushed(this.run.id);
  }
}
