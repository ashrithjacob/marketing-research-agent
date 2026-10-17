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
