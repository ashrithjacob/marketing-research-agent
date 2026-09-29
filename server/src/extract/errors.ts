import { Trace } from "../trace/index.js";

export class PacketError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(problems.join("; "));
    Trace.line(import.meta.url, "PacketError.constructor", { problems });
    this.name = "PacketError";
  }
}
