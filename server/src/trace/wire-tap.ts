import { AsyncLocalStorage } from "node:async_hooks";
import diagnostics from "node:diagnostics_channel";

import { Trace } from "./trace.js";
import { TraceFormat } from "./trace-format.js";

interface Pending {
  startedAt: number;
  label: string;
  resume: <R>(work: () => R) => R;
}

interface UndiciRequest {
  method?: string;
  origin?: string | URL;
  path?: string;
}

interface NodeRequest {
  method?: string;
  host?: string;
  getHeader?: (name: string) => unknown;
  protocol?: string;
  path?: string;
}

/** Every outbound HTTP request, from Node's own diagnostics channels: fetch and the http module. */
export class WireTap {
  private readonly pending = new WeakMap<object, Pending>();
  private readonly file = import.meta.url;

  attach(): void {
    diagnostics.subscribe("undici:request:create", (m) => {
      const { request } = m as { request: UndiciRequest };
      this.started(request, WireTap.undiciLabel(request));
    });
    diagnostics.subscribe("undici:request:headers", (m) => {
      const { request, response } = m as { request: object; response: { statusCode?: number } };
      this.finished(request, String(response.statusCode ?? "?"));
    });
    diagnostics.subscribe("undici:request:error", (m) => {
      const { request, error } = m as { request: object; error: Error };
      this.finished(request, `error ${error?.message ?? ""}`);
    });
    diagnostics.subscribe("http.client.request.start", (m) => {
      const { request } = m as { request: NodeRequest };
      this.started(request, WireTap.nodeLabel(request));
    });
    diagnostics.subscribe("http.client.response.finish", (m) => {
      const { request, response } = m as { request: object; response: { statusCode?: number } };
      this.finished(request, String(response.statusCode ?? "?"));
    });
    diagnostics.subscribe("http.client.request.error", (m) => {
      const { request, error } = m as { request: object; error: Error };
      this.finished(request, `error ${error?.message ?? ""}`);
    });
  }

  private started(request: object, label: string): void {
    this.pending.set(request, { startedAt: Date.now(), label, resume: AsyncLocalStorage.snapshot() });
    Trace.line(this.file, `→ ${label}`);
  }

  private finished(request: object, outcome: string): void {
    const pending = this.pending.get(request);
    if (!pending) return;
    this.pending.delete(request);
    const ms = Date.now() - pending.startedAt;
    pending.resume(() => Trace.line(this.file, `← ${pending.label}`, { status: outcome, ms }));
  }

  private static undiciLabel(request: UndiciRequest): string {
    return `${request.method ?? "GET"} ${TraceFormat.url(`${String(request.origin ?? "")}${request.path ?? ""}`)}`;
  }

  private static nodeLabel(request: NodeRequest): string {
    const host = String(request.getHeader?.("host") ?? request.host ?? "");
    return `${request.method ?? "GET"} ${TraceFormat.url(`${request.protocol ?? "https:"}//${host}${request.path ?? ""}`)}`;
  }
}
