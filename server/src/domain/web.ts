import type { ServiceReport } from "./service-report.js";

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
