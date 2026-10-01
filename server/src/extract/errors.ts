import { CheckProblems, type CheckProblem } from "../domain/index.js";
import { Trace } from "../trace/index.js";

export class PacketError extends Error {
  readonly problems: readonly string[];

  constructor(readonly located: readonly CheckProblem[]) {
    super(CheckProblems.texts(located).join("; "));
    Trace.line(import.meta.url, "PacketError.constructor", { located });
    this.name = "PacketError";
    this.problems = CheckProblems.texts(located);
  }
}
