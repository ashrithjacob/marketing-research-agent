import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createModels } from "@earendil-works/pi-ai";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PiHarness } from "../src/agent/index.js";

describe("the pi-durable harness", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "mra-harness-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("creates its file on first open, and opens the same file again after a close", async () => {
    const path = join(dir, "harness.sqlite");
    const first = await PiHarness.open(path, createModels());
    first.resume();
    await first.close();
    expect(first.reopened).toBe(false);

    const second = await PiHarness.open(path, createModels());
    second.resume();
    await second.close();
    expect(second.reopened).toBe(true);
  });
});
