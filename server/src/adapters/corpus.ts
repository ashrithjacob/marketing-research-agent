import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Trace } from "../trace/index.js";

/** Writes a fetched body under its own sha256, so a quote can be re-read later. A body already archived is not written again, so a file's time is when the run first saw that page. */
export class Corpus {
  constructor(private readonly corpusPath: string) {}

  async write(
    runId: string,
    text: string,
  ): Promise<{ sourceId: string; archived: boolean }> {
    Trace.line(import.meta.url, "Corpus.write", { runId, text });
    const body = Buffer.from(text, "utf-8");
    const digest = createHash("sha256").update(body).digest("hex");
    const sourceId = `sha256:${digest}`;
    try {
      const dir = join(this.corpusPath, "runs", runId, "sources");
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, digest), body, { flag: "wx" });
      return { sourceId, archived: true };
    } catch (error) {
      return { sourceId, archived: (error as NodeJS.ErrnoException).code === "EEXIST" };
    }
  }

  /** The archived body a source id names, or null when this run never archived it. */
  async read(runId: string, sourceId: string): Promise<string | null> {
    Trace.line(import.meta.url, "Corpus.read", { runId, sourceId });
    const digest = sourceId.startsWith("sha256:") ? sourceId.slice("sha256:".length) : "";
    if (!/^[0-9a-f]{64}$/.test(digest)) return null;
    try {
      return await readFile(join(this.corpusPath, "runs", runId, "sources", digest), "utf-8");
    } catch {
      return null;
    }
  }

  /** How many distinct pages a run has archived, and when the newest was first archived ("" for none). */
  async pages(runId: string): Promise<{ count: number; newest: string }> {
    Trace.line(import.meta.url, "Corpus.pages", { runId });
    const dir = join(this.corpusPath, "runs", runId, "sources");
    const names = await readdir(dir).catch(() => [] as string[]);
    const times = await Promise.all(names.map(async (name) => (await stat(join(dir, name))).mtime.toISOString()));
    return { count: names.length, newest: times.reduce((latest, time) => (time > latest ? time : latest), "") };
  }
}
