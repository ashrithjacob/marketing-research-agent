import type { ServiceUse } from "./charges.js";
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
  /** The snippets are text the service read off each page, so they can be archived and cited; otherwise they only help choose what to fetch. */
  excerpted: boolean;
  /** What the service said the search used, when it says. */
  use?: ServiceUse;
}

/** Limits a search to these sites, e.g. regulators' own domains. */
export interface SearchScope {
  domains?: readonly string[];
}

export const PAGE_READERS = ["firecrawl", "crawl4ai", "parallel_extract"] as const;
export type PageReader = (typeof PAGE_READERS)[number];

export interface FetchedPage {
  text: string;
  title: string;
  /** Which service read it, so a fallback chain's page is charged to the service that served it. */
  reader?: PageReader;
}

/** A search or page service that can answer nothing at all right now — out of credits, or no key — as opposed to one request failing. */
export class ServiceUnavailableError extends Error {
  constructor(
    readonly service: string,
    message: string,
  ) {
    super(message);
    Trace.line(import.meta.url, "ServiceUnavailableError.constructor", { service });
    this.name = "ServiceUnavailableError";
  }
}
