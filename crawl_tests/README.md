# crawl_tests

**The question: can this crawler put Amazon reviews in front of the agent?**

Not "does it fetch the page" — every crawler here fetches the page. Whether the
reviews are *on* the page it returns is a different question, and it is the one
that decides whether review mining has to be bought.

Four crawlers are compared, all against `amazon.com` (US) product URLs:

| Script | Crawler | Cost |
|---|---|---|
| `crawl_firecrawl.py` | Firecrawl cloud — what `web_fetch` uses in production today | a credit per scrape |
| `crawl_anakin.py` | AnakinScraper, self-hosted (`../../anakin`), incl. its Camoufox browser | free (your compute) |
| `crawl_apify.py` | Apify — junglee reviews actor, junglee search actor | **real money** |
| `crawl_outscraper.py` | Outscraper `/amazon/reviews` — cheaper on paper, see finding 2 | free to 500, then $2/1k |

Each prints the same fields, counts reviews out of whatever came back using the
same extractor, and writes its raw body to `out/` so you can check by hand.

`crawl_trustpilot.py` is **kept but not compared.** Trustpilot is not a hard
page: one browser clears the challenge, `?stars=N` is honest, and there is
nothing to choose between crawlers on it. It stays because it is the working
free route and the documented fallback if the paid Trustpilot actor degrades.

`common.py` holds what the scripts must share to be comparable — the review
extractor, the bot-wall check, the printed record shape. `test_common.py` pins
both, which matters more than it sounds: §9 of `../spec-review-mining.md` records
that a stale selector returns **zero reviews from a page that has thirteen**, and
nothing in the output says so.

These live in this repo because what they measure is this repo's fetch layer.
`crawl_firecrawl.py` can reproduce `web_fetch`'s exact settings and
`crawl_apify.py` mirrors the review adapter's actor inputs and spend-cap floors.
When `server/src/tools.ts` or `server/src/apify.ts` changes, these should too.

## Setup

```bash
cd marketing-research-agent/crawl_tests
```

Nothing to install for the four Amazon crawlers — they use `urllib`. Only
`crawl_trustpilot.py` needs anything: `pip install selenium`, plus a system
`google-chrome`.

**You do not need a `.env`.** `common.py` reads this repo's own `../.env`, which
already holds `FIRECRAWL_API_KEY` and `APIFY_TOKEN`; it also checks `./.env` and
`../deploy/vps/.env`, in that order. Anything exported in your shell wins over
all of them.

| Variable | Used by | Get it from |
|---|---|---|
| `FIRECRAWL_API_KEY` | `crawl_firecrawl.py` | https://www.firecrawl.dev/app/api-keys |
| `APIFY_TOKEN` | `crawl_apify.py` — **spends real money** | the Apify console |
| `ANAKIN_BASE_URL` | `crawl_anakin.py`, defaults to `http://localhost:8080` | your own instance |
| `OUTSCRAPER_API_KEY` | `crawl_outscraper.py` — free to 500 reviews | app.outscraper.cloud profile |

For `crawl_anakin.py`, start anakin first:

```bash
cd ../../anakin && make up          # server :8080, Camoufox :9222, postgres :5432
# or, no Docker and no database:
cd ../../anakin/server && go run cmd/server/main.go
```

## The comparison

All four default to the same ASIN, so this is the whole thing:

```bash
python3 crawl_firecrawl.py                      # 1 credit
python3 crawl_anakin.py --fresh                 # free (add --browser if it comes back empty)
python3 crawl_outscraper.py --check-filter      # free inside the first 500
python3 crawl_apify.py amazon --yes             # ~$0.03 at the default cap
```

To point them at a different product, change one URL in each script's
`# --- CHANGE ME ---` block, or pass it:

```bash
python3 crawl_firecrawl.py https://www.amazon.com/dp/B0C1234567
python3 crawl_anakin.py    https://www.amazon.com/dp/B0C1234567 --browser --fresh
python3 crawl_apify.py amazon https://www.amazon.com/dp/B0C1234567 --stars 3 --yes
```

Don't have an ASIN? Resolve one first — a brief names a product, never an ASIN:

```bash
python3 crawl_apify.py search "magnesium glycinate"    # ~$0.06, prints asin + url
```

Pick by `reviewsCount`, not by position. A listing with four reviews cannot
support a review node, and the resolution costs less than mining the wrong
product.

### Per-script notes

**Firecrawl.** On an Amazon URL it defaults to `--full --html`, *not* to
production's settings, and says so on the run. Two reasons: `onlyMainContent:
true` was measured trimming Amazon's reviews off the page, and the data-hooks
the extractor needs only survive in HTML. `--as-production` reproduces exactly
what a stage-1 `web_fetch` sends — run both, they are two different answers.
`--stealth` and `--wait N` are there to reproduce §3.3's matrix.

**Anakin.** Always pass `--fresh`, or you may be reading a cached body rather
than making a fetch. `--browser` forces the Camoufox handler and needs the
browser service running; it is worth trying when the HTTP handler comes back
review-less, but note that from a residential address the HTTP handler alone
already returns all 13 reviews (finding 0), so the browser is not what makes
the difference here. `--which-handler` prints the proxy scores, which only ever
reflect the HTTP handler — anakin's browser handler takes no per-request proxy,
so a browser fetch is unproxied whatever the pool says.

You can run anakin without Docker for the HTTP handler alone:

```bash
cd ../../anakin/server && go run cmd/server/main.go    # in-memory, no DB, no browser
```

The browser handler reports itself unhealthy and is skipped, which is fine for
everything except a `--browser` run.

**Apify.** Prints the spend cap before every call and refuses a cap above
`--budget` (default $1.00) without `--yes`. The `cost` line says
`$0.50 CAP (not the charge)` for a reason: it is a server-side ceiling, floored
at what the actor will accept, and the Apify console is the only authority on
what you were actually billed. At `--max 5` the arithmetic is 5 × $0.006 = $0.03.

`--stars N` asks for one band, and this is the capability the money buys — the
script checks the spread that came back against the band requested and discards
the rows when they differ. It is also slow: ~22s against ~3s for a page fetch,
because an actor run has to start.

Rows come back with `totalCategoryReviews`, which is worth reading — on the
example ASIN it is 845, against the 13 a `/dp/` fetch can see.

## Getting hundreds of reviews

Only one of the four scales, and not by spending alone. Outscraper is the one
that looks like it should — it is 3x cheaper per review — but it cannot page
past the `/dp/` page's 13 and its star filter is inert, so there is nothing to
scale (finding 2). Check before you run:

```bash
python3 crawl_apify.py amazon --count 100 --all-stars --plan   # costs nothing
```

`--plan` prints the run plan, the projected cost and your **live Apify balance**,
and spends nothing. Drop `--plan` to execute. It refuses outright if the
projection exceeds what is left in the cycle.

**Repeating a query does not page.** Identical input returns identical rows and
bills you again for them. The axes that actually yield new reviews are the star
band, the sort order (`recent` vs `helpful`) and keyword search, so `--count`
walks those and dedupes, rather than looping.

That makes the ceiling combinatorial, not financial:

| Plan | Per run | Reachable from one ASIN | Cost |
|---|---|---|---|
| FREE | 10 reviews, 1 start URL | 5 bands × 2 sorts × 10 = 100 asked, **76 distinct measured** | $0.60 |
| Paid | actor's own limit | 5 bands × 100 = **500** (the actor's stated max is 100 per star band) | $3.00 |

**You are billed for what you ask for, not for what is new.** Executed
2026-09-22 on `amazon.com/dp/B000BD0RT0`, `--count 100 --all-stars`, ten runs,
$0.6002 charged:

```
  1   3* recent    got 10  new 10  total 10
  2   1* recent    got 10  new 10  total 20
  3   2* recent    got 10  new 10  total 30
  4   4* recent    got 10  new 10  total 40
  5   5* recent    got 10  new 10  total 50
  6   3* helpful   got 10  new 2   total 52     <- the second sort pass
  7   1* helpful   got 10  new 8   total 60        mostly repeats the first
  8   2* helpful   got 10  new 5   total 65
  9   4* helpful   got 10  new 3   total 68
  10  5* helpful   got 10  new 8   total 76
```

The `recent` pass is clean — five bands, fifty reviews, no overlap. The
`helpful` pass costs another $0.30 and yields 26 new, because "most helpful" and
"most recent" pull from the same pool. **Effective price: $0.0079 per distinct
review, not $0.006**, and it gets worse the more sort passes you add. If you
only need breadth, run the `recent` pass alone: 50 distinct for $0.30, at list
price.

Result: 76 distinct, spread `{1:18, 2:15, 3:12, 4:13, 5:18}`, 76/76 verified
purchases, spanning 2014-07-14 to 2026-09-18, out of the 845 written reviews the
listing reports. Twelve of them 3-star — which clears §2.3's floor of ten, the
thing the free routes cannot reach at all.

Beyond 500 from a single listing, there is no route at any price — that is the
actor's ceiling, and `/dp/` pagination is behind a sign-in from every address.

**The other two do not have a volume knob at all.** Firecrawl returns 0 reviews
from its addresses, and a residential fetch of `/dp/` tops out at the ~13 Amazon
chose to render — `/product-reviews/?pageNumber=2` 302s to `/ap/signin`. Scaling
those is not a budget question; there is nothing to scale.

Where hundreds *are* free: **Trustpilot**, 20 per page, paginated, honest star
filters, no vendor. But those are reviews of a merchant, not of a SKU.

**Outscraper.** `--check-filter` is the run that matters and costs nothing
inside the free 500: it asks for each band in turn and prints whether the band
is what came back. `--limit N` is a request, not a promise — ask for 50 on a
`/dp/` URL and you get 13. The script separates a transport failure from an
empty result, which it did not do on first write: a five-band run printed five
honest-looking empties that were all DNS errors.

**Trustpilot** (not part of the comparison):

```bash
python3 crawl_trustpilot.py huel.com --stars 3
python3 crawl_trustpilot.py huel.com --all-bands      # 1..5, one browser session
```

~9s for the first page while the WAF challenge solves itself, ~4s after.

## Reading the output

```
  http             200
  elapsed          3430 ms
  chars            1455348
  records          0
  star spread      —
  WALL             no
  note             onlyMainContent=False format=html — review slot holds a
                   SIGN-IN PROMPT — the page wants an account before it shows
                   reviews. Not an absence of reviews.
```

- **`records`** is the headline. Reviews extracted, with text and a star. This
  is what the comparison is about; `chars` can be 1.4 MB and `records` still 0.
- **`note`** carries the diagnosis when `records` is 0, because zero means four
  very different things and only one of them is "this product has no reviews":

  | Diagnosis | What it means |
  |---|---|
  | `UNLOADED PLACEHOLDER` | `/dp/` defers reviews to a later request. A single-shot fetch can never contain them. |
  | `SIGN-IN PROMPT` | The review slot wants an account. Not an absence of reviews. |
  | `star aggregate present but no review containers` | Either the §9 selectors went stale, or the reviews were never in this body. |
  | `no review markup of any kind` | Not a product page, or a wall. |
  | `N review datelines in markdown` | Reviews are there but markdown lost the structure — refetch as HTML. |

- **`WALL`** — a *successful* fetch that is really a bot challenge. `WALL: YES`
  next to `http: 200` is the failure that costs you, because the body gets
  archived and quoted as if it were a page. This is a real hole in production
  (`../workings.md` records it on `web_fetch`).
- **`star spread`** and **`filter honoured`** — you asked for N-star reviews;
  did N-star reviews come back? See below.

Raw bodies land in `out/`, one per run, path printed. Diff them by hand.

## Four things to reproduce before trusting any of this

**0. THIS COMPARISON MEASURES THE ADDRESS, NOT THE CRAWLER.** Read this before
you read a results table. Measured 2026-09-22 from a residential laptop, same
ASIN, same minute:

| Crawler | Fetched from | Reviews | Star control | Time |
|---|---|---|---|---|
| Firecrawl `--full --html` | Firecrawl's cloud | **0** of 1,455,348 chars — sign-in prompt in the review slot | none | 3.4s |
| Firecrawl `--as-production` | Firecrawl's cloud | **0** of 150,574 chars markdown | none | 2.6s |
| anakin, **plain HTTP handler**, no browser, no proxy | this laptop's residential IP | **13**, spread `{3:1, 4:1, 5:11}`, 13/13 verified | none — you get what Amazon chose | 2.6s |
| Outscraper `--all-stars --limit 50` | Outscraper's addresses | **13** (asked 50), spread `{3:1, 4:1, 5:11}` — 11 of them the same reviews anakin got free | **none, and it claims otherwise** — see finding 2 | 1.0s |
| Apify `--stars 3 --max 5` | Apify's addresses | **5**, spread `{3: 5}`, all verified, dated within 3 weeks | **asked for 3★, got 3★** | 21.6s |

Two separate things are going on, and it is easy to read only the first.

**The address decides whether you get reviews at all.** Anakin did not win on
technique — it used a residential address and Firecrawl used a datacentre one,
and Amazon serves those two different pages. Anakin got its 13 *without Camoufox
running at all*; a plain GET with a browser user-agent was enough. That
13/`{3:1, 4:1, 5:11}` is byte-for-byte the laptop control in
`../spec-review-mining.md` §3.4. **On the VPS it does not hold** — §3.2 measured
plain Chrome from the Hetzner address getting the bot page, so anakin's HTTP
handler there gets the bot page too. A laptop win is not a deployment.

**The star band decides whether the reviews are usable**, and only Apify has it.
The free route's 13 reviews contain exactly **one** 3-star, because Amazon picks
what goes on the page. The contract wants 3-star specifically and at least ten
of them, and the 845 written reviews on this ASIN are unreachable from `/dp/`:
pagination lives at `/product-reviews/`, which 302s to a sign-in from every
address tested. So even where the free route works, it tops out at one usable
review; Apify asked for five 3-star and got five, out of that pool of 845.

**1. The `/dp/` page does not always carry its reviews.** From Firecrawl's
addresses, `amazon.com/dp/B000BD0RT0` returns 1.46 MB at HTTP 200 — a real
product page, no bot page, no wall — containing `4.6 out of 5 stars`, sixty
`customer-reviews` references, and **zero review containers**. The review block
is `cm-cr-dp-reviews-loading-wrapper`, an unloaded placeholder, with
`cm-cr-dp-sign-in-prompt` in the slot. Same URL from a residential address: 13
reviews, server-rendered, first response body, no JS needed. The page Amazon
serves depends on who is asking.

**2. Amazon's star filter lies, and a vendor can inherit the lie.** Measured
from a residential address where Amazon does serve reviews:
`?filterByStar=three_star` returns **zero** containers, which reads as "no
3-star reviews exist". `?filterByStar=one_star` returns the **unfiltered**
sample — thirteen reviews presented as 1-star, eleven really 5-star.

**Outscraper forwards that parameter and inherits both failures.** Its API takes
`filterByStar` with Amazon's own value names, and all five bands come back
identical — `python3 crawl_outscraper.py --check-filter`, 2026-09-22:

```
  asked      got    spread                      verdict
  1-star     10     {3.0: 1, 4.0: 1, 5.0: 8}    LIES — discard
  2-star     10     {3.0: 1, 4.0: 1, 5.0: 8}    LIES — discard
  3-star     10     {3.0: 1, 4.0: 1, 5.0: 8}    LIES — discard
  4-star     10     {3.0: 1, 4.0: 1, 5.0: 8}    LIES — discard
  5-star     10     {3.0: 1, 4.0: 1, 5.0: 8}    LIES — discard
```

This is worse than Amazon's own behaviour, not better: Amazon's `three_star`
at least returns nothing, which is obviously broken. Ten rows that look like
1-star reviews and are really eight 5-star reviews look like evidence.

It also does not page. Asked for 50 with no filter, it returned **13**, spread
`{3:1, 4:1, 5:11}` — and 11 of those 13 are byte-identical to what anakin
scraped free from a residential IP. **Outscraper is scraping the `/dp/` page**:
same page, same reviews, same ceiling, with a bill attached. At $2/1,000 it is
nominally 3x cheaper than Apify's $6/1,000, but it cannot deliver the one thing
the money is for. Apify's actor was verified to honour the band on the same
ASIN the same day.

`filter honoured` exists for exactly this, and both the Apify and Outscraper
scripts discard rows whose spread does not match the band requested.

**3. Amazon blocks by address; Trustpilot blocks by JavaScript.** From the
Hetzner VPS, Amazon serves a 3.7 KB bot page **at HTTP 200** to curl, to headless
Chrome and to Firecrawl in both proxy modes — a better browser does not help,
only a different address does. Trustpilot serves a byte-identical 991-byte
challenge to datacentre *and* residential addresses, and yields to any client
that runs JS from either. Same-looking refusals, opposite causes. **Always record
which machine you ran from** — results from this laptop do not predict the VPS.

Full evidence: `../spec-review-mining.md` §2, §3 and §9.

## What these scripts are not

Probes, not readers. Nothing here is on a production path and nothing should be
imported by the cockpit or the server. `test_common.py` is the one exception to
"no tests" and covers the two shared pieces of judgement; everything else hits a
live site. Anything that earns promotion belongs in `../server/src/` with a
regression test, per this repo's `CLAUDE.md`.

They are not part of the deploy either: `deploy/vps/deploy.sh` builds the server
image, and this directory is excluded from the build context. Nothing here runs
on the VPS.

The probes that produced the measurements in `spec-review-mining.md` are next
door in `../probes/review-mining/` — including `vps_probe.sh`, which is the one
to run **on the VPS** when you need the production answer rather than the laptop
one. These scripts are the comparison tool; those are the evidence.
