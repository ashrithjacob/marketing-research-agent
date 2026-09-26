import { Trace } from "../trace/index.js";

export class PacketError extends Error {
  constructor(message: string) {
    super(message);
    Trace.line(import.meta.url, "PacketError.constructor", { message });
    this.name = "PacketError";
  }
}
