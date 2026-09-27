/**
 * The run trace: one text line per function and per HTTP request, filed under
 * the run it happened in, and downloadable from the activity page.
 */
import { mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { createServer, get as httpGet, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createModels } from "@earendil-works/pi-ai";
import { fauxAssistantMessage, fauxProvider } from "@earendil-works/pi-ai/providers/faux";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SqliteResearchStore } from "../src/adapters/index.js";
import { RunSupervisor } from "../src/agent/index.js";
import { Env } from "../src/config/index.js";
import { App } from "../src/http/index.js";
import { Trace, TraceFile, TraceFormat, WireTap, type TraceStep } from "../src/trace/index.js";
import { fenced, minimalPacket } from "./fixtures.js";
import { TraceCoverage } from "./trace-coverage.js";

let dir: string;
let traces: TraceFile;
const here = import.meta.url;
const log = (name: string): string => readFileSync(join(dir, name), "utf8");

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "mra-trace-"));
  traces = new TraceFile({ dir, maxBytes: 1024 * 1024, keepDays: 30 });
  Trace.install(traces);
});

afterEach(() => {
  Trace.install(null);
  rmSync(dir, { recursive: true, force: true });
});

describe("the line", () => {
  it("names the file relative to src/ whether it runs from source or the build", () => {
    expect(TraceFormat.file("file:///app/server/src/adapters/firecrawl.ts")).toBe("adapters/firecrawl.ts");
    expect(TraceFormat.file("file:///app/dist/agent/tools/web-fetch-tool.js")).toBe("agent/tools/web-fetch-tool.ts");
  });

  it("writes clock, elapsed, file, name and fields, and redacts secret-shaped names", () => {
    const line = TraceFormat.line(Date.UTC(2026, 8, 27, 21, 45, 3, 133), Date.UTC(2026, 8, 27, 21, 44, 50, 788),
      "adapters/firecrawl.ts", "Firecrawl.scrape",
      { url: "https://x.test/a b", apiKey: "sk-live", count: 3, items: [1, 2], shape: { a: 1, b: 2 }, nested: { a: { b: 1 } } });
    expect(line).toBe(
      '21:45:03.133 +00:12.345 [adapters/firecrawl.ts] Firecrawl.scrape url="https://x.test/a b" apiKey=*** count=3 items=[2] shape={a:1,b:2} nested={a}',
    );
  });

  it("cuts long text and hides secret query parameters", () => {
    expect(TraceFormat.value("x".repeat(200))).toBe(`${"x".repeat(120)}…(200)`);
    expect(TraceFormat.url("https://api.apify.com/v2/acts?token=abc&limit=5")).toBe(
      "api.apify.com/v2/acts?token=***&limit=5",
    );
  });
});

describe("the run context", () => {
  it("files two concurrent runs apart, and everything else in process.log", async () => {
    Trace.line(here, "outside");
    await Promise.all(
      ["runA", "runB"].map((runId) =>
        Trace.within(runId, { product: runId }, async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          Trace.line(here, `inside ${runId}`);
        }),
      ),
    );
    expect(log("runA.log")).toContain("inside runA");
    expect(log("runA.log")).not.toContain("inside runB");
    expect(log("runB.log")).toContain("inside runB");
    expect(log("process.log")).toContain("outside");
    expect(log("runA.log").split("\n")[0]).toContain("[trace/trace.ts] run runA product=runA");
  });

  it("counts ticks and writes them as one line before the next ordinary line", () => {
    Trace.within("runT", {}, () => {
      for (let i = 0; i < 412; i += 1) Trace.tick(here, "Recorder.record", { type: "message_update" });
      Trace.line(here, "after");
    });
    const lines = log("runT.log").trim().split("\n");
    expect(lines[1]).toMatch(/tests\/trace\.test\.ts\] Recorder\.record type=message_update ×412$/);
    expect(lines[2]).toContain("after");
  });

  it("flushes ticks on their own once they are five seconds old, so a long stream shows while it runs", () => {
    const realNow = Date.now;
    let now = realNow();
    Date.now = () => now;
    try {
      Trace.within("runS", {}, () => {
        Trace.tick(here, "Recorder.record");
        now += 5000;
        Trace.tick(here, "Recorder.record");
      });
    } finally {
      Date.now = realNow;
    }
    expect(log("runS.log").trim().split("\n")[1]).toMatch(/\+00:05\.000 .*Recorder\.record ×2$/);
  });
});

describe("the file", () => {
  it("stops a run file at its cap with one truncation line", () => {
    const small = new TraceFile({ dir, maxBytes: 200, keepDays: 30 });
    for (let i = 0; i < 20; i += 1) small.write("runC", `line ${i} ${"x".repeat(20)}`);
    const text = log("runC.log");
    expect(text.trim().split("\n").at(-1)).toBe("trace truncated at 200 bytes");
    expect(text.length).toBeLessThan(260);
  });

  it("prunes files older than the retention window", () => {
    writeFileSync(join(dir, "old.log"), "x");
    writeFileSync(join(dir, "new.log"), "x");
    const fortyDaysAgo = (Date.now() - 40 * 86_400_000) / 1000;
    utimesSync(join(dir, "old.log"), fortyDaysAgo, fortyDaysAgo);
    expect(traces.prune()).toBe(1);
    expect(traces.read("new")).toBe("x");
    expect(traces.read("old")).toBeNull();
    expect(traces.read("../etc/passwd")).toBeNull();
  });
});

describe("the wire", () => {
  let server: Server;
  let port = 0;
  const tap = new WireTap();
  tap.attach();

  beforeEach(async () => {
    server = createServer((_, res) => {
      res.statusCode = 201;
      res.end("ok");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = (server.address() as { port: number }).port;
  });

  afterEach(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it("files a fetch and an http.get under the run that made them, with status and time", async () => {
    await Trace.within("runW", {}, async () => {
      await (await fetch(`http://127.0.0.1:${port}/search?q=mullein&api_key=secret`)).text();
      await new Promise<void>((resolve) => httpGet(`http://127.0.0.1:${port}/reviews`, (res) => res.resume().on("end", resolve)));
    });
    const text = log("runW.log");
    expect(text).toContain(`[trace/wire-tap.ts] → GET 127.0.0.1:${port}/search?q=mullein&api_key=***`);
    expect(text).toMatch(new RegExp(`← GET 127\\.0\\.0\\.1:${port}/search\\S* status=201 ms=\\d+`));
    expect(text).toMatch(new RegExp(`← GET 127\\.0\\.0\\.1:${port}/reviews status=201 ms=\\d+`));
    expect(text).not.toContain("secret");
  });

  it("keeps each tool call's own lines and requests apart, even when two run at once", async () => {
    const first: TraceStep[] = [];
    const second: TraceStep[] = [];
    await Trace.within("runX", {}, async () => {
      Trace.line(here, "Loop.beforeTools");
      await Promise.all([
        Trace.withinTool("call_a", first, async () => {
          Trace.line(here, "Search.find", { query: "a" });
          await (await fetch(`http://127.0.0.1:${port}/a`)).text();
        }),
        Trace.withinTool("call_b", second, async () => {
          Trace.line(here, "Fetch.scrape", { url: "b" });
          await (await fetch(`http://127.0.0.1:${port}/b`)).text();
        }),
      ]);
    });
    expect(first.map((s) => s.name)).toEqual(["Search.find", `→ GET 127.0.0.1:${port}/a`, `← GET 127.0.0.1:${port}/a`]);
    expect(first[0]!.fields).toBe("query=a");
    expect(first[2]!.fields).toMatch(/status=201 ms=\d+/);
    expect(second.map((s) => s.name)).toEqual(["Fetch.scrape", `→ GET 127.0.0.1:${port}/b`, `← GET 127.0.0.1:${port}/b`]);
    const text = log("runX.log");
    expect(text).toMatch(/<call_a> \[[^\]]*tests\/trace\.test\.ts\] Search\.find/);
    expect(text).toMatch(/\] Loop\.beforeTools/);
    expect(text).not.toMatch(/<call_\w+> \[[^\]]*\] Loop\.beforeTools/);
  });
});

describe("the download", () => {
  it("serves a finished run's trace as an attachment, with the agent's own lines in it", async () => {
    const settings = { ...Env.settings(), model: "faux-model", corpusPath: join(dir, "corpus"), staticDir: join(dir, "static"), appPasswordHash: "", traceDir: dir };
    const store = new SqliteResearchStore(join(dir, "research.db"));
    const faux = fauxProvider({ provider: "openrouter", models: [{ id: "faux-model" }] });
    const models = createModels();
    models.setProvider(faux.provider);
    const supervisor = new RunSupervisor({ store, settings, models, retry: { attempts: 1, baseMs: 0, capMs: 0 } });
    const app = new App({ settings, store, supervisor, traces });
    faux.setResponses([fauxAssistantMessage(fenced(minimalPacket()))]);

    const created = await app.fetch(new Request("http://test/api/research/runs", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brief: { product: "MagnaCalm" } }),
    }));
    const { id } = (await created.json()) as { id: string };
    await app.supervisor.waitFor(id);

    const response = await app.fetch(new Request(`http://test/api/research/runs/${id}/trace`));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toBe(`attachment; filename="run-${id}-trace.log"`);
    const text = await response.text();
    expect(text.split("\n")[0]).toContain(`run ${id} product=MagnaCalm`);
    expect(text).toContain("[agent/run-agent-factory.ts] RunAgentFactory.assemble");
    expect(text.trim().split("\n").every((line) => /\[[\w./-]+\.ts\]/.test(line))).toBe(true);
    await app.close();
  });
});

describe("the coverage rule bites", () => {
  const problems = (source: string) =>
    TraceCoverage.problems(ts.createSourceFile("x.ts", source, ts.ScriptTarget.Latest, true));

  it("passes a method that starts with its own line", () => {
    expect(problems(`class A { go() { Trace.line(import.meta.url, "A.go"); return 1; } }`)).toEqual([]);
  });

  it("allows super() before the line", () => {
    expect(problems(`class E extends Error { constructor(m: string) { super(m); Trace.line(import.meta.url, "E.constructor"); } }`)).toEqual([]);
  });

  it("fails a method with no line, two lines, or the wrong name", () => {
    expect(problems(`class A { go() { return 1; } }`)).toEqual([
      'line 1: A.go does not start with Trace.line(import.meta.url, "A.go", …)',
    ]);
    expect(problems(`class A { go() { Trace.line(import.meta.url, "A.go"); Trace.line(import.meta.url, "A.go"); } }`)).toEqual([
      "line 1: A.go writes 2 trace lines; one per function",
    ]);
    expect(problems(`class A { go() { Trace.line(import.meta.url, "B.go"); } }`)).toEqual([
      'line 1: A.go traces as (import.meta.url, "B.go"), expected (import.meta.url, "A.go")',
    ]);
  });

  it("reaches arrow fields and object-literal methods such as a tool's execute", () => {
    expect(problems(`class A { f = () => 1; }`)).toEqual([
      "line 1: A.f needs a block body so it can start with its trace line",
    ]);
    expect(problems(`class T { tool() { Trace.line(import.meta.url, "T.tool"); return { async execute() { return 1; } }; } }`)).toEqual([
      'line 1: T.tool.execute does not start with Trace.line(import.meta.url, "T.tool.execute", …)',
    ]);
  });
});
