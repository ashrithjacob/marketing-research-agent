import { existsSync } from "node:fs";

import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import type { Models } from "@earendil-works/pi-ai";
import { createRegistry, Harness, type Registry } from "@earendil-works/pi-durable";
import { openNodeSqliteStorage } from "@earendil-works/pi-durable/storage/sqlite/node";

import type { DurableHarness } from "../domain/index.js";
import { Trace } from "../trace/index.js";

export class PiHarness implements DurableHarness {
  private constructor(
    readonly session: Harness,
    readonly registry: Registry,
    readonly path: string,
    readonly reopened: boolean,
  ) {
    Trace.line(import.meta.url, "PiHarness.constructor", { path, reopened });
  }

  static async open(path: string, models: Models): Promise<PiHarness> {
    Trace.line(import.meta.url, "PiHarness.open", { path });
    const reopened = existsSync(path);
    const storage = await openNodeSqliteStorage(path);
    const registry = createRegistry();
    const harness = await Harness.open(storage, { models, registry }, BACKGROUND_CONTEXT);
    return new PiHarness(harness, registry, path, reopened);
  }

  resume(): void {
    Trace.line(import.meta.url, "PiHarness.resume");
    this.session.resume();
  }

  async close(): Promise<void> {
    Trace.line(import.meta.url, "PiHarness.close");
    await this.session.close(BACKGROUND_CONTEXT);
  }
}
