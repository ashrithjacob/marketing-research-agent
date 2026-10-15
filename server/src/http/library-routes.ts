import type { Hono } from "hono";
import { streamSSE, type SSEStreamingApi } from "hono/streaming";

import { FileMarkdown } from "../adapters/index.js";
import type { LibraryIntake } from "../agent/index.js";
import { Scope, type DocumentLibrary, type LibraryFrame } from "../domain/index.js";
import type { ApiEnv } from "./api-env.js";
import { Trace } from "../trace/index.js";

/** `/library`: upload a PDF, markdown or text file and get its row back at once, follow its conversion page by page, read its markdown. */
export class LibraryRoutes {
  private static readonly TEXT_FILE = /\.(md|markdown|txt)$/i;

  constructor(
    private readonly library: DocumentLibrary,
    private readonly intake: LibraryIntake,
    private readonly maxBytes: number,
  ) {}

  register(api: Hono<ApiEnv>): void {
    Trace.line(import.meta.url, "LibraryRoutes.register");
    api.get("/library", async (c) => c.json({ data: await this.library.list(Scope.forViewer(c.get("principal"))) }));

    api.post("/library", async (c) => {
      if (Number(c.req.header("content-length") ?? 0) > this.maxBytes + 64 * 1024) return c.json({ detail: this.tooLarge() }, 413);
      const body = await c.req.parseBody().catch(() => null);
      const file = body?.file;
      if (!(file instanceof File)) return c.json({ detail: "send the file as the multipart field `file`" }, 400);
      if (file.size > this.maxBytes) return c.json({ detail: this.tooLarge() }, 413);
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!LibraryRoutes.TEXT_FILE.test(file.name) && !FileMarkdown.isPdf(bytes)) {
        return c.json({ detail: "only PDF, markdown (.md) and text (.txt) files can be added" }, 415);
      }
      return c.json(await this.intake.accept(c.get("principal").workspaceId, { filename: file.name, bytes }), 202);
    });

    api.get("/library/:documentId", async (c) => {
      const scope = Scope.forViewer(c.get("principal"));
      const document = await this.library.get(scope, c.req.param("documentId"));
      if (!document) return c.json({ detail: "no such document" }, 404);
      return c.json({ ...document, markdown: (await this.library.markdown(scope, document.id)) ?? "" });
    });

    api.delete("/library/:documentId", async (c) => {
      if (!(await this.library.delete(Scope.forViewer(c.get("principal")), c.req.param("documentId")))) {
        return c.json({ detail: "no such document" }, 404);
      }
      return c.json({ ok: true });
    });

    api.get("/library/:documentId/events", async (c) => {
      const scope = Scope.forViewer(c.get("principal"));
      const documentId = c.req.param("documentId");
      if (!(await this.library.get(scope, documentId))) return c.json({ detail: "no such document" }, 404);
      return streamSSE(c, async (stream) => this.follow(stream, scope, documentId));
    });
  }

  private tooLarge(): string {
    Trace.line(import.meta.url, "LibraryRoutes.tooLarge");
    return `the file is over ${Math.round(this.maxBytes / 1024 / 1024)} MB`;
  }

  private async follow(stream: SSEStreamingApi, scope: Scope, documentId: string): Promise<void> {
    Trace.line(import.meta.url, "LibraryRoutes.follow", { documentId });
    const pending: LibraryFrame[] = [];
    let wake: (() => void) | null = null;
    const unsubscribe = this.intake.subscribe(documentId, (frame) => {
      pending.push(frame);
      wake?.();
    });
    try {
      const document = await this.library.get(scope, documentId);
      if (!unsubscribe || !document || document.status !== "converting") {
        if (document) await stream.writeSSE({ event: document.status === "failed" ? "failed" : "ready", data: JSON.stringify({ kind: document.status, document }) });
        return;
      }
      for (;;) {
        if (pending.length === 0) await new Promise<void>((resolve) => { wake = resolve; setTimeout(resolve, 20000); });
        wake = null;
        const frame = pending.shift();
        if (!frame) {
          await stream.writeSSE({ event: "keepalive", data: "" });
          continue;
        }
        await stream.writeSSE({ event: frame.kind, data: JSON.stringify(frame) });
        if (frame.kind !== "page") return;
      }
    } finally {
      unsubscribe?.();
    }
  }
}
