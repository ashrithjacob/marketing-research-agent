import { useCallback, useEffect, useRef, useState } from 'react';
import {
  api,
  DISCOVERY_TERMINAL,
  type Config,
  type DiscoveryRun,
  type DiscoverySummary,
  type Funnel,
  type ScoredProduct,
  type ShopCandidate,
  type StageZeroParams,
  type StageZeroResult,
} from './api';

/** Stage 0 — the product finder.
 *
 *  Three things this view owes the operator, in this order:
 *
 *  1. **What it will cost, before the button.** TrendTrack bills per returned
 *     row, so five pages is five hundred credits of a monthly ten thousand.
 *     A run is not undoable and the price is not obvious from the form.
 *  2. **The funnel, not just the survivors.** "Four results" is unreadable
 *     without knowing which gate ate the other four hundred and ninety-six.
 *  3. **The difference between a zero and a blank.** An unscored product is
 *     not a product scored zero — zero means durable. They are drawn differently
 *     on purpose.
 *
 *  Polls rather than streams: the pipeline is about a minute and has seven
 *  steps, so an SSE channel would be more machinery than the problem needs.
 */
export default function Discovery({ config }: { config: Config | null }) {
  const [runs, setRuns] = useState<DiscoverySummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [run, setRun] = useState<DiscoveryRun | null>(null);
  const [params, setParams] = useState<Partial<StageZeroParams>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Bumped when the cache is emptied, so the cost card reloads its counts.
  const [cacheRev, setCacheRev] = useState(0);
  const [cacheNow, setCacheNow] = useState<Config['stage0']['cache'] | null>(null);

  const base = config?.stage0;
  // Cache counts move as runs happen, so they are refetched rather than read
  // from the config snapshot taken when the page loaded.
  const stage0 = base && { ...base, cache: cacheNow ?? base.cache };
  const effective = { ...(base?.defaults ?? {}), ...params } as StageZeroParams;

  const loadRuns = useCallback(async () => {
    try {
      const { data } = await api.discoveries();
      setRuns(data);
      setActiveId((current) => current ?? data[0]?.id ?? null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  useEffect(() => {
    api
      .cacheStats()
      .then(setCacheNow)
      .catch(() => undefined);
  }, [cacheRev, runs.length]);

  // Poll the active run while it is live, then once more after it settles so
  // the final result lands without waiting for the next tick.
  const pollRef = useRef<number | null>(null);
  useEffect(() => {
    if (!activeId) {
      setRun(null);
      return;
    }
    let cancelled = false;
    const tick = async () => {
      try {
        const detail = await api.discovery(activeId);
        if (cancelled) return;
        setRun(detail);
        if (DISCOVERY_TERMINAL.has(detail.status)) {
          if (pollRef.current) window.clearInterval(pollRef.current);
          pollRef.current = null;
          void loadRuns();
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    };
    void tick();
    pollRef.current = window.setInterval(tick, 2000);
    return () => {
      cancelled = true;
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [activeId, loadRuns]);

  async function start() {
    setBusy(true);
    setError('');
    try {
      const started = await api.startDiscovery(params);
      await loadRuns();
      setActiveId(started.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    if (!run) return;
    try {
      await api.stopDiscovery(run.id);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (stage0 && !stage0.configured) {
    return (
      <div className="empty intro">
        <h2>Stage 0 — product finder</h2>
        <p>
          <code>TRENDTRACK_API_KEY</code> is not set, so stage 0 cannot run. It
          is the only stage that spends money per row rather than per token,
          which is why it refuses to start rather than failing halfway through a
          paid pipeline.
        </p>
      </div>
    );
  }

  const live = !!run && !DISCOVERY_TERMINAL.has(run.status);
  const result = run?.result ?? null;

  return (
    <div className="cols discovery">
      <aside className="runlist">
        {/* Not `.bar` — that is the 2px indeterminate progress bar in
            RunView, and it clips its children to nothing. */}
        <div className="panelbar">
          <span className="brand-sub">runs</span>
        </div>
        {runs.map((r) => (
          <button
            key={r.id}
            className={`runrow ${r.id === activeId ? 'now' : ''}`}
            onClick={() => setActiveId(r.id)}
          >
            <div className="runrow-top">
              <span className="runrow-title">
                {r.products} product{r.products === 1 ? '' : 's'}
              </span>
              <span className={`status ${r.status}`}>{r.status}</span>
            </div>
            <div className="runrow-sub">
              {new Date(r.created_at).toLocaleString()}
              {r.credits ? ` · ${r.credits.total} credits` : ''}
            </div>
          </button>
        ))}
        {runs.length === 0 && <p className="muted small pad">No runs yet.</p>}
      </aside>

      <section className="mid">
        <div className="panelbar">
          <span className="brand-sub">stage 0 · product finder</span>
          {live && <span className="pill pulse">running</span>}
          {live ? (
            <button className="ghost" onClick={stop}>
              Stop
            </button>
          ) : (
            <button className="primary" disabled={busy} onClick={start}>
              {busy ? 'Starting…' : 'Find products'}
            </button>
          )}
        </div>

        {error && (
          <div className="error banner" onClick={() => setError('')}>
            {error}
          </div>
        )}

        <Cost
          effective={effective}
          stage0={stage0}
          onCleared={() => setCacheRev((n) => n + 1)}
        />

        <Params
          effective={effective}
          disabled={live || busy}
          onChange={(patch) => setParams((p) => ({ ...p, ...patch }))}
        />

        {live && <Progress run={run!} />}

        {run?.error && (
          <div className="error-note">
            <b>{run.status}</b> — {run.error}
          </div>
        )}

        {result && (
          <Funnelled
            funnel={result.funnel}
            matched={result.matchedTotal}
            credits={result.credits}
            cache={result.cache}
          />
        )}
        {result && result.problems.length > 0 && (
          <div className="card">
            <h3>What went wrong without stopping the run</h3>
            <ul className="small">
              {result.problems.map((p, i) => (
                <li key={i} className="warn">
                  {p}
                </li>
              ))}
            </ul>
          </div>
        )}
        {result && <Products products={result.products} />}
      </section>

      <aside className="mid">
        {result ? (
          <Shops shops={result.shops} />
        ) : (
          <div className="empty intro">
            <h2>Stage 0</h2>
            <p>
              Find shops whose traffic is genuinely compounding, keep the ones
              that look like real businesses in the big five markets, and rank
              what they sell by whether it would carry a 28-day subscription.
            </p>
            <p className="muted">
              The output is a ranked product list, each row carrying the shop it
              came from and one sentence of reasoning. It is the input to a
              stage-1 brief.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}

/** What the run will cost, in the units the operator is billed in. */
function Cost({
  effective,
  stage0,
  onCleared,
}: {
  effective: StageZeroParams;
  stage0: Config['stage0'] | undefined;
  onCleared: () => void;
}) {
  const rows = (effective.pages ?? 0) * 100;
  const cache = stage0?.cache;
  const days = stage0?.cache_days ?? 0;

  async function clear() {
    const held = cache?.creditsStored ?? 0;
    if (
      !window.confirm(
        `Empty the response cache?\n\n${cache?.entries ?? 0} responses, worth ` +
          `${held} credits. Everything dropped has to be bought again.`,
      )
    ) {
      return;
    }
    await api.clearCache();
    onCleared();
  }

  return (
    <div className="card cost">
      <h3>What this will cost</h3>
      <p className="small">
        Up to <b>{rows}</b> credits for discovery — TrendTrack bills one credit
        per returned shop, so {effective.pages} page
        {effective.pages === 1 ? '' : 's'} of 100 is {rows}. Then <b>one more
        per surviving shop</b> for its Trustpilot rating and long-window growth,
        which is why the free gates run first.
      </p>
      <p className="small muted">
        A short page ends discovery early, so a narrow filter costs less than
        this ceiling. The exact figure is reported when the run finishes.
      </p>
      {days > 0 && (
        <div className="cacheline">
          <span className="small">
            Responses are reused for <b>{days} days</b>
            {cache && cache.entries > 0 ? (
              <>
                {' '}— <b>{cache.entries}</b> held, worth{' '}
                <b>{cache.creditsStored}</b> credits already paid. Changing the
                gates below re-runs for <b>free</b>; changing visits, ads,
                catalog size or growth buys new rows.
              </>
            ) : (
              <> — nothing held yet, so this first run pays full price.</>
            )}
          </span>
          {cache && cache.entries > 0 && (
            <button className="ghost small" onClick={clear}>
              Empty cache
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** What the cache did on a finished run. */
function CacheResult({ cache }: { cache: NonNullable<StageZeroResult['cache']> }) {
  const days = cache.oldestUsedSeconds / 86400;
  return (
    <p className="small">
      Cache: <b>{cache.hits}</b> response{cache.hits === 1 ? '' : 's'} reused,
      saving <b>{cache.creditsSaved}</b> credits; {cache.misses} fetched
      {cache.stale > 0 ? `, ${cache.stale} expired and refetched` : ''}.
      {cache.hits > 0 && (
        <span className="muted">
          {' '}
          Oldest reused response was {days < 1 ? '<1' : days.toFixed(1)} day
          {days >= 2 ? 's' : ''} old — fine for a six-month traffic series, worth
          remembering for <code>active ads</code>, which is a 30-day figure.
        </span>
      )}
    </p>
  );
}

const FIELDS: Array<{ key: keyof StageZeroParams; label: string; hint: string; step?: number }> = [
  { key: 'pages', label: 'Pages of 100', hint: '1 credit per row returned' },
  { key: 'minMonthlyVisits', label: 'Min monthly visits', hint: 'shop-level floor', step: 1000 },
  { key: 'minActiveAds', label: 'Min active ads', hint: 'measured over last 30d' },
  { key: 'minProductsCount', label: 'Min catalog size', hint: 'excludes one-product stores' },
  { key: 'minGrowth180d', label: 'Min 180d growth %', hint: 'server-side condition' },
  { key: 'minGrowth90d', label: 'Min 90d growth %', hint: 'server-side condition' },
  { key: 'minUps', label: 'Rising months (of 5)', hint: 'months above the month before' },
  { key: 'minBaseline', label: 'Min baseline visits', hint: 'kills tiny-baseline noise', step: 1000 },
];

function Params({
  effective,
  disabled,
  onChange,
}: {
  effective: StageZeroParams;
  disabled: boolean;
  onChange: (patch: Partial<StageZeroParams>) => void;
}) {
  return (
    <div className="card">
      <h3>Filters</h3>
      <div className="paramgrid">
        {FIELDS.map((field) => (
          <label key={field.key} className="param">
            <span>{field.label}</span>
            <input
              type="number"
              step={field.step ?? 1}
              disabled={disabled}
              value={String(effective[field.key] ?? '')}
              onChange={(e) => onChange({ [field.key]: Number(e.target.value) } as Partial<StageZeroParams>)}
            />
            <span className="muted small">{field.hint}</span>
          </label>
        ))}
      </div>
      <p className="small muted">
        Markets are fixed to the big five (US, GB, CA, NZ, AU) and checked twice:
        once server-side and once on the top country by visit share, because the
        server-side filter matches any presence in those countries rather than
        the main market. Trustpilot keeps anything rated{' '}
        {effective.minTrustpilotRating} or better, and keeps shops with no
        profile at all — missing is not failing.
      </p>
    </div>
  );
}

function Progress({ run }: { run: DiscoveryRun }) {
  const recent = run.progress.slice(-8).reverse();
  return (
    <div className="card">
      <h3>Progress</h3>
      {recent.length === 0 && <p className="muted small">Starting…</p>}
      <ul className="small trace">
        {recent.map((p, i) => (
          <li key={i}>
            <b>{p.step}</b>{' '}
            <span className="muted">
              {Object.entries(p.detail)
                .map(([k, v]) => `${k}=${String(v)}`)
                .join(' · ')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const FUNNEL_ROWS: Array<[keyof Funnel, string]> = [
  ['returned', 'rows returned'],
  ['afterDuplicates', 'distinct shop ids'],
  ['afterSeries', 'have 6 months of history'],
  ['afterUps', 'enough rising months'],
  ['afterBaseline', 'baseline above the floor'],
  ['afterMirrors', 'after collapsing mirror domains'],
  ['afterBigFive', 'main market is big five'],
  ['afterTrustpilot', 'Trustpilot not below the floor'],
  ['productsConsidered', 'products worth scoring'],
  ['productsScored', 'products the model scored'],
];

function Funnelled({
  funnel,
  matched,
  credits,
  cache,
}: {
  funnel: Funnel;
  matched: number;
  credits: { rows: number; details: number; total: number };
  cache: StageZeroResult['cache'];
}) {
  return (
    <div className="card">
      <h3>The funnel</h3>
      <p className="small muted">
        {matched.toLocaleString()} shops matched the filters in total; the run
        sampled the first {funnel.returned}.
      </p>
      <div className="kv">
        {FUNNEL_ROWS.map(([key, label]) => (
          <div className="kv-row" key={key}>
            <span className="k">{label}</span>
            <span className="v num">{funnel[key]}</span>
          </div>
        ))}
      </div>
      <p className="small">
        Cost: <b>{credits.total}</b> credits — {credits.rows} for rows,{' '}
        {credits.details} for detail calls.
      </p>
      {cache && <CacheResult cache={cache} />}
    </div>
  );
}

function Products({ products }: { products: ScoredProduct[] }) {
  if (products.length === 0) {
    return (
      <div className="card">
        <h3>Products</h3>
        <p className="muted small">
          Nothing to score. Every best-seller title was unusable or not a
          product — that is a data problem, not a verdict.
        </p>
      </div>
    );
  }
  return (
    <div className="card">
      <h3>Products by MRR fit</h3>
      <div className="src-list">
        {products.map((p, i) => (
          <div className="src-row" key={`${p.shopId}-${i}`}>
            <span className={`pill score-${scoreBand(p.score)}`}>
              {p.score === null ? '—' : p.score}
            </span>
            <div>
              <div className="node-name">{p.title}</div>
              <div className="runrow-sub">
                {p.domain}
                {p.category ? ` · ${p.category}` : ''}
                {p.price ? ` · ${p.price} ${p.currency}` : ''}
              </div>
              <div className="node-why">
                {p.score === null ? 'unscored — the model returned no verdict for it' : p.reason}
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="small muted">
        A dash is not a zero. Zero means durable or not a product; a dash means
        nothing was measured.
      </p>
    </div>
  );
}

function Shops({ shops }: { shops: ShopCandidate[] }) {
  return (
    <div className="card">
      <h3>Surviving shops</h3>
      {shops.length === 0 && <p className="muted small">None survived the gates.</p>}
      {shops.map((s) => (
        <div className="item" key={s.id}>
          <div className="runrow-top">
            <span className="node-name">{s.domain}</span>
            <span className={`pill score-${scoreBand(s.mrrScore)}`}>
              {s.mrrScore === null ? '—' : s.mrrScore}
            </span>
          </div>
          <div className="runrow-sub">
            {s.monthlyVisits?.toLocaleString() ?? '—'} visits · {s.ratio}× over 6
            months · {s.ups}/5 rising · {s.activeAds ?? '—'} ads
          </div>
          <div className="runrow-sub">
            {s.topMarket ?? '—'}
            {s.topMarketShare != null ? ` ${Math.round(s.topMarketShare * 100)}%` : ''} ·
            Trustpilot{' '}
            {s.trustpilotRating == null
              ? 'no profile'
              : `${s.trustpilotRating} (${s.trustpilotReviews ?? 0})`}
          </div>
          <Series months={s.months} warning={s.tMinus6Warning} />
        </div>
      ))}
    </div>
  );
}

/** t … t-6, with the estimated month marked as estimated. */
function Series({ months, warning }: { months: ShopCandidate['months']; warning: string }) {
  if (months.length === 0) {
    return <div className="node-why warn">{warning || 'no series available'}</div>;
  }
  const oldestFirst = [...months].reverse();
  const peak = Math.max(...oldestFirst.map((m) => m.visits ?? 0), 1);
  return (
    <>
      <div className="spark tall">
        {oldestFirst.map((m) => (
          <i
            key={m.label}
            className={m.estimated ? 'est' : undefined}
            style={{ height: `${Math.max(2, Math.round(((m.visits ?? 0) / peak) * 26))}px` }}
            title={
              `${m.label} ${m.period} — ${m.visits?.toLocaleString() ?? '—'} visits` +
              (m.estimated
                ? ` (estimated from growth180d, ${m.low?.toLocaleString()}–${m.high?.toLocaleString()})`
                : '')
            }
          />
        ))}
      </div>
      {warning && <div className="node-why warn">{warning}</div>}
    </>
  );
}

/** Three bands, so the colour carries the same meaning as the rubric's anchors. */
function scoreBand(score: number | null): string {
  if (score === null) return 'none';
  if (score >= 7) return 'high';
  if (score >= 4) return 'mid';
  return 'low';
}
