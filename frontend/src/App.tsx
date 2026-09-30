import { useCallback, useEffect, useState } from 'react';
import {
  api,
  briefLabel,
  TERMINAL_STATUSES,
  type Config,
  type ResearchNode,
  type RunSummary,
  type Session,
} from './api';
import Login from './Login';
import LogsPage from './LogsPage';
import ProductRuns from './ProductRuns';
import ProductsPage from './ProductsPage';
import { Link, navigate, paths, useRoute } from './route';
import RunView from './RunView';
import StartRun from './StartRun';
import StageTwoPlan from './StageTwoPlan';
import StepIn from './StepIn';
import { useProduct, useProducts } from './use-products';

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [who, setWho] = useState<Session | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  /** The Start run modal: null when closed, the nodes to run when open ([] = whole stage). */
  const [startNodes, setStartNodes] = useState<ResearchNode[] | null>(null);
  const [stepInOpen, setStepInOpen] = useState(false);
  const [error, setError] = useState('');
  const [judgementsRev, setJudgementsRev] = useState(0);
  const route = useRoute();

  const loadSession = useCallback(() => {
    api
      .session()
      .then((s) => {
        setWho(s);
        setAuthed(s.authenticated);
      })
      .catch(() => setAuthed(false));
  }, []);

  useEffect(loadSession, [loadSession]);

  const signedIn = !!authed && route.page !== 'logs';
  const productId = signedIn && route.page === 'product' ? route.productId : null;
  const { products, reload: reloadProducts } = useProducts(signedIn && route.page === 'products', setError);
  const { product, runs, missing, reload: reloadProduct } = useProduct(productId, setError);
  const activeId = route.page === 'product' ? (route.runId ?? product?.default_run_id ?? null) : null;

  useEffect(() => {
    if (!signedIn) return;
    api.config().then(setConfig).catch(() => undefined);
  }, [signedIn]);

  const reload = useCallback(() => {
    reloadProducts();
    reloadProduct();
  }, [reloadProducts, reloadProduct]);

  function showStarted(run: RunSummary) {
    setStartNodes(null);
    navigate(paths.run(run.product_id, run.id));
    reload();
  }

  const activeRun = runs.find((r) => r.id === activeId) ?? null;
  const live = !!activeRun && !TERMINAL_STATUSES.has(activeRun.status);
  const clock = useClock(activeRun);

  async function stopRun() {
    if (!activeRun) return;
    try {
      await api.stopRun(activeRun.id);
      reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function saveJudgement(body: {
    kind: string;
    text: string;
    rejects_kinds: string[];
  }) {
    setStepInOpen(false);
    try {
      if (live && activeRun) await api.steer(activeRun.id, body);
      else await api.addJudgement(body);
      setJudgementsRev((n) => n + 1);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (authed === null) return <div className="boot">Loading…</div>;
  if (!authed) return <Login onSuccess={loadSession} />;
  if (route.page === 'logs') return <LogsPage runId={route.runId} />;

  return (
    <div className="app">
      <header>
        <Link to={paths.products()} className="brand">
          research cockpit
        </Link>
        <div className="subject">
          {activeRun && (
            <>
              <span className="chip">
                {briefLabel(activeRun.brief)}
                {activeRun.brief.market ? ` — ${activeRun.brief.market}` : ''}
              </span>
              <span className="chip">{clock}</span>
              <span className={`status ${activeRun.status}`}>
                {activeRun.status}
              </span>
            </>
          )}
          <button
            className="ghost"
            disabled={!activeRun}
            onClick={() => setStepInOpen(true)}
          >
            Step in
          </button>
          {live && (
            <button className="ghost" onClick={stopRun}>
              Stop
            </button>
          )}
          <button className="primary" onClick={() => setStartNodes([])}>
            Start run
          </button>
          {who?.auth_required && (
            <span className="chip" title="Signed in as, in workspace">
              {who.user} · {who.workspace}
            </span>
          )}
          <button
            className="ghost"
            title="Sign out"
            onClick={async () => {
              await api.logout();
              setAuthed(false);
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      {error && (
        <div className="error banner" onClick={() => setError('')}>
          {error}
        </div>
      )}

      {route.page === 'products' && <ProductsPage products={products} />}
      {(route.page === 'missing' || missing) && (
        <div className="empty">
          No page here. <Link to={paths.products()}>All products</Link>
        </div>
      )}
      {route.page === 'product' && !missing && (!product || !activeId) && (
        <div className="empty">Loading product…</div>
      )}
      {route.page === 'product' && product && activeId && (
        <RunView
          runId={activeId}
          runs={runs}
          nav={<ProductRuns product={product} runs={runs} activeId={activeId} showWorkspace={!!who?.is_admin} />}
          judgementsRev={judgementsRev}
          requiredFields={config?.required_fields ?? {}}
          onSelectRun={(id) => navigate(paths.run(product.id, id))}
          onChanged={reload}
          onRunNode={(node) => setStartNodes([node])}
        />
      )}

      {startNodes && startNodes.includes('review_mining') && (
        <StageTwoPlan
          brief={activeRun?.brief ?? { product: '', url: '', market: '', notes: '' }}
          onStarted={async (run) => showStarted(run)}
          onFailed={async () => reload()}
          onClose={() => setStartNodes(null)}
        />
      )}
      {startNodes && !startNodes.includes('review_mining') && (
        <StartRun
          config={config}
          nodes={startNodes}
          initial={startNodes.length > 0 ? activeRun?.brief : undefined}
          onClose={() => setStartNodes(null)}
          onStarted={async (run) => showStarted(run)}
          onFailed={async () => reload()}
        />
      )}
      {stepInOpen && activeRun && (
        <StepIn
          live={live}
          onSave={saveJudgement}
          onClose={() => setStepInOpen(false)}
        />
      )}
    </div>
  );
}

/** Elapsed run time, ticking once a second while the run is live. */
function useClock(run: RunSummary | null): string {
  const live = !!run && !TERMINAL_STATUSES.has(run.status);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!live) return;
    const iv = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(iv);
  }, [live]);
  if (!run) return '';
  const start = new Date(run.created_at).getTime();
  const end = run.ended_at ? new Date(run.ended_at).getTime() : Date.now();
  const s = Math.max(0, Math.floor((end - start) / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}
