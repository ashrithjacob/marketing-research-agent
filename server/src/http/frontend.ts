import { readFile, stat } from "node:fs/promises";
import { join, resolve, sep } from "node:path";

import type { Hono } from "hono";

/** The built SPA: assets by content type, a shell that is never cached, clean 404s under api/. */
export class Frontend {
  private static readonly NON_SPA_PREFIXES = ["api/", "assets/"];
  private static readonly CONTENT_TYPES: Record<string, string> = {
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
  };

  constructor(private readonly staticDir: string) {}

  mount(app: Hono): void {
    const root = resolve(this.staticDir);

    app.get("/*", async (c) => {
      const path = decodeURIComponent(new URL(c.req.url).pathname).replace(/^\/+/, "");

      if (path) {
        const candidate = resolve(join(root, path));
        if (candidate.startsWith(root + sep)) {
          try {
            if ((await stat(candidate)).isFile()) {
              return c.body(await readFile(candidate), 200, {
                "Content-Type": Frontend.contentType(candidate),
              });
            }
          } catch {}
        }
      }

      if (Frontend.NON_SPA_PREFIXES.some((prefix) => path.startsWith(prefix))) {
        return c.json({ detail: `no such resource: /${path}` }, 404);
      }
      if (path.split("/").pop()?.includes(".")) {
        return c.json({ detail: `no such file: /${path}` }, 404);
      }

      try {
        return c.html(await readFile(join(root, "index.html"), "utf-8"), 200, {
          "Cache-Control": "no-store, must-revalidate",
        });
      } catch {
        return c.json({ detail: "frontend is not built" }, 404);
      }
    });
  }

  private static contentType(path: string): string {
    const dot = path.lastIndexOf(".");
    return (
      (dot === -1 ? undefined : Frontend.CONTENT_TYPES[path.slice(dot)]) ??
      "application/octet-stream"
    );
  }
}
