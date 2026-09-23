import type { Agent } from "@earendil-works/pi-agent-core";

import { OpenRouterPrices, RunBilling, type Pricing } from "../adapters/index.js";
import { Clock, type Node, type ResearchStore } from "../domain/index.js";
import { PacketExtractor } from "../extract/index.js";

import { AgentEventRecorder } from "./event-recorder.js";
import type { LiveRuns } from "./live-runs.js";
import { AgentMessages } from "./prompt/index.js";
import { Retries, type RetryPolicy } from "./retry.js";
import { RunSettlement } from "./run-settlement.js";
import { UsageTotals } from "./usage.js";

/** Drives one run's agent to the end: retries, one packet nudge, settlement, billing. */
export class RunWatch {
  readonly settlement: RunSettlement;

  constructor(
    private readonly options: {
      store: ResearchStore;
      runs: LiveRuns;
      costs: OpenRouterPrices;
      retry: RetryPolicy;
      runId: string;
      nodes: readonly Node[];
      pricing: Pricing;
    },
  ) {
    this.settlement = new RunSettlement(options.store, options.runs, options.runId);
  }

  async run(
    agent: Agent,
    instructions: string,
    onBilled: (responseId: string, cost: number) => void,
  ): Promise<void> {
    const { store, runs, costs, retry, runId, nodes, pricing } = this.options;
    let usage = UsageTotals.empty();
    const billing = new RunBilling(costs);
    const recorded = () => ({ ...usage, pricing });
    const recorder = new AgentEventRecorder(runs, runId, (message) => {
      usage = UsageTotals.add(usage, message.usage);
      const responseId = message.responseId;
      billing.track(responseId)?.then((cost) => {
        if (cost !== null && responseId) onBilled(responseId, cost);
      });
    });
    const unsubscribe = agent.subscribe((event) => {
      try {
        recorder.record(event);
      } catch (error) {
        console.error(`research run ${runId}: event handling failed`, error);
      }
    });

    try {
      await agent.prompt(instructions);
      await agent.waitForIdle();
      for (let attempt = 1; attempt <= retry.attempts; attempt++) {
        const dropped = agent.state.errorMessage ?? "";
        if (!this.shouldRetry(dropped)) break;
        const delayMs = Retries.backoffMs(attempt, retry);
        runs.emit(runId, "run.resumed", { error: dropped, attempt, delay_ms: delayMs });
        await Retries.sleep(delayMs);
        if (store.getRun(runId)?.status === "stopping") break;
        await agent.prompt(AgentMessages.resume(dropped));
        await agent.waitForIdle();
      }
      if (this.lacksPacket(recorder.text(), agent)) {
        agent.state.tools = [];
        runs.emit(runId, "run.nudged", { reason: "the run ended without a packet" });
        await agent.prompt(AgentMessages.packetNudge());
        await agent.waitForIdle();
      }
      this.settlement.settle(recorder.text(), recorded(), nodes, agent.state.errorMessage);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`research run ${runId}: agent failed`, error);
      store.updateRun(runId, {
        status: "failed",
        error: `agent failed: ${message}`,
        output: recorder.text(),
        usage: recorded(),
        ended_at: Clock.nowIso(),
      });
      runs.emit(runId, "run.failed", { error: message });
    } finally {
      unsubscribe();
      await this.recordBilling(billing);
      runs.closeSubscribers(runId);
      runs.remove(runId);
    }
  }

  private shouldRetry(errorMessage: string): boolean {
    if (!Retries.isRetryable(errorMessage)) return false;
    return this.options.store.getRun(this.options.runId)?.status !== "stopping";
  }

  private lacksPacket(output: string, agent: Agent): boolean {
    if (this.settlement.hasValidated()) return false;
    if (agent.state.errorMessage && !agent.state.messages.some((m) => m.role === "toolResult")) {
      return false;
    }
    if (this.options.store.getRun(this.options.runId)?.status === "stopping") return false;
    try {
      new PacketExtractor().extract(output);
      return false;
    } catch {
      return true;
    }
  }

  private async recordBilling(billing: RunBilling): Promise<void> {
    const { store, runs, runId } = this.options;
    try {
      const billed = await billing.settle();
      if (!billed) return;
      const usage = store.getRun(runId)?.usage ?? {};
      store.updateRun(runId, { usage: { ...usage, billed } });
      runs.emit(runId, "run.billed", { billed });
    } catch (error) {
      console.error(`research run ${runId}: recording the billed cost failed`, error);
    }
  }
}
