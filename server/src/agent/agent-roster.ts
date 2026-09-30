import { Trace } from "../trace/index.js";

/** Which of a run's agents have ended, so one waiting on another's rows knows when to stop waiting. */
export class AgentRoster {
  private readonly ended = new Set<string>();

  end(agentId: string): void {
    Trace.line(import.meta.url, "AgentRoster.end", { agentId });
    this.ended.add(agentId);
  }

  hasEnded(agentId: string): boolean {
    Trace.line(import.meta.url, "AgentRoster.hasEnded", { agentId });
    return this.ended.has(agentId);
  }
}
