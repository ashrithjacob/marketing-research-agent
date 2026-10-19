const LABELS: Record<string, string> = {
  resolving: 'Finding the product',
  awaiting_confirmation: 'Waiting for you',
  running: 'Researching',
  stopping: 'Stopping',
  completed: 'Completed',
  invalid: 'Refused',
  failed: 'Failed',
  cancelled: 'Stopped',
  pending: 'Waiting',
  skipped: 'Skipped',
  not_built: 'Not built yet',
  never_run: 'Never run',
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge status-${status}`}>{LABELS[status] ?? status}</span>;
}

export function Money({ usd }: { usd: number | null }) {
  if (usd === null) return null;
  return <span className="money">${usd < 0.01 ? usd.toFixed(4) : usd.toFixed(2)}</span>;
}

export function Source({ url, label }: { url: string; label?: string }) {
  let host = url;
  try {
    host = new URL(url).hostname.replace(/^www\./, '');
  } catch {}
  return (
    <a className="source" href={url} target="_blank" rel="noreferrer noopener" title={url}>
      {label ?? host}
    </a>
  );
}
