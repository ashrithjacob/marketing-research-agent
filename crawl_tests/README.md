# crawl_tests

Four crawlers, one target, side by side. Point a script at a URL, read what came
back, decide for yourself.

These exist because the choice between them has been argued from vendor claims
more than once, and vendor claims are not measurements. Every script prints the
same record shape, applies the same bot-wall check, and writes its raw output to
`out/` so you can diff two crawlers by eye.

They sit in this repo rather than beside it because what they measure is this
repo's fetch layer: `crawl_firecrawl.py` mirrors `web_fetch`'s real settings,
and the Apify script mirrors the review-mining adapter's real actor inputs and
spend caps. When `server/src/tools.ts` or `server/src/apify.ts` changes, these
should change with it, or they stop measuring production.

| Script | Crawler | Takes | Cost |
|---|---|---|---|
| `crawl_firecrawl.py` | Firecrawl cloud — what `web_fetch` uses in production today | any URL | a credit per scrape |
| `crawl_anakin.py` | AnakinScraper, self-hosted (`../../anakin`) | any URL | free (your compute) |
| `crawl_apify.py` | Apify actors — junglee Amazon reviews + search, memo23 Trustpilot | Amazon product URL / search term / company | **real money** |
| `crawl_trustpilot.py` | Trustpilot direct, via real Chrome | company domain or `/review/` URL | free |

Plus `common.py`, which holds the three things the four have to share to be
comparable at all — the bot-wall check, the printed record shape and the table —
and `test_wall_check.py`, which pins the first of those.

## Setup

```bash
cd marketing-research-agent/crawl_tests
pip install selenium        # ONLY for crawl_trustpilot.py; the other three use urllib
```

**You do not need a `.env`.** `common.py` reads this repo's own `../.env`, which
already holds `FIRECRAWL_API_KEY` and `APIFY_TOKEN`; it also checks
`./.env` and `../deploy/vps/.env`, in that order. Anything exported in your shell
wins over all of them. The three keys that matter:

| Variable | Used by | Get it from |
|---|---|---|
| `FIRECRAWL_API_KEY` | `crawl_firecrawl.py` | https://www.firecrawl.dev/app/api-keys |
| `APIFY_TOKEN` | `crawl_apify.py` — **spends real money** | the Apify console |
| `ANAKIN_BASE_URL` | `crawl_anakin.py`, defaults to `http://localhost:8080` | your own instance |

For `crawl_anakin.py`, start anakin first:

```bash
cd ../../anakin && make up          # server :8080, Camoufox :9222, postgres :5432
# or, no Docker and no database:
cd ../../anakin/server && go run cmd/server/main.go
```

## Running them

Every script has an `EXAMPLE_*` constant at the top marked `# --- CHANGE ME ---`.
Run with no arguments to use it; pass a URL to use your own.

### Firecrawl

```bash
python3 crawl_firecrawl.py                                    # example page
python3 crawl_firecrawl.py https://huel.com/products/huel-daily-greens
python3 crawl_firecrawl.py https://www.trustpilot.com/review/huel.com   # watch it wall
python3 crawl_firecrawl.py <url> --full --html                # onlyMainContent off, raw html
python3 crawl_firecrawl.py <url> --stealth --wait 6000        # stealth proxy, more credits
```

Defaults mirror `../server/src/tools.ts:firecrawlScrape` exactly (`markdown`,
`onlyMainContent: true`), so the output is what a stage-1 run would have seen.

### Anakin

```bash
python3 crawl_anakin.py                                       # example page
python3 crawl_anakin.py https://www.trustpilot.com/review/huel.com --browser
python3 crawl_anakin.py <url> --json                          # Gemini extraction, needs GEMINI_API_KEY
python3 crawl_anakin.py <url> --fresh --which-handler         # skip cache, show proxy scores
```

`--browser` is the flag that matters against a JavaScript wall. Without it the
chain starts on the plain HTTP handler, which may hand back the challenge page
as if it were content.

### Apify — **this one spends money**

```bash
python3 crawl_apify.py search "magnesium glycinate"           # find an ASIN first
python3 crawl_apify.py amazon                                 # example ASIN, 3-star, 5 reviews
python3 crawl_apify.py amazon https://www.amazon.com/dp/B000BD0RT0 --stars 3 --max 5
python3 crawl_apify.py trustpilot huel.com --stars 3 --max 5
python3 crawl_apify.py amazon <url> --all-stars --max 20 --yes
```

The script prints the spend cap before every call and refuses a cap above
`--budget` (default $1.00) unless you pass `--yes`. **The cap is a ceiling, not
a prediction** — check the Apify console for the real charge.

A search first, then reviews, is the intended order: the reviews actor takes a
URL and a brief only ever names a product. Pick by `reviewsCount`, not by
position — a listing with four reviews cannot support a review node.

### Trustpilot, direct

```bash
python3 crawl_trustpilot.py                                   # example company, 3-star
python3 crawl_trustpilot.py huel.com --stars 3
python3 crawl_trustpilot.py huel.com --page 2                 # pagination composes
python3 crawl_trustpilot.py huel.com --all-bands              # 1..5, one browser session
```

Needs a system `google-chrome`. Roughly 9s for the first page (the WAF challenge
has to solve itself) and ~4s for each page after, since the token is held.

### Comparing two of them

There is no runner script — run the ones that can take your target, and read the
two blocks against each other. Not every crawler takes every target: Firecrawl
and anakin take any URL, the Apify Amazon actor takes a product URL only, and
the Trustpilot script takes a company.

```bash
# same page, two page crawlers — the like-for-like pair
python3 crawl_firecrawl.py https://www.trustpilot.com/review/huel.com
python3 crawl_anakin.py    https://www.trustpilot.com/review/huel.com --browser

# same company's 3-star reviews, free route vs paid route
python3 crawl_trustpilot.py huel.com --stars 3
python3 crawl_apify.py trustpilot huel.com --stars 3 --max 5 --yes
```

Then diff the raw bodies by hand — every run prints its own path under `out/`:

```bash
ls -t out/ | head -4
diff <(jq -S . out/trustpilot-*.json) <(jq -S . out/apify-trustpilot-*.json) | head -40
```

## Reading the output

Every run prints the same fields and drops its raw body in `out/`:

```
  http             200
  elapsed          3412 ms
  chars            18422
  records          n/a
  star spread      —
  filter honoured  n/a
  WALL             no
  cost             —
  raw              out/firecrawl-https-huel-com-...-20260922-201455.md
```

- **`chars`** — page crawlers only. How much text came back.
- **`records`** — review crawlers only. Rows of structured review.
- **`WALL`** — a *successful* fetch that is really a bot challenge. This is the
  field to watch. `WALL: YES` next to `http: 200` is the failure that actually
  costs you: the body gets archived and quoted as though it were a page.
- **`filter honoured`** — you asked for N-star reviews; did N-star reviews come
  back? See below.

The wall check is the same for all four: a known challenge string, or a body
under 2000 characters. Patterns live in `common.py:WALL_PATTERNS`.

## Two things worth reproducing before you trust any of this

**Amazon's star filter lies, in two directions.** Measured from a residential
address, where Amazon does serve reviews: `?filterByStar=three_star` returns
**zero** containers, which reads as "this product has no 3-star reviews".
`?filterByStar=one_star` returns the **unfiltered** sample — thirteen reviews
presented as 1-star, eleven of which are really 5-star. That is fabricated star
data, and no scraper in this folder can detect it from the page alone. It is why
the `filter honoured` column exists, and why the Apify scripts check the spread
that came back against the band requested and discard the rows when they differ.

**Amazon blocks by address; Trustpilot blocks by JavaScript.** From the Hetzner
VPS, Amazon serves a 3.7 KB bot page **at HTTP 200** to curl, to headless Chrome
and to Firecrawl in both proxy modes — so a better browser does not help, only a
different address does. Trustpilot serves a byte-identical 991-byte challenge to
*both* a datacentre and a residential address, and yields to any client that
runs JS from either. Same-looking 403s, completely different causes, completely
different fixes. Always record which machine you ran from; that distinction is
the one most likely to mislead you.

Full evidence for both: `../spec-review-mining.md` §2, §3 and §9.

## What these scripts are not

Probes, not readers. Nothing here is on a production path and nothing should be
imported by the cockpit or the server. `test_wall_check.py` is the one exception
to "no tests", and it covers the one piece of shared judgement; the rest hit live
sites and cannot be asserted on. Anything that earns promotion belongs in
`../server/src/` with a regression test, per this repo's `CLAUDE.md`.

They are also not part of the deploy: `deploy/vps/deploy.sh` builds the server
image, and this directory is not in it. Nothing here runs on the VPS.

The older, narrower probes that produced the measurements in `spec-review-mining.md`
are next door in `../probes/review-mining/` — including `vps_probe.sh`, which is
the one to run **on the VPS** when you need the production answer rather than the
laptop one. These scripts are the comparison tool; those are the evidence.
