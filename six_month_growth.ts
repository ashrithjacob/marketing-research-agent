#!/usr/bin/env node
/**
 * TrendTrack: reconstruct monthly traffic t .. t-5 from `traffic.history`,
 * and estimate t-6 from the rounded `growth180d` scalar.
 *
 * Usage:
 *   TRENDTRACK_API_KEY=sk_... npx tsx traffic-history.ts <shopId|domain>
 *
 * Node 18+ (global fetch). No dependencies.
 */

const API = "https://api.trendtrack.io/v1";
const KEY = process.env.TRENDTRACK_API_KEY;

interface Point { period: string; value: number }
interface Traffic {
  monthlyVisits: number | null;
  growth30d: number | null;
  growth90d: number | null;
  growth180d: number | null;
  history: Point[];
}

/** A month in the reconstructed series. offset 0 = latest (t). */
interface Month {
  offset: number;        // 0 = t, 1 = t-1, ...
  label: string;         // "t", "t-1", ...
  period: string;        // "2026-08-01" (or "estimated" for t-6)
  visits: number | null;
  estimated: boolean;
  low?: number;          // lower bound when estimated
  high?: number;         // upper bound when estimated
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${KEY}` },
  });
  const body = await res.json();
  if (!res.ok) {
    const e = body?.error;
    throw new Error(`${res.status} ${e?.code ?? ""}: ${e?.message ?? JSON.stringify(body)}`);
  }
  return body;
}

/** Resolve a bare domain to a shop id via exact domain matching. */
async function resolveDomain(domain: string): Promise<string> {
  const res = await fetch(`${API}/shops/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ search: domain, searchType: "domain", limit: 1 }),
  });
  const body: any = await res.json();
  if (!res.ok) throw new Error(`${res.status}: ${body?.error?.message ?? "lookup failed"}`);
  const hit = body?.data?.[0];
  if (!hit) throw new Error(`No shop matched domain "${domain}" (exact match only).`);
  return hit.id;
}

/** Step back one calendar month from a YYYY-MM-DD period label. */
function prevPeriod(period: string): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Bounds implied by a value rounded to `dp` decimal places.
 * -0.35 at 2dp means the true value lies in [-0.355, -0.345).
 */
function roundingBounds(v: number, dp = 2): [number, number] {
  const half = 0.5 / 10 ** dp;
  return [v - half, v + half];
}

function pct(v: number | null | undefined): string {
  return v == null ? "n/a" : `${(v * 100).toFixed(1)}%`;
}

async function main() {
  const arg = process.argv[2];
  if (!KEY) throw new Error("Set TRENDTRACK_API_KEY.");
  if (!arg) throw new Error("Usage: traffic-history.ts <shopId|domain>");

  // A UUID is an id; anything with a dot is treated as a domain.
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(arg);
  const shopId = isUuid ? arg : await resolveDomain(arg);

  const res = await get<{ data: { domain: string; traffic: Traffic } }>(`/shops/${shopId}`);
  const { domain, traffic } = res.data;
  const hist = [...(traffic.history ?? [])].sort((a, b) => a.period.localeCompare(b.period));

  if (hist.length === 0) throw new Error("No traffic history returned for this shop.");

  // --- Observed months: newest first, t .. t-(n-1) ---
  const months: Month[] = hist
    .slice()
    .reverse()
    .map((p, i) => ({
      offset: i,
      label: i === 0 ? "t" : `t-${i}`,
      period: p.period,
      visits: p.value,
      estimated: false,
    }));

  const t = months[0];

  // --- Validate which definition of growth90d the API uses ---
  // Both hypotheses are checked against the reported value; whichever is
  // closer tells us how to read growth180d. At 2dp they often tie, so this
  // is reported rather than trusted blindly.
  let note90 = "growth90d not reported — cannot validate.";
  let pointToPointFits = true;

  if (traffic.growth90d != null && months.length >= 4 && t.visits) {
    const tMinus3 = months[3].visits;
    const p2p = tMinus3 ? t.visits / tMinus3 - 1 : null;

    const recent = months.slice(0, 3).reduce((s, m) => s + (m.visits ?? 0), 0);
    const prior = months.slice(3, 6).reduce((s, m) => s + (m.visits ?? 0), 0);
    const sums = prior > 0 && months.length >= 6 ? recent / prior - 1 : null;

    const dP2p = p2p == null ? Infinity : Math.abs(p2p - traffic.growth90d);
    const dSums = sums == null ? Infinity : Math.abs(sums - traffic.growth90d);
    pointToPointFits = dP2p <= dSums;

    note90 =
      `reported ${pct(traffic.growth90d)} | point-to-point ${pct(p2p)} (Δ${dP2p.toFixed(4)})` +
      ` | trailing-sums ${pct(sums)} (Δ${dSums.toFixed(4)}) → ` +
      (Math.abs(dP2p - dSums) < 0.005
        ? "TIE at this precision; t-6 below assumes point-to-point"
        : pointToPointFits
        ? "point-to-point"
        : "trailing-sums (t-6 NOT recoverable as a single month)");
  }

  // --- Derive t-6 from growth180d, under point-to-point ---
  // growth180d = t / t-6 - 1  =>  t-6 = t / (1 + growth180d)
  if (traffic.growth180d != null && t.visits) {
    const g = traffic.growth180d;
    const [lo, hi] = roundingBounds(g, 2);
    const est = t.visits / (1 + g);
    // Lower growth => larger implied base, so bounds invert.
    const high = t.visits / (1 + lo);
    const low = t.visits / (1 + hi);

    if (1 + g > 0) {
      months.push({
        offset: 6,
        label: "t-6",
        period: prevPeriod(months[months.length - 1].period),
        visits: Math.round(est),
        estimated: true,
        low: Math.round(low),
        high: Math.round(high),
      });
    }
  }

  // --- Output ---
  console.log(`\n${domain}  (${shopId})`);
  console.log(`growth30d ${pct(traffic.growth30d)} | growth90d ${pct(traffic.growth90d)} | growth180d ${pct(traffic.growth180d)}\n`);

  for (const m of months) {
    const v = m.visits?.toLocaleString() ?? "n/a";
    const tag = m.estimated ? `  ~estimated (${m.low?.toLocaleString()}–${m.high?.toLocaleString()})` : "";
    console.log(`  ${m.label.padEnd(4)} ${m.period}  ${v.padStart(10)}${tag}`);
  }

  console.log(`\nvalidation: ${note90}`);
  if (!pointToPointFits) {
    console.log("WARNING: trailing-sums fits better — the t-6 estimate above is unreliable.");
  }

  // Machine-readable form for piping into a scorer.
  console.log("\n" + JSON.stringify({ shopId, domain, months, growth: {
    g30: traffic.growth30d, g90: traffic.growth90d, g180: traffic.growth180d,
  }}, null, 2));
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});