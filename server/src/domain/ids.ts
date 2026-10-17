import { randomUUID } from "node:crypto";

import { Trace } from "../trace/index.js";

export class Clock {
  static nowIso(): string {
    Trace.tick(import.meta.url, "Clock.nowIso");
    return new Date().toISOString();
  }
}

export class Ids {
  static next(): string {
    Trace.line(import.meta.url, "Ids.next");
    return randomUUID().replace(/-/g, "");
  }
}
