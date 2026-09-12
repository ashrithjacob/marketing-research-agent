/**
 * Stage 0 — which products are worth researching at all.
 *
 * Stages 1–5 answer *what is true about this product*. They presuppose a
 * product, and until now the operator picked it by hand. Stage 0 is the step
 * before: find shops whose traffic is genuinely compounding, keep the ones that
 * look like real businesses in markets we sell to, and rank what they sell by
 * whether it would carry a ~28-day subscription.
 *
 * ## The pipeline
 *
 *     A  discover     POST /v1/shops/query × pages        1 credit per row
 *     B  shape        sort history, count ups, ratio      free
 *     C  gate         ups, baseline, duplicates           free
 *     D  markets      top country must be a big five      free
 *     E  trustpilot   GET /v1/shops/{id} per survivor      1 credit each
 *     F  mrr          one LLM call per batch of products   tokens, not credits
 *     G  rank         by MRR score, descending             free
 *
 * Every stage records how many rows it dropped, because "I got four results" is
 * useless without knowing which gate ate the other four hundred.
 *
 * ## Three corrections to the shell pipeline this replaces
 *
 * The original was a `for`-loop of curls piped through jq. Ported faithfully
 * except where it was wrong, and it was wrong in three places:
 *
 * 1. **`marketCountries` → `mainMarketCountries`.** Measured 2026-09-12:
 *    `marketCountries: ["US","GB","AU","NZ","CA"]` matched 17,604 shops and
 *    returned `chiikawamarket.jp` (JP 57%, US 7%) and `discoverpilgrim.com`
 *    (IN 92%, US 1%) on the first page. It matches *any* presence in those
 *    countries, not the main market. `mainMarketCountries` matched 13,023 and
 *    every sampled row had a big-five top country. The client-side check in
 *    step D stays anyway — the server-side filter is not documented to mean
 *    "top country by share", so it is treated as a narrowing, not a guarantee.
 * 2. **`traffic.history` is sorted before use.** The jq read
 *    `[.traffic.history[].value]` in wire order and computed `$h[-1] / $h[0]`.
 *    The live API happens to return ascending periods, so it worked; nothing
 *    documents that it must, and `six_month_growth.ts` sorts defensively for
 *    the same reason. An unsorted series inverts the ratio and silently ranks
 *    the fastest-shrinking shops first.
 * 3. **Trustpilot cannot be pushed into the query.** `minTrustpilotRating: 3`
 *    on `/v1/shops/query` would be free, and would also drop every shop with no
 *    Trustpilot profile — which the policy here keeps. Hence a detail call per
 *    survivor, after the free gates have cut the list down.
 *
 * The detail call bought for Trustpilot also carries `growth180d`, so the t-6
 * reconstruction from `six_month_growth.ts` comes free with it. One credit, two
 * answers.
 */

import { z } from "zod";

import { mapPool } from "./http.js";
import {
  buildMrrInstructions,
  parseMrrVerdicts,
  MRR_SYSTEM_PROMPT,
  type MrrCandidate,
} from "./mrr-prompt.js";
import { CachedTrendTrackClient, type CacheLedger } from "./trendtrack-cache.js";
import {
  DETAIL_CONCURRENCY,
  MAX_PAGE_SIZE,
  emptyLedger,
  ledgerTotal,
  type CreditLedger,
  type ShopDetail,
  type ShopSummary,
  type TrendTrackClient,
} from "./trendtrack.js";

/**
 * The markets we sell to. ISO 3166-1 alpha-2, and the reason they are one group
 * is that they share a language, a returns culture and a shipping story.
 */
export const BIG_FIVE = ["US", "GB", "CA", "NZ", "AU"] as const;
export type BigFive = (typeof BIG_FIVE)[number];

/** Trustpilot's floor. A shop below this is selling badly, whatever its traffic says. */
export const MIN_TRUSTPILOT_RATING = 3;

/**
 * Titles in the best-seller feed that are not products.
 *
 * From `trendtrack/product-finder.md` §F6, where a `10 Year Warranty` was
 * ranked #2 in one shop's feed. These are dropped before the model sees them:
 * the rubric would score them 0 anyway, and paying tokens to be told so is waste.
 */
const NOT_A_PRODUCT =
  /warrant|booklet|leaflet|gift\s?card|sticker|t-?shirt|hoodie|\bcap\b|sample|ebook|shipping|insurance|thank you card/i;

export const stageZeroParamsSchema = z
  .object({
    /** Pages of 100. Five pages = 500 rows = 500 credits, the shell default. */
    pages: z.number().int().min(1).max(20).default(5),
    minMonthlyVisits: z.number().int().min(0).default(5000),
    minActiveAds: z.number().int().min(0).default(5),
    minProductsCount: z.number().int().min(0).default(10),
    /** Percent. `trafficGrowth` conditions, as the API wants them. */
    minGrowth180d: z.number().default(50),
    minGrowth90d: z.number().default(20),
    /** Months in the 6-point series that must be higher than the month before. */
    minUps: z.number().int().min(0).max(5).default(4),
    /**
     * Floor on the *oldest* month in the series. Sorting by growth surfaces
     * tiny-baseline explosions — `product-finder.md` §4 caught a `growth30d` of
     * 23.67, meaning +2367%, from a shop that went from almost nothing to
     * slightly more than nothing.
     */
    minBaseline: z.number().int().min(0).default(20000),
    minTrustpilotRating: z.number().min(0).max(5).default(MIN_TRUSTPILOT_RATING),
    /** Candidates per LLM call. Large batches make the reply less reliable. */
    mrrBatchSize: z.number().int().min(1).max(200).default(60),
    model: z.string().default(""),
  })
  .strict();
export type StageZeroParams = z.infer<typeof stageZeroParamsSchema>;

/** A month in the reconstructed series. Ported from `six_month_growth.ts`. */
export interface Month {
  /** 0 = latest observed month (t), 1 = t-1, … */
  offset: number;
  label: string;
  period: string;
  visits: number | null;
  estimated: boolean;
  low?: number;
  high?: number;
}

export interface ShopCandidate {
  id: string;
  domain: string;
  name: string;
  category: string;
  monthlyVisits: number | null;
  growth30d: number | null;
  growth90d: number | null;
  growth180d: number | null;
  /** Observed monthly traffic, oldest first. */
  history: number[];
  /** Months rising against the month before, out of `history.length - 1`. */
  ups: number;
  /** Latest ÷ oldest observed month. */
  ratio: number;
  activeAds: number | null;
  productsCount: number | null;
  topMarket: string | null;
  topMarketShare: number | null;
  bigFiveShare: number;
  trustpilotRating: number | null;
  trustpilotReviews: number | null;
  /** t … t-6, the last estimated from `growth180d`. Empty when unavailable. */
  months: Month[];
  /** Set when the t-6 estimate should not be trusted — see `tMinus6`. */
  tMinus6Warning: string;
  /** Best MRR score among this shop's scored products. Null when none were scored. */
  mrrScore: number | null;
}

export interface ScoredProduct {
  shopId: string;
  domain: string;
  category: string;
  title: string;
  price: number | null;
  currency: string;
  /** 0–10, or null when the model returned no verdict for it. */
  score: number | null;
  reason: string;
}

/** Where the candidates went. Counts, not adjectives. */
export interface Funnel {
  returned: number;
  /** Distinct shop ids. Paging can return the same shop twice. */
  afterDuplicates: number;
  afterSeries: number;
  afterUps: number;
  afterBaseline: number;
  /** After collapsing one business indexed under two domains. */
  afterMirrors: number;
  afterBigFive: number;
  afterTrustpilot: number;
  productsConsidered: number;
  productsScored: number;
}

export interface StageZeroResult {
  params: StageZeroParams;
  /** What the query matched in total, before paging. Free information, worth keeping. */
  matchedTotal: number;
  funnel: Funnel;
  credits: CreditLedger & { total: number };
  /**
   * What the response cache did, when one is in use. `creditsSaved` is a sum of
   * prices actually paid earlier, not an estimate, and `oldestUsedSeconds` is
   * how stale the oldest reused response was — read a cached run with that in
   * mind, particularly for `activeAds`, which is a 30-day figure.
   */
  cache: (CacheLedger & { maxAgeDays: number }) | null;
  shops: ShopCandidate[];
  products: ScoredProduct[];
  /** Anything that went wrong without stopping the run. Never silently swallowed. */
  problems: string[];
  finishedAt: string;
}

/** One LLM turn. Injected so the pipeline is testable without a provider. */
export type Ask = (system: string, instructions: string, signal?: AbortSignal) => Promise<string>;

export type Progress = (step: string, detail: Record<string, unknown>) => void;

// -- pure shaping ------------------------------------------------------------

/**
 * Monthly traffic, oldest first.
 *
 * Sorted by period rather than trusted in wire order. See correction 2 in the
 * module note: the ratio inverts if this is wrong, and it fails silently.
 */
export function trafficSeries(shop: Pick<ShopSummary, "traffic">): number[] {
  const history = shop.traffic?.history ?? [];
  return [...history]
    .filter((p) => p && typeof p.value === "number")
    .sort((a, b) => a.period.localeCompare(b.period))
    .map((p) => p.value);
}

/** Months that rose against the month before. */
export function countUps(series: readonly number[]): number {
  let ups = 0;
  for (let i = 1; i < series.length; i++) {
    if (series[i]! > series[i - 1]!) ups += 1;
  }
  return ups;
}

/** Latest ÷ oldest. Null when the baseline is zero, which makes the ratio meaningless. */
export function growthRatio(series: readonly number[]): number | null {
  const first = series[0];
  const last = series[series.length - 1];
  if (first === undefined || last === undefined || first <= 0) return null;
  return Math.round((last / first) * 100) / 100;
}

/** The market with the largest visit share, and that share. */
export function topMarket(shop: Pick<ShopSummary, "traffic">): { code: string | null; share: number | null } {
  const countries = shop.traffic?.topCountries ?? [];
  let best: { code: string | null; share: number | null } = { code: null, share: null };
  for (const country of countries) {
    if (!country?.countryCode) continue;
    if (best.share === null || country.share > best.share) {
      best = { code: country.countryCode.toUpperCase(), share: country.share };
    }
  }
  return best;
}

/** Combined visit share across the big five, for the record even when the top market decides. */
export function bigFiveShare(shop: Pick<ShopSummary, "traffic">): number {
  const countries = shop.traffic?.topCountries ?? [];
  return countries
    .filter((c) => c?.countryCode && (BIG_FIVE as readonly string[]).includes(c.countryCode.toUpperCase()))
    .reduce((sum, c) => sum + (c.share ?? 0), 0);
}

/** Step back one calendar month from a `YYYY-MM-DD` period. From `six_month_growth.ts`. */
export function prevPeriod(period: string): string {
  const [y, m] = period.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return "";
  const d = new Date(Date.UTC(y!, m! - 1, 1));
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Bounds implied by a value rounded to `dp` places.
 *
 * `growth180d` arrives rounded to 2dp, so -0.35 means the true value is
 * somewhere in [-0.355, -0.345). The t-6 estimate inherits that width, and
 * reporting a single number for it would overstate what the API knows.
 */
export function roundingBounds(v: number, dp = 2): [number, number] {
  const half = 0.5 / 10 ** dp;
  return [v - half, v + half];
}

/**
 * Reconstruct t … t-6, the last month estimated from `growth180d`.
 *
 * Ported from `six_month_growth.ts`, including its caution: `growth180d` is
 * only invertible into a single month if the API defines growth point-to-point
 * (t ÷ t-6 - 1) rather than over trailing sums. Both readings are checked
 * against the reported `growth90d` and the closer one is believed; when
 * trailing-sums fits better the estimate is still returned, with a warning
 * saying not to trust it. Dropping it silently would hide the disagreement.
 */
export function tMinus6(
  series: readonly number[],
  periods: readonly string[],
  growth: { growth90d?: number | null; growth180d?: number | null },
): { months: Month[]; warning: string } {
  const newestFirst = [...series].reverse();
  const periodsNewestFirst = [...periods].reverse();
  const months: Month[] = newestFirst.map((value, i) => ({
    offset: i,
    label: i === 0 ? "t" : `t-${i}`,
    period: periodsNewestFirst[i] ?? "",
    visits: value,
    estimated: false,
  }));

  const t = months[0];
  if (!t?.visits) return { months, warning: "no latest month to project from" };

  let warning = "";
  const g90 = growth.growth90d;
  if (g90 != null && months.length >= 6) {
    const tMinus3 = months[3]?.visits ?? null;
    const pointToPoint = tMinus3 ? t.visits / tMinus3 - 1 : null;
    const recent = months.slice(0, 3).reduce((s, m) => s + (m.visits ?? 0), 0);
    const prior = months.slice(3, 6).reduce((s, m) => s + (m.visits ?? 0), 0);
    const trailingSums = prior > 0 ? recent / prior - 1 : null;

    const dPoint = pointToPoint == null ? Infinity : Math.abs(pointToPoint - g90);
    const dSums = trailingSums == null ? Infinity : Math.abs(trailingSums - g90);
    if (dSums < dPoint && Math.abs(dPoint - dSums) >= 0.005) {
      warning =
        "growth90d fits trailing-sums better than point-to-point, so t-6 is not " +
        "recoverable as a single month; treat the estimate as indicative only";
    }
  }

  const g180 = growth.growth180d;
  if (g180 != null && 1 + g180 > 0) {
    const [lo, hi] = roundingBounds(g180, 2);
    months.push({
      offset: months.length,
      label: `t-${months.length}`,
      period: prevPeriod(months[months.length - 1]?.period ?? ""),
      visits: Math.round(t.visits / (1 + g180)),
      estimated: true,
      // Lower growth implies a larger base, so the bounds invert.
      low: Math.round(t.visits / (1 + hi)),
      high: Math.round(t.visits / (1 + lo)),
    });
  } else if (!warning) {
    warning = "growth180d missing or <= -100%, so t-6 could not be estimated";
  }

  return { months, warning };
}

// -- the pipeline ------------------------------------------------------------

/**
 * Page through `/v1/shops/query`.
 *
 * Stops early when a page comes back short or the total is exhausted, because
 * every row is a credit and paging past the end costs nothing but is pointless.
 * A failing page is **not** retried: a retried page is a page paid for twice.
 */
export async function discoverShops(
  client: TrendTrackClient,
  params: StageZeroParams,
  signal?: AbortSignal,
  onProgress?: Progress,
): Promise<{ shops: ShopSummary[]; matchedTotal: number }> {
  const shops: ShopSummary[] = [];
  let matchedTotal = 0;

  for (let page = 0; page < params.pages; page++) {
    if (signal?.aborted) break;
    const offset = page * MAX_PAGE_SIZE;
    const { data, pagination } = await client.queryShops(
      {
        sortBy: "monthlyVisits",
        order: "desc",
        minMonthlyVisits: params.minMonthlyVisits,
        minActiveAds: params.minActiveAds,
        adsTimePeriod: "last30d",
        minProductsCount: params.minProductsCount,
        // See correction 1 in the module note. Not `marketCountries`.
        mainMarketCountries: [...BIG_FIVE],
        trafficGrowth: [
          { period: "last180d", comparison: "greater", value: params.minGrowth180d, operator: "and" },
          { period: "last90d", comparison: "greater", value: params.minGrowth90d },
        ],
        limit: MAX_PAGE_SIZE,
        offset,
      },
      signal,
    );
    matchedTotal = pagination.total || matchedTotal;
    shops.push(...data);
    onProgress?.("discover", { page: page + 1, returned: data.length, total: shops.length });
    if (data.length < MAX_PAGE_SIZE) break;
    if (offset + data.length >= matchedTotal) break;
  }

  return { shops, matchedTotal };
}

/**
 * The free gates: duplicates, series length, ups, baseline, market.
 *
 * Split out from `runStageZero` so it can be tested against fixtures without a
 * key — these five rules are where a run's yield is actually decided.
 */
export function applyFreeGates(
  shops: readonly ShopSummary[],
  params: StageZeroParams,
): { kept: Array<{ shop: ShopSummary; series: number[]; ups: number; ratio: number }>; funnel: Funnel } {
  const funnel: Funnel = {
    returned: shops.length,
    afterDuplicates: 0,
    afterSeries: 0,
    afterUps: 0,
    afterBaseline: 0,
    afterMirrors: 0,
    afterBigFive: 0,
    afterTrustpilot: 0,
    productsConsidered: 0,
    productsScored: 0,
  };

  // Paging can return the same shop twice. Id catches that, and it is the only
  // dedupe safe to run this early — see the mirror-domain pass further down.
  const byId = new Set<string>();
  const deduped: ShopSummary[] = [];
  for (const shop of shops) {
    if (!shop?.id || byId.has(shop.id)) continue;
    byId.add(shop.id);
    deduped.push(shop);
  }
  funnel.afterDuplicates = deduped.length;

  const withSeries = deduped
    .map((shop) => ({ shop, series: trafficSeries(shop) }))
    .filter((row) => row.series.length >= 6);
  funnel.afterSeries = withSeries.length;

  const withUps = withSeries
    .map((row) => ({ ...row, ups: countUps(row.series) }))
    .filter((row) => row.ups >= params.minUps);
  funnel.afterUps = withUps.length;

  const withBaseline = withUps
    .map((row) => ({ ...row, ratio: growthRatio(row.series) }))
    .filter(
      (row): row is typeof row & { ratio: number } =>
        row.ratio !== null && (row.series[0] ?? 0) >= params.minBaseline,
    );
  funnel.afterBaseline = withBaseline.length;

  /*
   * One business indexed under two domains — the shell pipeline's
   * `unique_by(.hist)`. Six identical absolute visit counts do not happen twice
   * by chance, so an identical series means the same shop.
   *
   * It runs *here* rather than with the id dedupe above, and that ordering is
   * the whole safety of it: a degenerate series (all zeros, or a handful of
   * identical small numbers) collides across genuinely different shops, and
   * deduping before the baseline gate would silently drop real ones. By this
   * point every row has six months and a baseline over the floor.
   */
  const byHistory = new Set<string>();
  const unmirrored = withBaseline.filter((row) => {
    const fingerprint = row.series.join(",");
    if (byHistory.has(fingerprint)) return false;
    byHistory.add(fingerprint);
    return true;
  });
  funnel.afterMirrors = unmirrored.length;

  // See correction 1: the server-side filter is treated as a narrowing, not a
  // guarantee, so the top market is checked here regardless.
  const kept = unmirrored.filter((row) => {
    const top = topMarket(row.shop);
    return top.code !== null && (BIG_FIVE as readonly string[]).includes(top.code);
  });
  funnel.afterBigFive = kept.length;

  kept.sort((a, b) => b.ratio - a.ratio);
  return { kept, funnel };
}

/**
 * Keep a shop when Trustpilot says nothing bad, or says nothing at all.
 *
 * A missing profile is **not** a failing one. Plenty of real shops never set
 * Trustpilot up, and `product-finder.md` §5's standing rule applies: a missing
 * value means "not measured", and treating it as zero reads as "rated badly".
 */
export function passesTrustpilot(detail: Pick<ShopDetail, "trustpilot">, minRating: number): boolean {
  const rating = detail.trustpilot?.rating;
  if (rating == null) return true;
  return rating >= minRating;
}

/** Best-seller titles worth spending tokens on. */
export function productCandidates(shops: readonly ShopCandidate[], bestSellers: Map<string, Array<{ title: string; price: number | null; currency: string }>>): MrrCandidate[] {
  const candidates: MrrCandidate[] = [];
  let ref = 0;
  for (const shop of shops) {
    for (const product of bestSellers.get(shop.id) ?? []) {
      const title = (product.title ?? "").trim();
      // A title with no letters is a placeholder, not a product: `worldofbooks.com`
      // returns three best sellers all titled "!". Nothing can be judged from it,
      // and asking the model to try is paying to be told so.
      if (!/[a-z]/i.test(title) || title.length < 3) continue;
      if (NOT_A_PRODUCT.test(title)) continue;
      candidates.push({
        ref: ref++,
        domain: shop.domain,
        category: shop.category,
        title,
        price: product.price,
        currency: product.currency,
      });
    }
  }
  return candidates;
}

/** Attempts per batch, including the first. */
const ASK_ATTEMPTS = 3;

/**
 * Ask once, retrying a failed call.
 *
 * Measured: a live run lost all 24 of its candidates to a single
 * `Connection error.` from the provider, and the identical run a minute later
 * scored 24 of 24. The call is idempotent and costs tokens rather than
 * credits, so a transient blip should not throw away a batch. A *malformed
 * reply* is not retried — that is handled by `parseMrrVerdicts`, which keeps
 * whatever verdicts were valid.
 */
async function askWithRetry(ask: Ask, instructions: string, signal?: AbortSignal): Promise<string> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= ASK_ATTEMPTS; attempt++) {
    try {
      return await ask(MRR_SYSTEM_PROMPT, instructions, signal);
    } catch (error) {
      lastError = error;
      if (attempt === ASK_ATTEMPTS || signal?.aborted) break;
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** (attempt - 1)));
    }
  }
  throw lastError;
}

/**
 * Score candidates in batches, merging the verdicts.
 *
 * A batch that fails every attempt is reported and skipped rather than failing
 * the run: eight of nine batches scored is a useful result, and losing it
 * because the ninth model reply was malformed is not.
 */
export async function scoreMrr(
  candidates: readonly MrrCandidate[],
  ask: Ask,
  batchSize: number,
  signal?: AbortSignal,
  onProgress?: Progress,
): Promise<{ scores: Map<number, { score: number; reason: string }>; problems: string[] }> {
  const scores = new Map<number, { score: number; reason: string }>();
  const problems: string[] = [];

  for (let start = 0; start < candidates.length; start += batchSize) {
    if (signal?.aborted) break;
    const batch = candidates.slice(start, start + batchSize);
    const known = new Set(batch.map((c) => c.ref));
    const batchNumber = Math.floor(start / batchSize) + 1;
    try {
      const output = await askWithRetry(ask, buildMrrInstructions(batch), signal);
      const { verdicts, problems: batchProblems } = parseMrrVerdicts(output, known);
      for (const verdict of verdicts) {
        scores.set(verdict.ref, { score: verdict.score, reason: verdict.reason });
      }
      for (const problem of batchProblems) problems.push(`batch ${batchNumber}: ${problem}`);
      const missing = batch.length - verdicts.length;
      if (missing > 0) {
        // Left unscored rather than defaulted to 0 — a 0 here would read as
        // "durable" when it means "the model did not answer".
        problems.push(`batch ${batchNumber}: ${missing} of ${batch.length} candidates went unscored`);
      }
      onProgress?.("mrr", { batch: batchNumber, scored: verdicts.length, of: batch.length });
    } catch (error) {
      problems.push(
        `batch ${batchNumber} failed and was skipped: ${(error as Error).message}`.slice(0, 300),
      );
    }
  }

  return { scores, problems };
}

/** Run the whole of stage 0. */
export async function runStageZero(options: {
  client: TrendTrackClient;
  params: StageZeroParams;
  ask: Ask;
  signal?: AbortSignal;
  onProgress?: Progress;
}): Promise<StageZeroResult> {
  const { client, params, ask, signal, onProgress } = options;
  const problems: string[] = [];

  // A. discover
  const { shops: returned, matchedTotal } = await discoverShops(client, params, signal, onProgress);

  // B–D. the free gates
  const { kept, funnel } = applyFreeGates(returned, params);
  onProgress?.("gates", { ...funnel });

  // E. Trustpilot, one credit per survivor. This is the only place stage 0
  // spends a credit per shop rather than per row, so it runs last of the filters.
  const details = await mapPool(kept, DETAIL_CONCURRENCY, async (row) => {
    if (signal?.aborted) return null;
    try {
      return await client.getShop(row.shop.id, signal);
    } catch (error) {
      problems.push(`${row.shop.domain}: detail call failed (${(error as Error).message})`.slice(0, 300));
      return null;
    }
  });

  const bestSellers = new Map<string, Array<{ title: string; price: number | null; currency: string }>>();
  const candidateShops: ShopCandidate[] = [];

  kept.forEach((row, i) => {
    const detail = details[i] ?? null;
    // A shop whose detail call failed is kept: the call was for Trustpilot, and
    // a network error is not evidence of a bad rating. It carries null ratings
    // and its t-6 is absent, both of which are visible in the result.
    if (detail && !passesTrustpilot(detail, params.minTrustpilotRating)) return;

    const series = row.series;
    const periods = [...(row.shop.traffic?.history ?? [])]
      .sort((a, b) => a.period.localeCompare(b.period))
      .map((p) => p.period);
    const { months, warning } = detail
      ? tMinus6(series, periods, {
          growth90d: detail.traffic?.growth90d ?? null,
          growth180d: detail.traffic?.growth180d ?? null,
        })
      : { months: [], warning: "detail call failed, so no long-window growth was available" };

    const top = topMarket(row.shop);
    const shop: ShopCandidate = {
      id: row.shop.id,
      domain: row.shop.domain,
      name: row.shop.name ?? "",
      category: row.shop.catalog?.mainCategory ?? "",
      monthlyVisits: row.shop.traffic?.monthlyVisits ?? null,
      growth30d: row.shop.traffic?.growth30d ?? null,
      growth90d: detail?.traffic?.growth90d ?? null,
      growth180d: detail?.traffic?.growth180d ?? null,
      history: series,
      ups: row.ups,
      ratio: row.ratio,
      activeAds: row.shop.advertising?.activeAds ?? null,
      productsCount: row.shop.catalog?.productsCount ?? null,
      topMarket: top.code,
      topMarketShare: top.share,
      bigFiveShare: Math.round(bigFiveShare(row.shop) * 1000) / 1000,
      trustpilotRating: detail?.trustpilot?.rating ?? null,
      trustpilotReviews: detail?.trustpilot?.reviewCount ?? null,
      months,
      tMinus6Warning: warning,
      mrrScore: null,
    };
    candidateShops.push(shop);
    bestSellers.set(
      shop.id,
      (row.shop.catalog?.bestSellers ?? []).map((p) => ({
        title: p.title ?? "",
        price: typeof p.price === "number" ? p.price : null,
        currency: p.currency ?? "",
      })),
    );
  });
  funnel.afterTrustpilot = candidateShops.length;
  onProgress?.("trustpilot", { kept: candidateShops.length, of: kept.length });

  // F. the MRR judgement
  const candidates = productCandidates(candidateShops, bestSellers);
  funnel.productsConsidered = candidates.length;
  const { scores, problems: mrrProblems } = candidates.length
    ? await scoreMrr(candidates, ask, params.mrrBatchSize, signal, onProgress)
    : { scores: new Map<number, { score: number; reason: string }>(), problems: [] };
  problems.push(...mrrProblems);
  funnel.productsScored = scores.size;

  const byDomain = new Map(candidateShops.map((s) => [s.domain, s]));
  const products: ScoredProduct[] = candidates.map((candidate) => {
    const verdict = scores.get(candidate.ref);
    const shop = byDomain.get(candidate.domain);
    return {
      shopId: shop?.id ?? "",
      domain: candidate.domain,
      category: candidate.category,
      title: candidate.title,
      price: candidate.price,
      currency: candidate.currency,
      score: verdict?.score ?? null,
      reason: verdict?.reason ?? "",
    };
  });

  // G. rank. Unscored products sort last rather than as zero.
  products.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

  for (const shop of candidateShops) {
    const own = products.filter((p) => p.shopId === shop.id && p.score !== null);
    shop.mrrScore = own.length ? Math.max(...own.map((p) => p.score!)) : null;
  }
  candidateShops.sort((a, b) => (b.mrrScore ?? -1) - (a.mrrScore ?? -1) || b.ratio - a.ratio);

  const ledger = { ...(client.ledger ?? emptyLedger()) };
  const cache =
    client instanceof CachedTrendTrackClient && client.enabled
      ? { ...client.cache, maxAgeDays: client.maxAgeDays }
      : null;
  return {
    params,
    matchedTotal,
    funnel,
    credits: { ...ledger, total: ledgerTotal(ledger) },
    cache,
    shops: candidateShops,
    products,
    problems,
    finishedAt: new Date().toISOString(),
  };
}
