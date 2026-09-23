import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

/** Writes a fetched body under its own sha256, so a quote can be re-read later. */
export class Corpus {
  constructor(private readonly corpusPath: string) {}

  async write(
    runId: string,
    text: string,
  ): Promise<{ sourceId: string; archived: boolean }> {
    const body = Buffer.from(text, "utf-8");
    const digest = createHash("sha256").update(body).digest("hex");
    const sourceId = `sha256:${digest}`;
    try {
      const dir = join(this.corpusPath, "runs", runId, "sources");
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, digest), body);
      return { sourceId, archived: true };
    } catch {
      return { sourceId, archived: false };
    }
  }
}
