import { defineDoc, type TaskId } from "@earendil-works/pi-durable";

/** On a worker conversation: the research run it is the record of (spec §6.7). */
export const RunDoc = defineDoc<{ run_id: string }>({
  kind: "mra.run",
  version: 1,
  scope: "conversation",
  history: "latest",
  fork: "current",
  initial: () => ({ run_id: "" }),
});

/** For the whole harness: which task each run's work is, so creating a run's task twice finds the first. */
export const TaskIndex = defineDoc<{ tasks: Record<string, TaskId> }>({
  kind: "mra.tasks",
  version: 1,
  scope: "session",
  initial: () => ({ tasks: {} }),
});
