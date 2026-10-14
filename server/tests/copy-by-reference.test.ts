import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Corpus } from "../src/adapters/corpus.js";
import { RunFindings } from "../src/agent/run-findings.js";
import { ExcerptTool } from "../src/agent/tools/excerpt-tool.js";
import { NumberedPage, PlainPage } from "../src/agent/tools/page-views.js";
import { Paragraphs } from "../src/domain/index.js";
import { MemoryLedger } from "./fixtures.js";

const BODY = "  Drops of calm.\n\nEach 1 ml serving holds 400 mg.\nTake twice daily.\n\n\n   \nNot for children.\n";

describe("paragraphs", () => {
  it("split on blank lines, keeping where each sits in the body", () => {
    const all = Paragraphs.split(BODY);
    expect(all.map((p) => p.text)).toEqual(["Drops of calm.", "Each 1 ml serving holds 400 mg.\nTake twice daily.", "Not for children."]);
    for (const p of all) expect(BODY.slice(p.start, p.end)).toBe(p.text);
  });

  it("read back a range as the exact text between its first and last paragraph", () => {
    const picked = Paragraphs.range(BODY, 2, 3);
    expect(picked).toEqual({ text: "Each 1 ml serving holds 400 mg.\nTake twice daily.\n\nNot for children.", start: 18, end: 91 });
    expect(Paragraphs.range(BODY, 3, 4)).toEqual({ problem: "this source has 3 paragraphs, so p4 does not exist" });
    expect(Paragraphs.range(BODY, 2, 1)).toHaveProperty("problem");
  });

  it("are numbered by web_fetch the way they are read back, whole paragraphs up to the limit", () => {
    expect(new NumberedPage().render(BODY, 1000).shown).toBe("[p1] Drops of calm.\n\n[p2] Each 1 ml serving holds 400 mg.\nTake twice daily.\n\n[p3] Not for children.");
    const cut = new NumberedPage().render(BODY, 30);
    expect(cut).toEqual({ shown: "[p1] Drops of calm.", truncated: true, note: "NOTE: showing paragraphs 1–1 of 3. The archived copy is complete." });
    expect(new PlainPage().render(BODY, 5).shown).toBe("  Dro");
  });
});

describe("record_excerpt by reference", () => {
  let dir = "";
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "mra-excerpt-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("copies the quote and its character range from the archived page; the model never types it", async () => {
    const corpus = new Corpus(dir);
    const { sourceId } = await corpus.write("r", BODY);
    const ledger = new MemoryLedger();
    const tool = new ExcerptTool(new RunFindings(ledger, "r", "research", ["product_data"]), corpus, "product_data").tool();
    const result = await tool.execute("call1", { source_id: sourceId, from: 2, to: 2 });
    expect(result.content[0]).toMatchObject({ text: expect.stringMatching(/^RECORDED ex1 — p2–p2, 49 characters copied/) });
    expect(ledger.rows[0]!.payload).toMatchObject({
      source_id: sourceId,
      text: "Each 1 ml serving holds 400 mg.\nTake twice daily.",
      locator: { kind: "char_range", start: 18, end: 67 },
      node: "product_data",
    });
  });

  it("refuses a page this task never archived, and a paragraph the page does not have", async () => {
    const corpus = new Corpus(dir);
    const { sourceId } = await corpus.write("r", BODY);
    const tool = new ExcerptTool(new RunFindings(new MemoryLedger(), "r", "research", ["product_data"]), corpus, "product_data").tool();
    const unknown = await tool.execute("c", { source_id: `sha256:${"0".repeat(64)}`, from: 1, to: 1 });
    expect(unknown.content[0]).toMatchObject({ text: expect.stringContaining("is not a page this task archived") });
    const missing = await tool.execute("c", { source_id: sourceId, from: 1, to: 9 });
    expect(missing.content[0]).toMatchObject({ text: "NOT RECORDED — this source has 3 paragraphs, so p9 does not exist. Fix this and call again." });
  });
});
