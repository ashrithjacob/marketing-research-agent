import type { ServiceReport } from "./service-report.js";
import { Trace } from "../trace/index.js";

export interface SearchHit {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchPage {
  hits: SearchHit[];
  report: ServiceReport;
}

export interface FetchedPage {
  text: string;
  title: string;
}

/** A page service that can fetch no page at all right now — out of credits, or no key — as opposed to one page failing. */
export class FetcherUnavailableError extends Error {
  constructor(
    readonly service: string,
    message: string,
  ) {
    super(message);
    Trace.line(import.meta.url, "FetcherUnavailableError.constructor", { service });
    this.name = "FetcherUnavailableError";
  }
}
