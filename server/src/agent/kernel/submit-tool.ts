import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { TSchema } from "@earendil-works/pi-ai";

import { Schemas, type Schema } from "../../domain/index.js";
import { Trace } from "../../trace/index.js";

/** What an agent hands back, the schema it must match, and any check code makes on top. */
export interface Submission<T> {
  schema: Schema<T>;
  describe: string;
  check?: (value: T) => string[];
}

/** The one way an agent ends: its answer is checked against the schema and the code checks, and refused with the reasons until it passes or the refusals run out. */
export class SubmitTool<T> {
  static readonly REFUSAL_LIMIT = 3;
  private accepted: T | null = null;
  private refusals = 0;
  private problems: string[] = [];

  constructor(private readonly submission: Submission<T>) {}

  get value(): T | null {
    Trace.line(import.meta.url, "SubmitTool.value");
    return this.accepted;
  }

  get lastProblems(): readonly string[] {
    Trace.line(import.meta.url, "SubmitTool.lastProblems");
    return this.problems;
  }

  tool(): AgentTool<TSchema> {
    Trace.line(import.meta.url, "SubmitTool.tool");
    const self = this;
    return {
      name: "submit",
      label: "Submit",
      description: `${this.submission.describe} Calling this ends your work if it passes its checks.`,
      parameters: Schemas.json(this.submission.schema) as unknown as TSchema,
      executionMode: "sequential",
      async execute(_id, params) {
        Trace.line(import.meta.url, "SubmitTool.tool.execute", { refusals: self.refusals });
        return self.judge(params);
      },
    };
  }

  private judge(params: unknown): { content: { type: "text"; text: string }[]; details: Record<string, unknown>; terminate?: boolean } {
    Trace.line(import.meta.url, "SubmitTool.judge");
    const parsed = Schemas.parse(this.submission.schema, params);
    const problems = parsed.ok ? (this.submission.check?.(parsed.value) ?? []) : parsed.problems;
    if (parsed.ok && problems.length === 0) {
      this.accepted = parsed.value;
      return { content: [{ type: "text", text: "ACCEPTED. Your work is done." }], details: { accepted: true }, terminate: true };
    }
    this.refusals += 1;
    this.problems = problems;
    const last = this.refusals >= SubmitTool.REFUSAL_LIMIT;
    const list = problems.map((problem, i) => `${i + 1}. ${problem}`).join("\n");
    const tail = last ? "That was the last attempt; you are stopped." : `Fix them and call submit again (${this.refusals} of ${SubmitTool.REFUSAL_LIMIT} refusals used).`;
    return { content: [{ type: "text", text: `REFUSED, ${problems.length} problem(s):\n${list}\n${tail}` }], details: { accepted: false, problems }, ...(last ? { terminate: true } : {}) };
  }
}
