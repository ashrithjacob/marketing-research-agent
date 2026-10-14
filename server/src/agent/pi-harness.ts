import { existsSync } from "node:fs";

import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import type { Models } from "@earendil-works/pi-ai";
import { createRegistry, Harness, type Registry } from "@earendil-works/pi-durable";
import { openNodeSqliteStorage } from "@earendil-works/pi-durable/storage/sqlite/node";

import type { DurableHarness } from "../domain/index.js";
import { Trace } from "../trace/index.js";

import { FallbackModels } from "./fallback-models.js";

export class PiHarness implements DurableHarness {
  private constructor(
    readonly session: Harness,
    readonly registry: Registry,
    readonly models: Models,
    readonly path: string,
    readonly reopened: boolean,
  ) {
    Trace.line(import.meta.url, "PiHarness.constructor", { path, reopened });
  }

  /** `models` serve the app as they are; the harness gets them wrapped with the backup chain, `chain` being the primary model then its backups. */
  static async open(path: string, models: Models, chain: readonly string[] = []): Promise<PiHarness> {
    Trace.line(import.meta.url, "PiHarness.open", { path, chain });
    const reopened = existsSync(path);
    const storage = await openNodeSqliteStorage(path);
    const registry = createRegistry();
    const settings = { followUpMode: "all" as const };
    const harness = await Harness.open(storage, { models: FallbackModels.wrap(models, chain), registry, settings }, BACKGROUND_CONTEXT);
    return new PiHarness(harness, registry, models, path, reopened);
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
