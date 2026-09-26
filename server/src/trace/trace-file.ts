import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";

import type { TraceSink } from "./trace.js";

const PROCESS_LOG = "process.log";
const DAY_MS = 86_400_000;
const RUN_ID = /^[A-Za-z0-9_-]+$/;

export interface TraceLimits {
  dir: string;
  maxBytes: number;
  keepDays: number;
}

/** One text file per run, plus process.log for lines that belong to no run. */
export class TraceFile implements TraceSink {
  private readonly sizes = new Map<string, number>();
  private readonly capped = new Set<string>();

  constructor(private readonly limits: TraceLimits) {}

  write(runId: string | null, line: string): void {
    const name = runId && RUN_ID.test(runId) ? `${runId}.log` : PROCESS_LOG;
    if (this.capped.has(name)) return;
    try {
      const size = this.sizeOf(name);
      const text = `${line}\n`;
      if (size + text.length > this.limits.maxBytes) {
        if (name === PROCESS_LOG) {
          renameSync(join(this.limits.dir, name), join(this.limits.dir, `${name}.1`));
          this.sizes.set(name, 0);
        } else {
          appendFileSync(join(this.limits.dir, name), `trace truncated at ${this.limits.maxBytes} bytes\n`);
          this.capped.add(name);
          return;
        }
      }
      appendFileSync(join(this.limits.dir, name), text);
      this.sizes.set(name, (this.sizes.get(name) ?? 0) + Buffer.byteLength(text));
    } catch {
      this.capped.add(name);
    }
  }

  read(runId: string): string | null {
    if (!RUN_ID.test(runId)) return null;
    const path = join(this.limits.dir, `${runId}.log`);
    return existsSync(path) ? readFileSync(path, "utf8") : null;
  }

  prune(now: number = Date.now()): number {
    if (!existsSync(this.limits.dir)) return 0;
    let removed = 0;
    for (const name of readdirSync(this.limits.dir)) {
      const path = join(this.limits.dir, name);
      if (now - statSync(path).mtimeMs > this.limits.keepDays * DAY_MS) {
        unlinkSync(path);
        removed += 1;
      }
    }
    return removed;
  }

  private sizeOf(name: string): number {
    const known = this.sizes.get(name);
    if (known !== undefined) return known;
    mkdirSync(this.limits.dir, { recursive: true });
    const path = join(this.limits.dir, name);
    const size = existsSync(path) ? statSync(path).size : 0;
    this.sizes.set(name, size);
    return size;
  }
}
