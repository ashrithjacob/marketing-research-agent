# crawl_tests

**The question: can this crawler put Amazon reviews in front of the agent?**

Not "does it fetch the page" — every crawler here fetches the page. Whether the
reviews are *on* the page it returns is a different question, and it is the one
that decides whether review mining has to be bought.

Three crawlers are compared, all against `amazon.com` (US) product URLs:

| Script | Crawler | Cost |
|---|---|---|
| `crawl_firecrawl.py` | Firecrawl cloud — what `web_fetch` uses in production today | a credit per scrape |
| `crawl_anakin.py` | AnakinScraper, self-hosted (`../../anakin`), incl. its Camoufox browser | free (your compute) |
| `crawl_apify.py` | Apify — junglee reviews actor, junglee search actor | **real money** |

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

Nothing to install for the three Amazon crawlers — they use `urllib`. Only
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

For `crawl_anakin.py`, start anakin first:

```bash
cd ../../anakin && make up          # server :8080, Camoufox :9222, postgres :5432
# or, no Docker and no database:
cd ../../anakin/server && go run cmd/server/main.go
```

## The comparison

All three default to the same ASIN, so this is the whole thing:

```bash
python3 crawl_firecrawl.py                      # 1 credit
python3 crawl_anakin.py --fresh                 # free (add --browser if it comes back empty)
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
`--budget` (default $1.00) without `--yes`. **The cap is a ceiling, not a
prediction** — the Apify console is the authority on the real charge. `--stars N`
asks for one band; the script checks the spread that came back against the band
requested and tells you when they differ.

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

| Crawler | Fetched from | Result |
|---|---|---|
| Firecrawl (`--full --html`) | Firecrawl's cloud | 1,455,348 chars, **0 reviews**, sign-in prompt in the review slot |
| Firecrawl (`--as-production`) | Firecrawl's cloud | 150,574 chars markdown, **0 reviews** |
| anakin, **plain HTTP handler**, no browser, no proxy | this laptop's residential IP | 2,773,447 chars, **13 complete reviews**, spread `{3: 1, 4: 1, 5: 11}`, 13/13 verified |

Anakin did not win on technique. It used a residential address and Firecrawl
used a datacentre one, and Amazon serves those two addresses different pages.
Note anakin got the reviews *without* Camoufox even running — a plain GET with a
browser user-agent was enough. That 13/`{3:1, 4:1, 5:11}` is byte-for-byte the
laptop control recorded in `../spec-review-mining.md` §3.4.

**On the VPS this result does not hold.** §3.2 measured plain Chrome from the
Hetzner address getting the bot page, so anakin's HTTP handler there would get
the bot page too. Run the same three from the VPS before drawing any conclusion
about production — a laptop win is not a deployment.

**1. The `/dp/` page does not always carry its reviews.** From Firecrawl's
addresses, `amazon.com/dp/B000BD0RT0` returns 1.46 MB at HTTP 200 — a real
product page, no bot page, no wall — containing `4.6 out of 5 stars`, sixty
`customer-reviews` references, and **zero review containers**. The review block
is `cm-cr-dp-reviews-loading-wrapper`, an unloaded placeholder, with
`cm-cr-dp-sign-in-prompt` in the slot. Same URL from a residential address: 13
reviews, server-rendered, first response body, no JS needed. The page Amazon
serves depends on who is asking.

**2. Amazon's star filter lies, in two directions.** Measured from a residential
address where Amazon does serve reviews: `?filterByStar=three_star` returns
**zero** containers, which reads as "no 3-star reviews exist".
`?filterByStar=one_star` returns the **unfiltered** sample — thirteen reviews
presented as 1-star, eleven really 5-star. Fabricated star data, undetectable
from the page alone. That is what `filter honoured` is for, and why the Apify
script discards rows whose spread does not match the band it asked for.

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
