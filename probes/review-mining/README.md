# Review-mining access probes

These are the scripts that produced the measurements in `spec-review-mining.md`.
They are **probes, not readers** — throwaway diagnostics kept so the numbers in the
spec can be re-checked when a site changes. Anything promoted to production belongs
in `server/src/` with tests, per `CLAUDE.md`.

Requirements: system `google-chrome`, `selenium` 4.41.0, `requests` 2.31.0.

| Script | Measures | Run from | Spec section |
|---|---|---|---|
| **`server/scripts/apify-spike.mjs`** | **the chosen route**, via the `apify-client` npm package — the script that produced §5.6's measurements | anywhere with a token | §5.6, §5.7 |
| `apify_spike.py` | same idea, zero-dependency Python. Superseded by the .mjs version; kept as a no-npm fallback | anywhere with a token | §5.6 |
| **`vps_probe.sh`** | **the whole reachability matrix** — Trustpilot via Chrome, Amazon direct + Chrome + Firecrawl, Reddit | **the VPS** | §2, §3, §4, §11 |
| `tp_browser.py [url]` | Whether headless Chrome clears Trustpilot's AWS WAF challenge; `__NEXT_DATA__` shape and review count | laptop | §2.2 |
| `tp_filter.py` | `?stars=N` / `?page=M` filter behaviour; harvests cookies to `tp_cookies.json` for token-replay tests | laptop | §2.3, §2.4 |
| `az_extract.py <saved.html>` | Amazon review extraction against current markup; star spread and 3★ presence | laptop | §3.4, §9 |

## The Apify spike — `server/scripts/apify-spike.mjs`

This is the script that produced `spec-review-mining.md` §5.6–§5.8. It lives in
`server/` because it uses the `apify-client` npm package, which is a real dependency
of the eventual adapter, not a probe-only one.

```bash
cd server
node scripts/apify-spike.mjs amazon            # default ASIN, threeStar, 10 max
SPIKE_URL=https://www.amazon.com/dp/B0GSLJKW6N \
SPIKE_STARS=allStars SPIKE_MAX=10 \
  node scripts/apify-spike.mjs amazon
node scripts/apify-spike.mjs trustpilot        # not yet executed
```

It reads `APIFY_TOKEN` from `../.env`. Spend is capped server-side by
`maxTotalChargeUsd` — note this cap has a **floor**: below $0.50 (Amazon) or $0.45
(Trustpilot) Apify rejects the call with HTTP 400. Five runs during the intertrigo
spike cost **$0.168** against a $5/month FREE-plan ceiling.

It deliberately leaves memo23's `painPointAnalysis` and `reviewInsights` **off** —
LLM paraphrase at up to 67× the per-item rate, forbidden by `spec-stage-1.md` §2.3.

Three results are not failures, and the script labels each:

- `error: no_relevant_reviews_found` — an honest **gap** (ratings exist, none have
  text). Still billed $0.006.
- **empty dataset on a `SUCCEEDED` run** — the Apify-shaped "a wall fetches
  successfully". Never record as "no reviews".
- **HTTP 402** — out of credit, a billing problem wearing a data problem's clothes.

The Python `apify_spike.py` alongside it does the same job with no npm dependency.
It is superseded but kept for a no-install check.

## The one for production reachability

`vps_probe.sh` is the production check. It is read-only, touches no running service,
and pulls `zenika/alpine-chrome` (958 MB) on first run.

```bash
scp probes/review-mining/vps_probe.sh owui:/tmp/
ssh owui 'set -a; . /home/ash/mra-compose/.env; set +a; bash /tmp/vps_probe.sh'
```

Sourcing the env file is optional and only enables the Firecrawl checks. Expected
output as of 2026-09-17: Trustpilot 20 reviews per star band in ~9s, Amazon
`BOT-BLOCK` at **HTTP 200** on every try, Reddit 403 with a 401 from the token
endpoint.

`az_extract.py` takes a saved page, so fetch one first:

```bash
curl -s -A 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36' \
     -H 'Accept-Language: en-US,en;q=0.9' \
     -o az_dp.html 'https://www.amazon.com/dp/B000BD0RT0'
python3 az_extract.py az_dp.html
```

**Results depend on the requesting address, and not uniformly.** Amazon serves the
Hetzner VPS a bot page (at HTTP 200) and serves a residential connection 13 real
reviews — that block is by address. Trustpilot challenges both identically and
yields to a browser from either — that one is by JavaScript. Reddit refuses both.
Always record which vantage point a run used; that split is the most load-bearing
distinction in `spec-review-mining.md`.

Two traps these scripts encode, both of which cost real time to find:

- **`curl` needs `--compressed` on Amazon.** Without it the gzip body looks like a
  287 KB page and every `grep` silently reports "binary file matches".
- **Chrome in a container writes `dbus` errors to stderr and works fine.** Do not
  treat stderr output as failure.
