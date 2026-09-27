import { Trace } from "../trace/index.js";

export interface ServicePart {
  name: string;
  ok: boolean;
  detail: string;
}

/** What an outside service said about one request, beyond its HTTP status: which of its parts answered. */
export interface ServiceReport {
  service: string;
  outcome: "ok" | "degraded" | "failed";
  parts: ServicePart[];
}

export class ServiceReports {
  static is(value: unknown): value is ServiceReport {
    Trace.line(import.meta.url, "ServiceReports.is");
    const v = value as ServiceReport | null;
    return (
      typeof v === "object" &&
      v !== null &&
      typeof v.service === "string" &&
      ["ok", "degraded", "failed"].includes(v.outcome) &&
      Array.isArray(v.parts)
    );
  }
}
