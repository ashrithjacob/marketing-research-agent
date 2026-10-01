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
}

/** Limits a search to these sites, e.g. regulators' own domains. */
export interface SearchScope {
  domains?: readonly string[];
}

export interface FetchedPage {
  text: string;
  title: string;
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

/** Whether a url sits on one of a list of sites, a subdomain included. */
export class Domains {
  static within(url: string, domains: readonly string[] | undefined): boolean {
    Trace.tick(import.meta.url, "Domains.within");
    if (!domains || domains.length === 0) return true;
    let host: string;
    try {
      host = new URL(url).hostname.toLowerCase();
    } catch {
      return false;
    }
    return domains.some((domain) => {
      const site = domain.toLowerCase().replace(/^www\./, "");
      return host === site || host.endsWith(`.${site}`);
    });
  }
}
