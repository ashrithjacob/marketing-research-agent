import type { ServicePrices } from "../config/index.js";
import type {
  AdLibrary,
  AdPage,
  AdQuery,
  ChargeMeter,
  CompetitorDiscovery,
  DiscoveryQuestion,
  DiscoveryReport,
  FetchedPage,
  PageFetcher,
  SearchPage,
  SearchScope,
  WebSearch,
} from "../domain/index.js";
import { Trace } from "../trace/index.js";

/** A Parallel search, charged at its listed price per unit it reports. */
export class MeteredWebSearch implements WebSearch {
  constructor(
    private readonly inner: WebSearch,
    private readonly prices: ServicePrices,
    private readonly meter: ChargeMeter,
  ) {}

  async find(query: string, maxResults: number, signal?: AbortSignal, scope?: SearchScope): Promise<SearchPage> {
    Trace.line(import.meta.url, "MeteredWebSearch.find", { query });
    const page = await this.inner.find(query, maxResults, signal, scope);
    const use = page.use ?? { item: "search", units: 1 };
    await this.meter.charge({ service: "parallel", item: use.item, units: use.units, usd: use.units * this.prices.parallelSearchUsd, basis: "listed" });
    return page;
  }
}

/** A page read, charged to the service that actually read it: Parallel Extract at its listed price, Crawl4AI at its own, Firecrawl unpriced until measured. */
export class MeteredPageFetcher implements PageFetcher {
  constructor(
    private readonly inner: PageFetcher,
    private readonly prices: ServicePrices,
    private readonly meter: ChargeMeter,
  ) {}

  async scrape(url: string, signal?: AbortSignal): Promise<FetchedPage> {
    Trace.line(import.meta.url, "MeteredPageFetcher.scrape", { url });
    const page = await this.inner.scrape(url, signal);
    const { prices } = this;
    if (page.reader === "parallel_extract") await this.meter.charge({ service: "parallel", item: "extract", units: 1, usd: prices.parallelExtractUsd, basis: "listed" });
    if (page.reader === "crawl4ai") await this.meter.charge({ service: "crawl4ai", item: "page", units: 1, usd: prices.crawl4aiUsdPerPage, basis: "listed" });
    if (page.reader === "firecrawl") await this.meter.charge({ service: "firecrawl", item: "page", units: 1, usd: prices.firecrawlUsdPerPage, basis: "listed" });
    return page;
  }
}

/** A Trendtrack search, charged in the credits its header reports, valued at the plan's price per credit. */
export class MeteredAdLibrary implements AdLibrary {
  constructor(
    private readonly inner: AdLibrary,
    private readonly prices: ServicePrices,
    private readonly meter: ChargeMeter,
  ) {}

  async search(query: AdQuery, signal?: AbortSignal): Promise<AdPage> {
    Trace.line(import.meta.url, "MeteredAdLibrary.search", { terms: query.terms });
    const page = await this.inner.search(query, signal);
    const credits = page.credits ?? page.hits.length;
    await this.meter.charge({ service: "trendtrack", item: "ads", units: credits, usd: credits * this.prices.trendtrackUsdPerCredit, basis: "credits" });
    return page;
  }
}

/** One Parallel Task run, charged at its processor's listed price; a processor with no listed price is charged as unpriced. */
export class MeteredDiscovery implements CompetitorDiscovery {
  constructor(
    private readonly inner: CompetitorDiscovery,
    private readonly prices: ServicePrices,
    private readonly meter: ChargeMeter,
  ) {}

  async discover(question: DiscoveryQuestion, signal?: AbortSignal): Promise<DiscoveryReport> {
    Trace.line(import.meta.url, "MeteredDiscovery.discover", { product: question.product });
    const report = await this.inner.discover(question, signal);
    await this.meter.charge({ service: "parallel", item: `task:${report.processor}`, units: 1, usd: this.prices.parallelTaskUsd[report.processor] ?? null, basis: "listed" });
    return report;
  }
}
