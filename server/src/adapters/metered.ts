import type { ServicePrices } from "../config/index.js";
import type {
  AdCategoryPage,
  AdLibrary,
  AdPage,
  AdQuery,
  ChargeMeter,
  FetchedPage,
  PageFetcher,
  SearchPage,
  SearchScope,
  ShopFinder,
  ShopPage,
  ShopQuery,
  ShopIntel,
  ShopSignals,
  ShopTraction,
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

  async categories(search: string, signal?: AbortSignal): Promise<AdCategoryPage> {
    Trace.line(import.meta.url, "MeteredAdLibrary.categories", { search });
    const page = await this.inner.categories(search, signal);
    if (page.credits > 0) await this.meter.charge({ service: "trendtrack", item: "categories", units: page.credits, usd: page.credits * this.prices.trendtrackUsdPerCredit, basis: "credits" });
    return page;
  }
}

/** TrendTrack's shop data, each paid call charged in the credits its header reports; the lookup is free. */
export class MeteredShopIntel implements ShopIntel {
  constructor(
    private readonly inner: ShopIntel,
    private readonly prices: ServicePrices,
    private readonly meter: ChargeMeter,
  ) {}

  lookup(domain: string, signal?: AbortSignal): Promise<ShopSignals | null> {
    Trace.line(import.meta.url, "MeteredShopIntel.lookup", { domain });
    return this.inner.lookup(domain, signal);
  }

  async traction(signals: ShopSignals, productHandle: string | null, signal?: AbortSignal): Promise<{ traction: ShopTraction; credits: number }> {
    Trace.line(import.meta.url, "MeteredShopIntel.traction", { shop: signals.shop_id });
    const result = await this.inner.traction(signals, productHandle, signal);
    await this.meter.charge({ service: "trendtrack", item: "shop", units: result.credits, usd: result.credits * this.prices.trendtrackUsdPerCredit, basis: "credits" });
    return result;
  }
}

/** A search of TrendTrack's trending shops, charged in the credits its header reports. */
export class MeteredShopFinder implements ShopFinder {
  constructor(
    private readonly inner: ShopFinder,
    private readonly prices: ServicePrices,
    private readonly meter: ChargeMeter,
  ) {}

  async find(query: ShopQuery, signal?: AbortSignal): Promise<ShopPage> {
    Trace.line(import.meta.url, "MeteredShopFinder.find", { text: query.text });
    const page = await this.inner.find(query, signal);
    await this.meter.charge({ service: "trendtrack", item: "shops", units: page.credits, usd: page.credits * this.prices.trendtrackUsdPerCredit, basis: "credits" });
    return page;
  }
}
