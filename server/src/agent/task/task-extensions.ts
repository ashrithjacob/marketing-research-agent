import type { Message } from "@earendil-works/pi-ai";
import { defineExtension, GenerationTask, hook, section, type Extension, type HookApi, type UserInput } from "@earendil-works/pi-durable";

import { Breakers, CheckProblems } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

import { TASK_CEILING_WARNING } from "../prompt/text/task.js";

import { DurableTool } from "./durable-tool.js";
import type { TaskReadings } from "./task-readings.js";
import type { TaskSignals } from "./task-signals.js";
import type { TaskWork, TaskWorks } from "./task-work.js";

/** One task's extension: its run's own tools, its worker prompt, and the hooks that log its calls, trip its breakers and run its contract check when the model stops (spec §6.4). */
export class TaskExtensions {
  constructor(
    private readonly works: TaskWorks,
    private readonly signals: TaskSignals,
    private readonly readings: TaskReadings,
  ) {}

  static nameOf(runId: string): string {
    Trace.line(import.meta.url, "TaskExtensions.nameOf", { runId });
    return `mra.task.${runId}`;
  }

  async build(runId: string): Promise<Extension> {
    Trace.line(import.meta.url, "TaskExtensions.build", { runId });
    const work = await this.works.of(runId);
    return defineExtension({
      name: TaskExtensions.nameOf(runId),
      tools: work.tools.map((tool) => DurableTool.from(tool, runId)),
      sections: [section("worker", () => work.system, { tag: false })],
      hooks: [
        hook(GenerationTask, {
          beforeRequest: (request, api) => this.beforeRequest(work, request.messages, api),
          afterResponse: (message, api) => work.calls.answered(String(api.taskId), message),
          afterTools: () => this.watchBreakers(work).then(() => undefined),
          onYield: () => this.onYield(work),
        }),
      ],
    });
  }

  private async beforeRequest(work: TaskWork, messages: readonly Message[], api: HookApi): Promise<{ messages: readonly Message[] } | undefined> {
    Trace.line(import.meta.url, "TaskExtensions.beforeRequest", { runId: work.runId });
    work.calls.sent(String(api.taskId), messages);
    const sent = (await work.calls.count()) + 1;
    if (!Breakers.warnNow(sent, work.role.maxTurns)) return undefined;
    return { messages: [...messages, { role: "user", content: TASK_CEILING_WARNING, timestamp: Date.now() }] };
  }

  private async watchBreakers(work: TaskWork): Promise<boolean> {
    Trace.line(import.meta.url, "TaskExtensions.watchBreakers", { runId: work.runId });
    if (this.signals.tripped(work.runId)) return true;
    const trip = await this.readings.trip(work.runId, work.contract, work.role.maxTurns, Date.now());
    if (trip) this.signals.trip(work.runId, trip);
    return trip !== null;
  }

  private async onYield(work: TaskWork): Promise<{ continue: UserInput } | undefined> {
    Trace.line(import.meta.url, "TaskExtensions.onYield", { runId: work.runId });
    if (await this.watchBreakers(work)) return undefined;
    const missing = CheckProblems.texts(await work.check.problems());
    if (missing.length === 0) return undefined;
    return { continue: `Still missing:\n${missing.map((text) => `- ${text}`).join("\n")}\nRecord each, or a gap for it, then call finish.` };
  }
}
