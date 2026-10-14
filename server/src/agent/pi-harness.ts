import { existsSync } from "node:fs";

import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import type { Models } from "@earendil-works/pi-ai";
import { createRegistry, Harness } from "@earendil-works/pi-durable";
import { openNodeSqliteStorage } from "@earendil-works/pi-durable/storage/sqlite/node";

import type { DurableHarness } from "../domain/index.js";
import { Trace } from "../trace/index.js";

export class PiHarness implements DurableHarness {
  private constructor(
    private readonly harness: Harness,
    readonly path: string,
    readonly reopened: boolean,
  ) {
    Trace.line(import.meta.url, "PiHarness.constructor", { path, reopened });
  }

  static async open(path: string, models: Models): Promise<PiHarness> {
    Trace.line(import.meta.url, "PiHarness.open", { path });
    const reopened = existsSync(path);
    const storage = await openNodeSqliteStorage(path);
    const harness = await Harness.open(storage, { models, registry: createRegistry() }, BACKGROUND_CONTEXT);
    return new PiHarness(harness, path, reopened);
  }

  resume(): void {
    Trace.line(import.meta.url, "PiHarness.resume");
    this.harness.resume();
  }

  async close(): Promise<void> {
    Trace.line(import.meta.url, "PiHarness.close");
    await this.harness.close(BACKGROUND_CONTEXT);
  }
}
