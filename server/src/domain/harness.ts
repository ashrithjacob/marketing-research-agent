/** The durable harness the always-on work will run on: opened once per process, resumed at start, closed on stop. */
export interface DurableHarness {
  readonly path: string;
  readonly reopened: boolean;
  resume(): void;
  close(): Promise<void>;
}
