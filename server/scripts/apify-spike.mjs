/**
 * Apify spike — settles what spec-review-mining.md §5.6 lists as unverified,
 * before any adapter is written against assumed field names:
 *
 *   1. the real dataset field names for each actor
 *   2. whether filterByRatings / filterStars actually filter
 *   3. real yield per product / per brand
 *   4. what a run actually costs (is minimalMaxTotalChargeUsd also a minimum charge?)
 *
 * Spend is capped twice on every call: `maxTotalChargeUsd` server-side, plus a
 * small maxReviews/maxItems. Nothing here can run unbounded.
 *
 *   cd server && node scripts/apify-spike.mjs            # amazon (default)
 *   cd server && node scripts/apify-spike.mjs trustpilot
 *   cd server && node scripts/apify-spike.mjs both
 */
import { ApifyClient } from 'apify-client';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

// The repo keeps secrets in ../.env (gitignored). No dotenv dependency for a probe.
function loadEnv() {
  for (const p of [resolve(here, '../../.env'), resolve(here, '../.env')]) {
    try {
      for (const line of readFileSync(p, 'utf8').split('\n')) {
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
      }
      return p;
    } catch { /* try next */ }
  }
  return null;
}
const envFile = loadEnv();

const token = process.env.APIFY_TOKEN;
if (!token) {
  console.error('APIFY_TOKEN not set (looked in .env). See spec-review-mining.md §5.6.');
  process.exit(1);
}
const client = new ApifyClient({ token });

// Intertrigo Relief Cream — skin-fold rash treatment. A real product in the
// category stage 0 surfaces, not a demo ASIN.
const PRODUCT_URL = 'https://www.amazon.com/dp/B0HH55FRPV';

const CASES = {
  amazon: {
    actor: 'junglee/amazon-reviews-scraper',
    // One discrete star band. §2.3 makes 3* mandatory coverage and §3.4 showed
    // Amazon's own filterByStar silently faking it, so this is the capability
    // under test, not an incidental parameter.
    input: {
      productUrls: [{ url: process.env.SPIKE_URL || PRODUCT_URL }],
      // FREE plan: the actor allows 1 start URL and 10 reviews per run. Overriding
      // via SPIKE_STARS lets one test sweep the bands without editing the file.
      filterByRatings: [process.env.SPIKE_STARS || 'threeStar'],
      maxReviews: Number(process.env.SPIKE_MAX || 10),
      sort: 'recent',
      includeGdprSensitive: false,
      scrapeProductDetails: false,
    },
    // Apify REJECTS a cap below the actor's minimalMaxTotalChargeUsd with a 400
    // at call time — measured 2026-09-17. This is that floor, not our budget.
    cap: 0.50,
    wantStar: 3,
    starKeys: ['rating', 'ratingScore', 'stars', 'reviewRating'],
    textKeys: ['reviewDescription', 'text', 'reviewText', 'body', 'description'],
    dateKeys: ['date', 'reviewedIn', 'reviewDate', 'publishedDate'],
  },
  trustpilot: {
    actor: 'memo23/trustpilot-scraper-ppe',
    input: {
      startUrls: [{ url: 'https://www.trustpilot.com/review/huel.com' }],
      filterStars: ['3'],
      maxItems: 5,
      sortBy: 'recent',
      // painPointAnalysis / reviewInsights deliberately OFF: LLM paraphrase at up
      // to 67x the per-item rate, and spec-stage-1.md §2.3 forbids paraphrase.
    },
    cap: 0.45,   // memo23's enforced minimum cap
    wantStar: 3,
    starKeys: ['rating', 'stars', 'reviewRating'],
    textKeys: ['text', 'reviewBody', 'body', 'reviewText'],
    dateKeys: ['experiencedDate', 'publishedDate', 'date'],
  },
};

const pick = (obj, keys) => keys.find((k) => obj[k] !== undefined && obj[k] !== null);
const deep = (o, k) => (o && typeof o === 'object' ? (k in o ? o[k] : Object.values(o).map((v) => deep(v, k)).find((x) => x !== undefined)) : undefined);

async function spike(name) {
  const c = CASES[name];
  console.log(`\n${'='.repeat(70)}\n${name.toUpperCase()}  →  ${c.actor}`);
  console.log(`  cap: $${c.cap}   input: ${JSON.stringify(c.input)}`);

  const t0 = Date.now();
  let run;
  try {
    run = await client.actor(c.actor).call(c.input, {
      maxTotalChargeUsd: c.cap,   // hard server-side ceiling
      waitSecs: 300,
    });
  } catch (err) {
    // 402 = out of credit. A billing problem that reads like a data problem (§7.3).
    console.log(`  CALL FAILED: ${err.statusCode ?? ''} ${err.message}`);
    if (err.statusCode === 402) console.log('  -> 402 is OUT OF CREDIT, not "no reviews".');
    return;
  }
  const secs = ((Date.now() - t0) / 1000).toFixed(1);

  console.log(`  run status : ${run.status}   (${secs}s)`);
  console.log(`  run id     : ${run.id}`);

  // usageTotalUsd is NOT populated on the object .call() returns — it lands a
  // moment later. Re-fetch, or every run appears to cost $0.00.
  const settled = await client.run(run.id).get();
  console.log(`  charged    : $${(settled.usageTotalUsd ?? 0).toFixed(4)}`
    + `  events=${JSON.stringify(settled.chargedEventCounts ?? {})}`);

  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  console.log(`  items      : ${items.length}`);

  if (items.length === 0) {
    console.log('  EMPTY DATASET on a finished run — the Apify-shaped "a wall fetches');
    console.log('  successfully". Must become a gap, never "this product has no reviews".');
    return;
  }

  const first = items[0];
  const errKey = Object.keys(first).find((k) => /error/i.test(k) && first[k]);
  if (errKey) {
    console.log(`  ERROR FIELD: ${errKey} = ${JSON.stringify(first[errKey])}`);
    if (String(first[errKey]).includes('no_relevant_reviews_found'))
      console.log('  -> no_relevant_reviews_found = an honest GAP (no 3* exist), not a failure.');
  }

  console.log(`  FIELD NAMES (${Object.keys(first).length}): ${JSON.stringify(Object.keys(first))}`);

  const sK = pick(first, c.starKeys), tK = pick(first, c.textKeys), dK = pick(first, c.dateKeys);
  console.log(`  -> star=${sK ?? 'NOT FOUND'}  text=${tK ?? 'NOT FOUND'}  date=${dK ?? 'NOT FOUND'}`);

  if (sK) {
    const spread = {};
    for (const i of items) spread[i[sK]] = (spread[i[sK]] ?? 0) + 1;
    console.log(`  star spread: ${JSON.stringify(spread)}`);
    // Only assert when a single discrete band was requested — 'allStars' and the
    // positive/critical aggregates are expected to return a mix.
    const asked = c.input.filterByRatings?.[0] ?? c.input.filterStars?.[0];
    const discrete = asked && !['allStars', 'positive', 'critical'].includes(asked);
    if (discrete) {
      const honoured = Object.keys(spread).every((v) => Number(v) === c.wantStar);
      console.log(`  FILTER HONOURED: ${honoured}${honoured ? '' : `  <-- asked ${c.wantStar}* only; DISCARD (§7.3)`}`);
    } else {
      console.log(`  (no filter assertion — requested "${asked}", a mix is correct)`);
    }
    const cat = first.totalCategoryReviews ?? first.totalCategoryRatings;
    if (cat !== undefined)
      console.log(`  totalCategoryReviews=${first.totalCategoryReviews} totalCategoryRatings=${first.totalCategoryRatings}`);
  } else {
    console.log('  star field not in the expected list — dumping first item:');
    console.log(JSON.stringify(first, null, 2).slice(0, 1500));
  }

  if (tK) {
    items.slice(0, 3).forEach((i, n) => {
      const txt = String(i[tK] ?? '').replace(/\s+/g, ' ').slice(0, 180);
      console.log(`   [${n + 1}] ${sK ? i[sK] + '*' : ''} ${dK ? String(i[dK]).slice(0, 24) : ''} :: ${txt}`);
    });
  }
}

const arg = (process.argv[2] ?? 'amazon').toLowerCase();
const which = arg === 'both' ? ['amazon', 'trustpilot'] : [arg];
console.log(`env: ${envFile ?? 'process env only'}   product: ${PRODUCT_URL}`);
for (const n of which) {
  if (!CASES[n]) { console.error(`unknown case "${n}" — use amazon | trustpilot | both`); continue; }
  await spike(n);
}
console.log('\nCross-check run cost in the Apify console against spec-review-mining.md §5.5.');
