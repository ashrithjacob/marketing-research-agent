/**
 * The document library: a PDF uploaded, converted in the background with its
 * progress streamed, stored as markdown, and read by an agent one section at a
 * time.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { FileMarkdown, MarkdownLayout, PdfMarkdown, ServiceClients, type PrintedLine, type SqlResearchStore } from "../src/adapters/index.js";
import { LibraryIntake, LibraryTools, ToolRegistry } from "../src/agent/index.js";
import { Env, type Settings } from "../src/config/index.js";
import { DocumentSections, Roles, Scope, type ConvertedDocument, type DocumentConverter, type LibraryFrame } from "../src/domain/index.js";
import { App } from "../src/http/index.js";
import { NoCharges } from "./fixtures.js";
import { SqliteStores } from "./sqlite-stores.js";

/** A one-page-per-entry PDF in Helvetica, each line drawn at its own size and height up the page. */
const pdf = (pages: ReadonlyArray<ReadonlyArray<{ text: string; size: number; y: number }>>): Uint8Array => {
  const objects: string[] = [];
  const pageIds = pages.map((_, i) => 4 + i * 2);
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  pages.forEach((lines, i) => {
    const stream = lines.map((l) => `BT /F1 ${l.size} Tf 72 ${l.y} Td (${l.text}) Tj ET`).join("\n");
    objects[pageIds[i]!] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${pageIds[i]! + 1} 0 R >>`;
    objects[pageIds[i]! + 1] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = out.length;
    out += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) out += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
};

const PLAYBOOK = pdf([
  [
    { text: "Long-Form Statics", size: 24, y: 720 },
    { text: "Section 01 - The Hook", size: 16, y: 680 },
    { text: "The image stops the scroll.", size: 12, y: 650 },
    { text: "The copy does the selling.", size: 12, y: 636 },
  ],
]);

const line = (text: string, height: number, y: number): PrintedLine => ({ text, height, y });

describe("MarkdownLayout", () => {
  it("makes lines set larger than the body into headings, largest first, and keeps body lines", () => {
    const md = new MarkdownLayout().render([[line("Title", 24, 700), line("Part one", 16, 660), line("Body text here.", 12, 640), line("More body text.", 12, 626)]]);
    expect(md).toBe("# Title\n\n## Part one\n\nBody text here.\nMore body text.\n");
  });

  it("drops a line that repeats on most pages, numbers aside, as a running header or footer", () => {
    const page = (n: number) => [
      line("Playbook", 9, 780), line(`Opening of page ${n}, long enough to be the body.`, 12, 700),
      line(`Body of page ${n}, the same words on every page.`, 12, 686),
      line(`Close of page ${n}, long enough to be the body.`, 12, 672), line(`Page ${n} of 3`, 9, 20),
    ];
    const md = new MarkdownLayout().render([page(1), page(2), page(3)]);
    expect(md).not.toMatch(/Playbook|of 3/);
    expect(md).toContain("Body of page 2, the same words on every page.");
  });

  it("joins a heading that wraps onto a second line, turns bullets into list items, and opens a paragraph at a wide gap", () => {
    const md = new MarkdownLayout().render([[
      line("Make the skill do a job,", 16, 700), line("not a book report", 16, 682),
      line("• first point of the body", 12, 650), line("next paragraph after a gap", 12, 600),
    ]]);
    expect(md).toBe("# Make the skill do a job, not a book report\n\n- first point of the body\n\nnext paragraph after a gap\n");
  });
});

describe("DocumentSections", () => {
  it("cuts at headings, and slices a section too long to read at once at paragraph breaks", () => {
    const md = `intro\n\n# One\n\n${"a".repeat(30)}\n\n${"b".repeat(30)}\n\n## Two\n\nshort`;
    const sections = DocumentSections.of(md, 50);
    expect(sections.map((s) => s.heading)).toEqual(["(opening)", "One (1/2)", "One (2/2)", "Two"]);
    expect(sections.every((s) => s.chars <= 50)).toBe(true);
    expect(sections[3]!.text).toBe("## Two\n\nshort");
  });
});

describe("PdfMarkdown", () => {
  it("reads a real PDF's text layer into markdown, reporting every page", async () => {
    const seen: string[] = [];
    const out = await new PdfMarkdown(new MarkdownLayout()).convert(PLAYBOOK, (page, pages) => seen.push(`${page}/${pages}`));
    expect(out.pages).toBe(1);
    expect(seen).toEqual(["1/1"]);
    expect(out.markdown).toBe("# Long-Form Statics\n\n## Section 01 - The Hook\n\nThe image stops the scroll.\nThe copy does the selling.\n");
  });

  it("refuses a PDF with no text layer, saying why, rather than storing an empty document", async () => {
    await expect(new PdfMarkdown(new MarkdownLayout()).convert(pdf([[]]), () => undefined)).rejects.toThrow(/no text layer/);
  });
});

let dir: string;
let store: SqlResearchStore;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "mra-library-"));
  store = await SqliteStores.open(join(dir, "research.db"));
});

afterEach(async () => {
  await store.close();
  rmSync(dir, { recursive: true, force: true });
});

class FakeConverter implements DocumentConverter {
  constructor(private readonly result: ConvertedDocument | Error) {}
  async convert(_bytes: Uint8Array, onPage: (page: number, pages: number) => void): Promise<ConvertedDocument> {
    if (this.result instanceof Error) throw this.result;
    for (let n = 1; n <= this.result.pages; n++) onPage(n, this.result.pages);
    return this.result;
  }
}

describe("LibraryIntake", () => {
  it("answers with a converting row at once, then streams from the page reached to the ready document, so a late follower misses nothing that matters", async () => {
    const intake = new LibraryIntake(store.library, new FakeConverter({ markdown: "# A\n\nbody\n", pages: 2 }));
    const document = await intake.accept("ws1", { filename: "my_play-book.pdf", bytes: new Uint8Array() });
    expect(document).toMatchObject({ status: "converting", title: "my play book" });
    const frames: LibraryFrame[] = [];
    intake.subscribe(document.id, (frame) => frames.push(frame));
    await intake.settled(document.id);
    expect(frames.map((f) => (f.kind === "page" ? `page ${f.page}/${f.pages}` : f.kind))).toEqual(["page 2/2", "ready"]);
    expect(await store.library.markdown(Scope.of("ws1"), document.id)).toBe("# A\n\nbody\n");
    expect(await store.library.markdown(Scope.of("ws2"), document.id)).toBeNull();
    expect(intake.subscribe(document.id, () => undefined)).toBeNull();
  });

  it("stores a failed conversion with its reason, and marks one a restart cut off as failed", async () => {
    const failing = new LibraryIntake(store.library, new FakeConverter(new Error("the PDF has no text layer")));
    const failed = await failing.accept("ws1", { filename: "scan.pdf", bytes: new Uint8Array() });
    await failing.settled(failed.id);
    expect(await store.library.get(Scope.of("ws1"), failed.id)).toMatchObject({ status: "failed", error: "the PDF has no text layer" });

    const cut = await store.library.add("ws1", { title: "cut", filename: "cut.pdf" });
    expect(await new LibraryIntake(store.library, new FakeConverter(new Error("unused"))).recover()).toBe(1);
    expect(await store.library.get(Scope.of("ws1"), cut.id)).toMatchObject({ status: "failed", error: LibraryIntake.RESTARTED });
  });
});

describe("the library tools", () => {
  it("are absent while the workspace has nothing ready, so an agent is never offered an empty shelf", async () => {
    expect(await LibraryTools.forWorkspace(store.library, "ws1")).toBeNull();
  });

  it("list each document's sections, read one by number, and are built for every research role that names them", async () => {
    const intake = new LibraryIntake(store.library, new FakeConverter({ markdown: "# Hooks\n\nopen with a question\n\n# Leads\n\nthe story\n", pages: 1 }));
    const document = await intake.accept("ws1", { filename: "playbook.pdf", bytes: new Uint8Array() });
    await intake.settled(document.id);
    const library = (await LibraryTools.forWorkspace(store.library, "ws1"))!;
    const index = await library.index().execute("1", {});
    expect((index.content[0] as { text: string }).text).toBe(`## playbook — id ${document.id}, 1 pages\n0. Hooks (29 chars)\n1. Leads (18 chars)`);
    const read = await library.read().execute("2", { document_id: document.id, section: 1 });
    expect((read.content[0] as { text: string }).text).toBe("# Leads\n\nthe story");
    await expect(library.read().execute("3", { document_id: document.id, section: 5 })).rejects.toThrow(/sections 0 to 1/);

    const settings: Settings = { ...Env.settings(), corpusPath: join(dir, "corpus") };
    const registry = new ToolRegistry(new ServiceClients({ scrape: async () => ({ text: "", title: "" }) }, { find: async () => ({ results: [] }) } as never, null), settings);
    const run = { runId: "r", subject: "", market: "", discovery: null, meter: new NoCharges() };
    for (const role of ["product", "category", "formula"] as const) {
      const names = (built: ReturnType<ToolRegistry["build"]>) => built.map((b) => b.tool.name);
      expect(names(registry.build(Roles.of(role).tools, { ...run, library }))).toEqual(expect.arrayContaining(["library_index", "library_read"]));
      expect(names(registry.build(Roles.of(role).tools, { ...run, library: null }))).not.toContain("library_index");
    }
  });
});

describe("the library routes", () => {
  it("take a PDF or a markdown file and answer 202 at once, stream it to ready, serve its markdown, and refuse anything else", async () => {
    const app = new App({ settings: { ...Env.settings(), corpusPath: join(dir, "corpus"), staticDir: join(dir, "static"), appPasswordHash: "" }, store });
    const upload = (bytes: Uint8Array, name: string) => {
      const form = new FormData();
      form.set("file", new File([bytes], name, { type: "application/pdf" }));
      return app.fetch(new Request("http://test/api/research/library", { method: "POST", body: form }));
    };
    const accepted = await upload(PLAYBOOK, "Long-Form Statics.pdf");
    expect(accepted.status).toBe(202);
    const document = (await accepted.json()) as { id: string; status: string };
    expect(document.status).toBe("converting");

    const events = await (await app.fetch(new Request(`http://test/api/research/library/${document.id}/events`))).text();
    expect(events).toMatch(/event: (page|ready)/);
    expect(events).toMatch(/event: ready\ndata: .*"status":"ready"/);

    const read = (await (await app.fetch(new Request(`http://test/api/research/library/${document.id}`))).json()) as { markdown: string; pages: number };
    expect(read.pages).toBe(1);
    expect(read.markdown).toContain("## Section 01 - The Hook");

    const notes = await upload(new TextEncoder().encode("# Hooks\n\nOpen with a question."), "brand_playbook.md");
    expect(notes.status).toBe(202);
    const playbook = (await notes.json()) as { id: string; title: string };
    expect(playbook.title).toBe("brand playbook");
    await (await app.fetch(new Request(`http://test/api/research/library/${playbook.id}/events`))).text();
    expect(((await (await app.fetch(new Request(`http://test/api/research/library/${playbook.id}`))).json()) as { markdown: string }).markdown).toBe("# Hooks\n\nOpen with a question.\n");
    expect((await upload(new TextEncoder().encode("hello"), "notes.docx")).status).toBe(415);
    await app.supervisor.close();
  });
});

describe("FileMarkdown", () => {
  it("hands a PDF to its converter, keeps markdown as it is, and refuses what is not UTF-8 text", async () => {
    const files = new FileMarkdown(new FakeConverter({ markdown: "# From the PDF\n", pages: 3 }));
    expect(await files.convert(new TextEncoder().encode("%PDF-1.7 ..."), () => undefined)).toEqual({ markdown: "# From the PDF\n", pages: 3 });
    const pages: number[][] = [];
    expect(await files.convert(new TextEncoder().encode("\n# Hooks\nask a question\n\n"), (page, of) => pages.push([page, of]))).toEqual({ markdown: "# Hooks\nask a question\n", pages: 1 });
    expect(pages).toEqual([[1, 1]]);
    await expect(files.convert(new Uint8Array([0xff, 0xfe, 0x00]), () => undefined)).rejects.toThrow("the file is not a PDF or UTF-8 text");
    await expect(files.convert(new TextEncoder().encode("  \n"), () => undefined)).rejects.toThrow("the file is empty");
  });
});
