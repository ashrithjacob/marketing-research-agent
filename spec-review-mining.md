# Review mining — the access spec

`spec-stage-1.md` §2.3 defines *what a review excerpt must be*: verbatim customer
text, with a star rating, a date, a source and an axis, at least ten per product,
1★–5★ with 3★ mandatory. That definition has never been the problem. **Reaching the
text has been**, and §2.5 recorded review mining as the one node that "cannot
complete at all".

This spec is about reach only. It does not restate §2.3's admission rules; it says,
per source, what route exists from **the Hetzner VPS where this is deployed**, what
it costs, what it returns, and what it refuses.

**Measured 2026-09-17.** Two vantage points were used and every result below is
labelled with which:

| Tag | Where | Why it appears |
|---|---|---|
| **[VPS]** | Hetzner, `159.69.208.172`, Nuremberg, `AS24940` | **production — this is the one that counts** |
| [laptop] | residential Airtel, Bengaluru, `AS24560` | control, used to separate "the site blocks robots" from "the site blocks this address" |

The laptop is in here only as a diagnostic instrument. A route is not adopted unless
it is green from the VPS.

### The decision

**Scope: Trustpilot and Amazon, both through Apify store actors (§5). Reddit and
browser-use are out.** Sections 2–4 are the measurement record that led here and
stay as the fallback and the reasoning; §5 and §7 are what gets built.

| Step | Actor | Input | Cost |
|---|---|---|---|
| 1. resolve | `junglee/free-amazon-product-scraper` | `…/s?k=<title>` | $0.012/result |
| 2. Amazon reviews | `junglee/amazon-reviews-scraper` | `…/dp/<asin>` — **URL, never a name** | $0.006/review |
| 3. Trustpilot | `memo23/trustpilot-scraper-ppe` | `<domain>` or `searchTerms:["<brand>"]` | $0.00075/item + $0.05/run |

All three **executed live on 2026-09-17**, total spend **$0.41** of a $5/month cap.

**The Amazon actor has been run for real** — five runs against four intertrigo
ASINs, $0.168 spent, via `apify-client` (§5.6). It works, and it reaches the
`/product-reviews/` page that 302s us to a login. Three things it taught that change
the design:

- **The documented field names are wrong.** It is `reviewDescription` and
  `ratingScore`, not `text` and `rating` (§5.6).
- **The FREE plan gives $5/month, and the actor caps free users at 1 URL and 10
  reviews per run** — which kills the batching strategy (§5.7).
- **Error records are billed.** A `no_relevant_reviews_found` result costs $0.006.
  You pay for gaps, and in this category most products are thin (§5.7).

**Trustpilot is executed too** (§5.8b): `filterStars` honoured, $0.0538 a run, of
which **93% is the per-run start fee** — batch or it dominates. And it confirmed the
split that shapes everything: two of its three 3★ reviews were about order handling,
not the product.

**A third actor turned out to be necessary.** Neither review actor takes a product
*name*, and stage 0 has no ASIN — so `junglee/free-amazon-product-scraper` resolves
`title` → `asin`, and its `reviewsCount` says which product is worth mining before a
single review is bought. Full contract in §5.8a.

### Why, in one paragraph

Direct access was measured from production and only Trustpilot worked (§2 — free,
~9s/page, via headless Chrome). **Amazon is blocked by address** and has no free
route: curl, Chrome and Firecrawl in both proxy modes all return either a bot page
at **HTTP 200** or a review-stripped product page (§3). That matters more than it
looks, because §2.3's floor is *"at least 10 **marketplace** reviews"* and the
taxonomy separates `marketplace_review` (Amazon) from `review_platform`
(Trustpilot) — so **Trustpilot does not substitute for Amazon**. It fixes the 3★
*spread* rule; it cannot fill the marketplace floor, and its reviews are per-merchant
service feedback rather than per-product. Amazon therefore has to be bought, and
once Apify is in the stack for Amazon, putting Trustpilot through it too costs
$0.28/run and removes a second integration, a Chrome container and ownership of a
WAF arms race (§5.1).

---

## 1. What this feeds

One list of excerpts per product, each already shaped for §2.3:

```
text (verbatim) · star_rating · date · source_id · locator · axis
```

The reason star spread matters more than volume: §2.3 makes **3★ coverage
mandatory**, and §2.5.2 found Amazon supplies 3★ *by luck* (one product had two,
another none). A route returning fifty 5★ reviews has not completed the node; one
returning twelve including two 3★ has. **Sample control is the requirement; volume
is a side effect.** Exactly one route measured here gives it, and §2 is it.

---

## 2. Trustpilot — works from the VPS, free

### 2.1 What the block actually is, and why §2.5.3 misread it

`spec-stage-1.md` §2.5.3 concluded the 403 was an address-reputation block on
Hetzner ranges, and that "any path with a non-data-centre address reads Trustpilot
normally". Both halves are wrong.

| Request | Result |
|---|---|
| `curl https://www.trustpilot.com/` **[VPS]** | 403, **991 bytes** |
| `curl https://www.trustpilot.com/review/huel.com` **[VPS]** | 403, **991 bytes** |
| same two **[laptop, residential]** | 403, **991 bytes** — identical |

A residential address gets byte-identical refusals, so address reputation is not the
cause. The 991 bytes say what is:

```html
<title>Verifying Connection</title>
<script src="https://a7d575be72e8.edge.sdk.awswaf.com/a7d575be72e8/b5180ee838be/challenge.js" defer></script>
```

**An AWS WAF JavaScript challenge.** The 403 is the challenge being *served*, not
access being refused. Any client that does not execute JavaScript gets it forever,
from anywhere — which is precisely what both vantage points show.

§2.5.3 went wrong by varying only headers and address — the two things that do not
matter here — and never varying *whether JavaScript ran*. A domain-wide 403 is
equally consistent with a domain-wide challenge, and no test in that section
distinguished the two.

> **§2.5.3 is superseded.** Its measurements stand; its diagnosis and its remedy do
> not. Acting on it would have bought a proxy that changes nothing.

### 2.2 The route: one `docker run`, no Selenium

Chrome solves the challenge unattended. It does not need a driver, a stealth plugin,
a proxy, or Python — `--dump-dom` runs the page and prints the resulting DOM:

```bash
docker run --rm --shm-size=1g zenika/alpine-chrome:latest \
  --no-sandbox --headless=new --disable-gpu --disable-dev-shm-usage \
  --disable-blink-features=AutomationControlled \
  --virtual-time-budget=20000 --timeout=30000 \
  --dump-dom 'https://www.trustpilot.com/review/huel.com'
```

**[VPS]**, first run:

```
bytes=940496
title: Huel Reviews | Read Customer Service Reviews of huel.com
__NEXT_DATA__: 1
reviews parsed: 20
star spread: {1: 6, 2: 1, 3: 1, 4: 3, 5: 9}
business: Huel | trustScore: 4.2 | total: 29213
```

Reviews arrive as **structured JSON** in `__NEXT_DATA__` →
`props.pageProps.reviews`, not as HTML to be scraped:

```json
{
  "id": "6aab6ef8b861d71d40024242",
  "rating": 2,
  "title": "Their product is ok but customer support is bad",
  "text": "The product itself is okay, but unfortunately, the container arrived damaged…",
  "dates": { "experiencedDate": "2026-09-05T…", "publishedDate": "2026-09-17T…" },
  "consumer": { "displayName": "N D", "countryCode": "GB", "numberOfReviews": 1 },
  "labels": { "verification": { "isVerified": true, "verificationSource": "invitation" } }
}
```

Five of §2.3's six fields directly, with verification provenance on top.
`experiencedDate` and `publishedDate` differ — **use `experiencedDate`**; it is when
the customer had the experience, not when Trustpilot published it.

The `zenika/alpine-chrome` image is 958 MB pulled and needs `--shm-size=1g`; the VPS
had 2.2 GB free and ran it without trouble. `dbus` errors on stderr are normal in a
container and harmless — **do not treat stderr output as failure.**

### 2.3 Sample control — this is what closes the 3★ gap

Filters are plain query parameters, 20 reviews per page, and they compose. **[VPS]**:

| URL | Returned | Star spread | Wall time |
|---|---|---|---|
| `?stars=3` | 20 | `{3: 20}` | 9s |
| `?stars=1` | 20 | `{1: 20}` | 8s |
| (unfiltered) | 20 | `{1:6, 2:1, 3:1, 4:3, 5:9}` | ~10s |

Also verified **[laptop]**: `?page=2` paginates, and `?stars=3&page=2` composes to
20 more 3★ reviews.

**This is the most valuable finding in the document.** §2.3's mandatory-3★ rule
stops being a matter of luck: twenty 3★ reviews per page, paginated, for any
business on Trustpilot, from production, for free. Contrast Amazon (§3.4), where the
same-shaped parameter silently lies.

### 2.4 An optimisation available, but not needed on the VPS

**[laptop]** the browser's `aws-waf-token` cookie replays over plain `requests`:

```
waf-token stars=3:  http=200  reviews=20
no-token control:   http=403  bytes=991
```

so the browser is needed once per token rather than once per page. The token's
lifetime is **bounded but not pinned**: it worked immediately after harvest and was
**dead at 120 minutes**.

At 9s/page this is a premature optimisation — Trustpilot reviews are per *business*,
not per product, so a run needs roughly one business × five star bands ≈ 45s. Build
the simple thing. If token replay is added later, **treat a 403 as "re-mint and
retry", never as "blocked"** — a token ageing out mid-run looks exactly like the
permanent block §2.5.3 described, which is plausibly part of how that diagnosis
survived.

### 2.5 Cost

**Zero.** One container, ~9 seconds per page.

---

## 3. Amazon — address-blocked from the VPS, with no free way round

### 3.1 The block is real, and it returns HTTP 200

Eight sequential `curl --compressed` fetches of `/dp/B000BD0RT0` **[VPS]**, 3s
apart:

```
try1 bytes=3781   BOT-BLOCK
try2 bytes=783900 PAGE-NO-REVIEWS
try3 bytes=3781   BOT-BLOCK
try4 … try8       BOT-BLOCK
```

**Every one of those was HTTP 200.** The 3,781-byte body is Amazon's bot page:

```
To discuss automated access to Amazon data please contact api-services-support@amazon.com.
```

This is §2.5's "a wall fetches successfully" in its purest form, and it is the
*dominant* response from the VPS — 7 of 8, degrading as requests repeat, so it is
rate-sensitive on top of being address-sensitive.

> **§2.5.2 point 5 said Amazon "captchas this server".** Close, but the correction
> matters operationally: there is no captcha and no error status. There is a
> **200 with a 3.7 KB apology**. Code looking for a non-200, or for the string
> "Enter the characters you see", will not see this. Detect
> `api-services-support@amazon.com`.

### 3.2 Even the pages that are *not* blocked have no reviews

`try2` above returned a genuine product page — correct title, 1.5 MB decompressed:

```
title: Amazon.com: Doctor's Best High Absorption Magnesium Glycinate…
out of 5 stars:        37
id="customerReviews":  2
data-hook="review":    0     <-- no review text
reviewRichContentContainer: 0
```

So the VPS gets **star aggregates without review text**. A parser that reads
aggregates and reports success will record a product as reviewed when not one
customer sentence was retrieved.

A real browser does not help — `--dump-dom` from the VPS, twice:

```
try1 bytes=3497 reviews=0 block=1
try2 bytes=3497 reviews=0 block=1
```

**Chrome gets the bot page too.** Unlike Trustpilot, Amazon's wall *is* keyed to the
address, and running JavaScript is irrelevant to it. This is the clean contrast that
makes the two diagnoses trustworthy: the same browser beats one wall and not the
other.

### 3.3 Firecrawl — the path §2.5.2 recommended — has degraded to a coin flip

We already pay for Firecrawl, and §2.5.2 measured it returning 10–17 reviews on
2026-09-16 with `onlyMainContent: false, waitFor: 4000`. Re-measured **[VPS]** one
day later, with those exact settings:

| Target | Proxy | HTML | Reviews | Verdict |
|---|---|---|---|---|
| `.com` B000BD0RT0, `waitFor:4000` | default | 155 KB md | **0** | page, no reviews |
| `.com` B000BD0RT0, `waitFor:4000` (repeat) | default | 155 KB md | **0** | reproducible |
| `.com` B000BD0RT0, `waitFor:8000` | default | 191 KB md | **0** | not a timing issue |
| `.com` B000BD0RT0, `waitFor:6000` | **stealth** | 1.19 MB html | **0** | full page, still no reviews |
| `.com` B00NM6LVGE (other ASIN) | **stealth** | 1.4 KB | **0** | **bot-blocked** |
| `.co.uk` B0GZVQMXX4, `waitFor:4000` | default | 138 KB md | **~6** | partial |
| `.co.uk` B0GZVQMXX4, `waitFor:6000` | **stealth** | 1.05 MB html | **8** | best result obtained |

Three conclusions:

1. **The ASIN that gave 17 reviews yesterday gives 0 today**, reproducibly, across
   two `waitFor` values and both proxy modes. This is not §2.5.2 point 4's
   non-determinism; it is a changed outcome.
2. **`proxy: "stealth"` does not fix it.** It reliably avoids the *bot page* on some
   ASINs and fetches the full 1.19 MB document — which then contains no reviews.
   Stealth buys page access, not review access.
3. **The best result anywhere was 8 reviews**, below §2.3's floor of ten.

So the free-and-paid-we-already-own routes all land under the floor. **Amazon cannot
currently complete a review node from production by any route we possess.**

### 3.4 Two traps that will corrupt the corpus if Amazon is ever reachable

Measured **[laptop]**, where Amazon *does* serve reviews (13 per page, complete with
text/star/date/verified — see §9 for the working selectors).

**`filterByStar` on `/dp/` lies, in two different directions:**

| Request | Containers | Star spread |
|---|---|---|
| `/dp/B000BD0RT0` (control) | 13 | `{3:1, 4:1, 5:11}` |
| `?filterByStar=three_star` | **0** | `{}` |
| `?filterByStar=one_star` | 13 | `{3:1, 4:1, 5:11}` — **identical to control** |

`three_star` empties the page, which reads as "this product has no 3★ reviews".
`one_star` returns the *unfiltered* sample, which reads as **thirteen 1★ reviews,
eleven of which are really 5★** — fabricated star data entering the corpus, the
exact failure §2.3 exists to prevent.

> **Never send `filterByStar`.** If an extracted spread does not match the filter
> requested, discard the page. Star control comes from Trustpilot (§2.3) or a paid
> actor (§5), both of which honour it.

**`/product-reviews/` is an authentication wall**, confirmed from both vantage
points, so it is not address-related and no fetch tuning reaches it:

```
GET /product-reviews/B000BD0RT0/  ->  302
location: …/ap/signin?…&openid.return_to=…product-reviews…
```

The AJAX endpoint `…/hz/reviews-render/ajax/medley-filtered-reviews/get/…` returns
**404** and is retired.

### 3.5 Amazon's honest position

| | [VPS] — production | [laptop] — diagnostic only |
|---|---|---|
| Direct fetch | **bot page at HTTP 200**, ~7/8 of the time | 13 reviews, complete |
| Headless Chrome | **bot page** | (not needed) |
| Firecrawl default | 0–6 reviews, ASIN-dependent | — |
| Firecrawl stealth | 0–8 reviews, ASIN-dependent | — |
| Star control | none by any route | none |

Amazon from production is a **procurement decision** (§5), not a fetch-tuning one.
Nothing in the fetch layer is going to fix an address block.

---

## 4. Reddit — the gate is policy, not technology

### 4.1 Measured

| Route | [VPS] | [laptop] |
|---|---|---|
| `www.reddit.com/…/search.json`, browser UA | **403**, 190 KB block page | **403**, identical |
| same, descriptive UA (`mra-review-miner/0.1 by /u/…`) | — | **403**, identical |
| `old.reddit.com/…/search.json` | — | **302** |
| `POST /api/v1/access_token`, no credentials | — | **401**, 41 bytes |

The residential control gets the same 403, so §2.5's VPS block was never about
data-centre addresses, and the "likely to apply to Reddit" guess in §2.5.3 is wrong
for the same reason it was wrong about Trustpilot. Reddit refuses unauthenticated
JSON from everyone; the descriptive User-Agent its own older docs request buys
nothing.

The clean **401** from the token endpoint is a service waiting for credentials, not
a wall. The supported route exists and needs exactly one thing: an approved app.

### 4.2 The hard part is not the code

§2.5.1 called Reddit's API "the obvious first build". **That is now substantially out
of date.** Reported for 2026:

- Free tier: **100 queries/minute** per OAuth client, no per-call charge.
- Free tier is **non-commercial only** — personal, moderator, academic.
- Self-service registration **closed in late 2025**; every new client goes through
  manual approval, reported at two to four weeks, no guaranteed answer.
- Commercial use needs a separate agreement, reported at **$0.24 per 1,000 calls**.

> **Treat every bullet above as unverified.** Reddit's own help wiki
> (`support.reddithelp.com/…/16160319875092`) **returned 403 to our fetch**, so the
> primary source could not be read. The secondary sources are vendor blogs selling
> Reddit-scraping alternatives, who profit from the official API looking difficult.
> The 403/401 results in §4.1 are first-hand; the policy is hearsay until someone
> reads the terms or files the application.

If the reports are right, **a marketing research agent is commercial use**, and a
free-tier token obtained by calling it a personal project is revocable. That is the
operator's decision, not a pipeline default.

### 4.3 What Reddit is worth

Less than its prominence suggests. Reddit has **no star ratings**, so it cannot
contribute to the 1★–5★ spread and can never satisfy the 3★ rule. Its value is
different in kind: unprompted language about *why people quit*, which marketplace
reviews systematically under-represent because people who quit stop reviewing.

Reddit is a `forum_post` source enriching `why_quit`, not a review source — **last of
the four to build**, not first. It is the only one gated on multi-week human
approval and the only one that cannot move the done-criterion.

---

## 5. Apify — the chosen route for both sources

**Decision, 2026-09-17: Trustpilot and Amazon are both sourced through Apify
actors. Reddit is out of scope. This supersedes §7's earlier build order**, which
had Trustpilot on our own headless Chrome.

Apify is a hosted actor marketplace: it runs someone else's scraper **on their
addresses** and returns JSON. That last part is the whole point — §3 is an address
problem, and this is the cheapest way to borrow a different address without running
proxy infrastructure.

### 5.1 Why Trustpilot too, when §2 proved it free

§2 is correct and still works: one `docker run` reads Trustpilot from the VPS for
nothing. Routing it through Apify anyway costs about **$0.28 per run** and buys:

- **One integration instead of two.** A single Apify client, one auth model, one
  error taxonomy, one retry policy — rather than an HTTP client *plus* a container
  lifecycle, a WAF-token cache and a 403-means-re-mint rule (§2.4).
- **No 958 MB Chrome image or `--shm-size=1g` on a 3.8 GB VPS** that is already
  running five containers with 2.2 GB free.
- **No ownership of the WAF arms race.** §2 works today against an AWS WAF challenge
  that Trustpilot can retune whenever they like; when it breaks it breaks in
  production and we fix it. Apify's actor has 145k runs and someone else on the hook.

> **Keep §2 as the documented fallback, not dead weight.** It is proven from the VPS
> and costs nothing, so it is the escape hatch if the actor degrades the way
> Firecrawl did in §3.3 — which is precisely the failure mode this project has
> already been bitten by once. `probes/review-mining/vps_probe.sh` keeps it tested.

### 5.2 The actors

Measured against the public store API (`api.apify.com/v2/store`, no token needed —
it answered 200 and reported 1,306 Trustpilot-matching actors):

| Role | Actor | Runs | FREE-tier price | Min charge |
|---|---|---|---|---|
| **Amazon** | `junglee/amazon-reviews-scraper` | 902k | **$0.006/review** → $6.00/1k | $0.50 |
| **Trustpilot** | `memo23/trustpilot-scraper-ppe` | 145k | **$0.00075/item** → $0.75/1k, **+ $0.05 per run start** | $0.45 |

Rejected candidates, recorded so they are not re-evaluated:

- **`apify/e-commerce-scraping-tool`** — the actor named in the request. It is a
  **product and price** scraper (`detailsUrls`, `listingUrls`, `maxProductResults`,
  price monitoring across marketplaces), not a review miner. Its only review field
  is `scrapeReviewsDelivery`, which belongs to its food-delivery mode. **Wrong tool
  — it does not return the review corpus §2.3 needs.**
- `logiover/trustpilot-reviews-scraper` — cleaner inputs, but **184 total runs**
  (vs memo23's 145k) and **$2.99/1k**, four times the price. Unproven and dearer.
- `nikita-sviridenko/trustpilot-reviews-scraper` — reasonable schema, but not
  returned by the store listing, so its pricing could not be read.

### 5.3 Amazon — `junglee/amazon-reviews-scraper`

Input schema, read from the actor's default build:

```json
{
  "productUrls":      [{ "url": "https://www.amazon.com/dp/B000BD0RT0" }],
  "filterByRatings":  ["threeStar"],
  "maxReviews":       25,
  "sort":             "recent",
  "includeGdprSensitive": false,
  "scrapeProductDetails": false
}
```

**`filterByRatings` is the thing worth paying for.** Enum:
`allStars | fiveStar | fourStar | threeStar | twoStar | oneStar | positive | critical`.
This is real star control — the capability Amazon's own `filterByStar` parameter
pretends to offer and silently fakes (§3.4). It converts §2.3's mandatory-3★ rule
from luck into a request parameter.

Constraints from the actor's own README, which change the run plan:

- **Max 100 reviews per star rating**, so ≤500 per product across five bands. Far
  above our floor of ten; the binding limit is budget, not the actor.
- **Only reviews with text are returned** — bare star ratings are skipped. This is
  what we want (§2.3 needs verbatim text) but it means the count will not match the
  rating total Amazon displays. *Do not treat that mismatch as an error.*
- `sort` is `helpful` (default) or `recent`. **Prefer `recent`**: `helpful`
  re-inherits Amazon's own popularity skew, which is what §2.5.2 flagged about the
  default sample.
- Duplicate reviews from overlapping filters (e.g. `oneStar` + `critical`) are
  de-duplicated by the actor. **Request the five discrete bands, never the
  `positive`/`critical` aggregates**, or the star spread becomes unverifiable.
- `includeGdprSensitive` defaults to `false`. **Leave it false** — §2.3 needs the
  text, the star and the date, none of which is personal data, and reviewer names
  buy nothing.

**The error taxonomy is the gap signal**, and it is better than anything the free
routes offer. The actor emits a typed `error` field:

| `error` | Meaning for us |
|---|---|
| **`no_relevant_reviews_found`** | **Reviews exist, none match the filter** — an honest "this product has no 3★", which is a *gap*, not a failure |
| `product_not_found` | 404 — bad ASIN in the brief |
| `invalid_url` / `shortened_url_invalid` | malformed input, fix the caller |
| `no_results_found` | nothing at all |

`no_relevant_reviews_found` is exactly the signal §3.4 showed Amazon's own
`filterByStar=three_star` failing to give — there it returned an empty page
indistinguishable from a broken parser.

### 5.4 Trustpilot — `memo23/trustpilot-scraper-ppe`

```json
{
  "startUrls":   [{ "url": "https://www.trustpilot.com/review/huel.com" }],
  "filterStars": ["3"],
  "maxItems":    25,
  "sortBy":      "recent",
  "filterVerifiedOnly": true,
  "filterLanguages":    ["en"],
  "includeCompanyDetails": true
}
```

`filterStars` takes `["1","2","3","4","5"]` and matches the `?stars=N` behaviour §2.3
measured directly, so the two routes are interchangeable — which is what makes §2 a
usable fallback rather than a different data model.

**Do not enable `painPointAnalysis` ($0.05/event) or `reviewInsights`
($0.02/event).** They are LLM summarisation billed per item, and §2.3 forbids
exactly that: a vendor's paraphrase of reviews is *somebody else's stage 3* and may
never become a `review_mining` excerpt. We buy raw text and do our own judging.
These two options are the single easiest way to quietly violate the spec **and**
multiply the bill — `painPointAnalysis` alone is 67× the per-item rate.

### 5.5 Cost

For a realistic stage-1 run — 20 products, 5 star bands, ~6 reviews per band
(30/product), plus 3 brands on Trustpilot at 20 per band:

| Source | Volume | Arithmetic | Cost |
|---|---|---|---|
| Amazon | 600 reviews | 600 × $0.006 | **$3.60** |
| Trustpilot | 300 items, 1 batched run | $0.05 + 300 × $0.00075 | **$0.28** |
| | | **per run** | **≈ $3.90** |

- **Tiers are by *your Apify plan*, not by volume.** DIAMOND ($0.001/review) needs a
  large monthly commitment, so **the FREE column is our real price.** Do not budget
  against the cheap column.
- **Batch every product into one actor call.** memo23 charges **$0.05 per run
  start**; at 20 reviews that fee is 77% of the bill. One call per run, not per
  product.
- **`minimalMaxTotalChargeUsd` is $0.50 (Amazon) and $0.45 (Trustpilot).** This is
  the floor Apify requires for the run's spend cap. **Whether it is also a minimum
  *charge* was not verified** — with no token, this could not be tested, and it is
  the difference between $3.90 and $4.85 per run at these volumes.
- **`/v2/acts/{id}` returns `currentPricingInfo: null`** — pricing lives only on
  `/v2/store`. A cost check written against the obvious endpoint silently sees no
  price.
- An unauthenticated run returns **402 Payment Required**, not 401: the actor exists
  and billing is the gate.

### 5.6 Executed — the intertrigo spike, 2026-09-17

**The Amazon actor was run for real**, five times, against four intertrigo ASINs,
via the `apify-client` npm package (`server/scripts/apify-spike.mjs`). Total spend
**$0.168**. Everything below is observed, not documented.

**It works, and it reaches the page we cannot.** The run log shows the actor
fetching:

```
/product-reviews/B0HH55FRPV?pageNumber=1&filterByStar=three_star&sortBy=recent&…
```

— the exact path that 302s us to `/ap/signin` (§3.4). So Apify does solve the
authentication wall, which was the open question behind the whole purchase.

**Real dataset fields** (28 per item), with the three §2.3 needs in bold:

```
reviewTitle · reviewDescription(text) · ratingScore(star) · date · reviewedIn
reviewId · reviewUrl · isVerified · isAmazonVine · reviewReaction · position
variant · variantAttributes · userId · userProfileLink · country · countryCode
totalCategoryRatings · totalCategoryReviews · reviewCategoryUrl · filterByRating
productAsin · productOriginalAsin · variantAsin · product · input
```

> The field names are **not** what §5.3 guessed. It is `reviewDescription`, not
> `text`; `ratingScore`, not `rating`. An adapter written against the documented
> names would have returned `undefined` for every excerpt — which is why §7.0
> exists.

**Yield across the category:**

| ASIN | Items | Star spread (10 sampled) | `totalCategoryReviews` | 3★? |
|---|---|---|---|---|
| B0HH55FRPV | 5 | `{5:5}` | 5 | ❌ |
| B0H877269S | 2 | `{5:2}` | 2 | ❌ |
| B0GWFRBSQN | 10 | `{1:1, 5:9}` | 14 | ❌ |
| **B0GSLJKW6N** | 10 | `{1:1, 3:1, 4:3, 5:5}` | 10 | ✅ |

**Those four ASINs were chosen badly** — picked by hand from a web search. The
resolver in §5.8a surfaced far better ones on the first page of Amazon's own search,
and re-measured:

| ASIN | `totalCategoryRatings` | `totalCategoryReviews` (written) | First 10, recent | 3★ text? |
|---|---|---|---|---|
| B0H2JVQ9GR | 61 | **28** | `{1:3, 4:1, 5:6}` | ❌ none |
| B0H4X2HJT2 | 52 | **41** | `{1:2, 4:2, 5:6}` | not in sample |

**Both clear §2.3's ten-review floor comfortably.** So the category is minable — the
first pass just had the wrong products, which is exactly the failure §5.8a's
`reviewsCount` step exists to prevent.

**But 3★ *text* is genuinely scarce.** B0H2JVQ9GR has 61 ratings, 28 written
reviews, and `threeStar` returns `no_relevant_reviews_found` — people leave a middle
star without writing anything. **Ratings ≫ reviews is the shape of this whole
category**, and §2.3's mandatory-3★ rule may be structurally unsatisfiable here. The
correct response is a node marked `incomplete` with a gap naming that, not a
substituted 4★.

**`no_relevant_reviews_found` behaves exactly as hoped** — and is billed. Asking
B0HH55FRPV for `threeStar` returned one record:

```json
{ "error": "no_relevant_reviews_found",
  "totalCategoryRatings": 5, "totalCategoryReviews": 0,
  "filterByRating": "threeStar", "productAsin": "B0HH55FRPV" }
```

Five ratings exist at 3★; none has written text. That is a **gap**, not a failure —
and it is the signal Amazon's own `filterByStar=three_star` refuses to give (§3.4
found it returning an empty page indistinguishable from a broken parser).

### 5.7 Five billing and plan facts that change the design

1. **The FREE plan caps total spend at $5/month.** Measured from
   `client.user('me').limits()`: `maxMonthlyUsageUsd: 5`, cycle 2026-09-17 →
   2026-10-16, `dataRetentionDays: 7`.
2. **The actor throttles free users hard**, from its own run log:
   > *"as a free user, you are limited to only 1 start URL and you'll get only 10
   > Amazon reviews per run"*
   **This kills the batching strategy in §5.5.** One product per run, ten reviews
   per run. A 20-product run needs 20+ separate runs, not one.
3. **Error records are billed as results.** The `no_relevant_reviews_found` run
   charged `{"result": 1}` = **$0.006**. *You pay for gaps.* Budgeting on
   successful reviews alone will undercount every thin product — and in this
   category most products are thin.
4. **There is no minimum charge, but there is a minimum *cap*.** A run returning one
   error record cost $0.006, not $0.50 — so `minimalMaxTotalChargeUsd` is not a
   floor on spend. It *is* enforced on the ceiling: `maxTotalChargeUsd: 0.25` is
   rejected at call time with **HTTP 400, "Maximum cost per run is less than the
   allowed minimum of $0.50"**. Pass ≥ $0.50 (Amazon) / ≥ $0.45 (Trustpilot).
5. **`usageTotalUsd` is not populated on the object `.call()` returns.** It settles
   moments later. Read it straight back and every run appears to cost $0.00 — which
   is how a cost guard silently measures nothing. Re-fetch with a delay, or read
   `chargedEventCounts` from `client.run(id).get()` later.

**Revised cost model for the FREE plan.** At 10 reviews/run and $0.006/review, a
20-product stage-1 run costs **20 × 10 × $0.006 = $1.20** — but is capped at ten
reviews per product, which *just* meets §2.3's floor with no margin and no star
control within a run. The $5 monthly ceiling allows roughly **four such runs per
month**. A paid plan lifts both the per-run cap and the monthly ceiling; that is the
next procurement decision, and it should be made against measured yield rather than
list price.

### 5.8a The I/O contract — what goes in, what comes out

**The two actors take different *kinds* of thing, and neither takes a product
name.** This is the asymmetry that decides the pipeline shape.

| | **Amazon — `junglee/amazon-reviews-scraper`** | **Trustpilot — `memo23/trustpilot-scraper-ppe`** |
|---|---|---|
| Granularity | **one product** (ASIN) | **one company** (domain) |
| Required input | `productUrls` — **required** | none required |
| Accepts a name? | **No.** Only `/dp/<ASIN>` URLs | **Yes** — `searchTerms: ["huel"]`, resolved via autosuggest; also a bare slug or `/review/` URL |
| Star filter | `filterByRatings: ["threeStar"]` | `filterStars: ["3"]` |
| Reviews are about | the product | the **merchant** — delivery, support, ordering |

`reviewsFilterByKeywords` on the Amazon actor filters *within* reviews. It does not
find products. **There is no product-name input to the Amazon actor.**

**What stage 0 hands us** (`ScoredProduct`, `server/src/stage0.ts:167`):

```ts
{ shopId, domain, category, title, price, currency, score, reason }
```

- `domain` (e.g. `huel.com`) → **feeds Trustpilot directly.** No resolution needed.
- `title` (a Shopify best-seller name) → **does not feed Amazon.** There is no ASIN
  anywhere in stage 0's output, and a DTC Shopify product may not be on Amazon at all.

**So Amazon needs a resolver step, and it exists.** Measured 2026-09-17:

```
junglee/free-amazon-product-scraper   $0.012/result, 1.2M runs
  in : { categoryUrls: [{url: "https://www.amazon.com/s?k=intertrigo+cream"}],
         maxItemsPerStartUrl: 5, maxSearchPagesPerStartUrl: 1 }
  out: asin · title · stars · reviewsCount · price · position · isSponsored · imageUrl
```

Live output for `intertrigo cream`:

| `asin` | `stars` | `reviewsCount` | title |
|---|---|---|---|
| B013PGADAW | 4.6 | **17,149** | Globe Clotrimazole Cream 1% Antifungal |
| B0H2JVQ9GR | 3.9 | 61 | Intertrigo Cream – Skin Fold Barrier Cream |
| B0H4X2HJT2 | 4.1 | 52 | Hermon Intertrigo Cream for Skin Folds |
| B0HB4CST4Y | 5.0 | 23 | 2PCS Intertrigo Relief Cream |
| B0HFXKNB61 | 5.0 | 4 | Intertrigo Cream with Zinc Oxide |

**`reviewsCount` is the reason this step pays for itself.** It tells us which ASIN is
worth mining *before* buying a single review. The four ASINs in §5.6 — picked by hand
from a web search — had 5, 2, 14 and 10 reviews. The resolver surfaced products with
52 and 61 on the first page. **Choosing the product badly costs more than the
resolver does.**

`url` comes back empty; construct `https://www.amazon.com/dp/${asin}`.

**The full chain, per stage-1 product:**

```
stage 0: { title, domain }
   │
   ├── domain ────────────────────────────────► memo23/trustpilot-scraper-ppe
   │                                              startUrls: [domain]
   │                                              filterStars: ["3"] …
   │                                              → merchant reviews
   │
   └── title → junglee/free-amazon-product-scraper
                 categoryUrls: ["…/s?k=<title>"]
                 → pick highest reviewsCount
                 → asin → junglee/amazon-reviews-scraper
                            productUrls: ["…/dp/<asin>"]
                            filterByRatings: ["threeStar"] …
                            → product reviews
```

**Output fields, both observed live:**

| §2.3 needs | Amazon | Trustpilot |
|---|---|---|
| verbatim text | `reviewDescription` | `text` |
| star rating | `ratingScore` | `rating` |
| date | `date`, `reviewedIn` | `experiencedDate` *(not `publishedDate`)* |
| locator | `reviewUrl`, `reviewId` | `url`, `id` |
| provenance | `isVerified`, `isAmazonVine` | `isVerified`, `verificationLevel` |
| extra | `reviewTitle`, `country`, `variant`, `totalCategoryReviews` | `title`, `language`, `reply`, `businessName`, `reviewerCountry` |

28 fields from Amazon, 37 from Trustpilot. **Neither matches the names §5.3 guessed
from the READMEs.**

### 5.8b Trustpilot executed — and it confirms the merchant/product split

One run, `huel.com`, `filterStars: ["3"]`, `maxItems: 5`:

```
run SUCCEEDED (9.5s)   items: 5   star spread {"3":5}   FILTER HONOURED: true
charged $0.0538  = $0.05 actor-start + 5 x $0.00075
```

The star filter works exactly as `?stars=3` did on the free route (§2.3). But read
what came back:

```
[3*] "The scoop was missing !"
[3*] "Product itself is ok, no complaints about it whatsoever. What was really bad
      was the experience with the order. One product … was cancelled"
[3*] "サービスや品質は素晴らしいです。ただ、在庫が全く無い。"
```

**Two of three are about order handling, not the product**, and the first says so
explicitly. This is the §1 point measured rather than argued: Trustpilot answers
`why_quit` about a *merchant*; it does not answer `why_bought` about a *product*.
Set `filterLanguages: ["en"]` unless you want the Japanese one too.

**$0.05 of a $0.0538 bill is the actor-start fee — 93%.** Batch every brand for a
run into one call.

### 5.8c A contamination risk §2.3's rules do not catch

B0H877269S returned two reviews. The first:

```
title: "Lace detail is lovely"
text : "The lace trim at the neckline and cuffs is what sold me. It's not flimsy
        or itchy, just a nice touch that makes the set feel more expensive…"
isVerified: false
```

**That is a review of a nightwear set, returned for an intertrigo cream.** All three
ASIN fields (`productAsin`, `variantAsin`, `productOriginalAsin`) agree, so the
actor attributed it correctly — **Amazon's listing genuinely carries it.** It is a
recycled ASIN: a listing that previously sold something else, keeping its old
reviews.

This matters because it passes every test §2.3 imposes. It is verbatim. It is
first-hand. It is the customer's own words on the page where they posted them. It
has a star and a date. **Nothing in the current rules rejects it**, and it would
enter `review_mining` as evidence about a skin cream.

The available signals, in order of reliability:

- **`isVerified: false`** — both of that listing's reviews were unverified, against
  13/13 verified on the free-route sample in §9. A low verified ratio is a
  listing-quality alarm.
- **Topical mismatch against the product title** — cheap to check with the model
  already in the pipeline, and the only signal that catches a *verified* hijack.
- **`totalCategoryReviews` far below the product's rating count** — B0H877269S has 2
  of each, which is itself a sign of a listing with no genuine history.

> **Proposed rule, for §2.3:** an excerpt whose subject matter does not match the
> product is rejected as `off_product`, regardless of how first-hand it is.
> Suggested but *not* adopted here — it belongs in `spec-stage-1.md` §2.3 and is the
> operator's call.

---

## 6. browser-use — audited, not recommended

You asked for an audit rather than a trial, so this is a read of the repo and docs.

**What it is.** MIT-licensed Python library (≥3.11), 114.9k GitHub stars, ~10.3k
commits — genuinely mature, actively developed. Drives real Chromium via Playwright
and lets an **LLM decide what to click**:

```python
from browser_use import Agent, ChatOpenAI
agent = Agent(task="Find stars of browser-use repo", llm=ChatOpenAI(model='gpt-5.6-luna'))
await agent.run()
```

A paid cloud adds stealth browsers, residential proxies and CAPTCHA handling
(~$0.02/browser-hour; hosted agent at 1.2× provider token rates).

**Why it is wrong for this**, on four counts:

1. **We do not have a navigation problem.** It earns its cost where the path is
   unknown or changes. Our targets are fixed URL templates returning structured JSON
   (`__NEXT_DATA__`) or stable `data-hook` attributes. Paying an LLM to rediscover a
   URL we already know is pure overhead.
2. **It does not solve the one wall we still have.** Amazon blocks the VPS *address*
   (§3.2) — proven by plain Chrome getting the bot page. An LLM steering that same
   browser from that same address changes nothing. Only the paid cloud's residential
   proxies would, and at that point we are buying addresses, which Apify sells more
   cheaply per review.
3. **Cost is hostile to volume.** Published figures put complex pages at
   **$0.15–$0.40 per run** in tokens — at 20 products, $3–$8 per stage-1 run, *more
   than Apify's Amazon actor*, while slower and less deterministic.
4. **Non-determinism is a correctness risk, not just flakiness.** §2.3 requires
   verbatim, content-hashed excerpts. An LLM in the extraction loop is a paraphrase
   hazard exactly where the spec forbids paraphrase. `--dump-dom` cannot paraphrase;
   an agent reporting what it saw can.

Its own docs concede *"no browser configuration guarantees that every CAPTCHA can be
avoided or solved."*

**Verdict: correctly identified as a last resort, and we do not need it.** The only
scenario that revives it is Amazon deep pagination behind a signed-in session
(§3.4) — real navigation, real judgement. That is a terms-of-use decision before a
tooling one, and §2.5.2 already timeboxes it.

What we needed from that family was **plain Chrome with no LLM and no driver**, and
§2.2 shows it beating the hardest wall we have, from production, in one command.

---

## 7. Build order

> **Revised 2026-09-17 by the §5 decision: both sources go through Apify.** The
> superseded order opened with our own headless-Chrome Trustpilot reader. That route
> still works and is kept as §2's fallback; it is simply no longer step 1.

**0 — Provision `APIFY_TOKEN` and spike. Nothing else can start.**
There is no token in `.env`, `.env.example`, or either compose file on the VPS
(§5.6). Add it to `.env` and `.env.example`, then run **one product and one brand**
through each actor and read the output before writing an adapter. Both actors'
READMEs recommend exactly this, and it answers the four things §5.6 lists as
unverified — dataset field names, whether the star filters behave, real yield, and
whether the minimum charges bite. Budget ~$1.

**1 — Amazon via `junglee/amazon-reviews-scraper`.** One batched call per run,
five discrete `filterByRatings` bands, `sort: "recent"`, `includeGdprSensitive:
false`. Map `no_relevant_reviews_found` to a **gap**, not an error. This is the
source with no free route (§3) and the one §2.3's marketplace floor actually
requires.

**2 — Trustpilot via `memo23/trustpilot-scraper-ppe`.** `filterStars` per band,
`maxItems` capped, one run start per stage-1 run. **`painPointAnalysis` and
`reviewInsights` stay off** — they are paraphrase, which §2.3 forbids, and 67× the
per-item price.

**3 — The wall detector. Not optional, and test it first.**
§2.5's sharpest finding is that *a wall fetches successfully* — 170 bytes of
"Verifying your connection" became a cited source in run `yoracare`. Every route here
has a failure that returns a page, and §3.1 found one returning **HTTP 200**:

*Apify moves the walls; it does not remove them.* The failures now arrive as
well-formed JSON, which is easier to mishandle, not harder:

| Signature | Meaning |
|---|---|
| **`error: no_relevant_reviews_found`** | **no reviews at that star band — a gap, not a failure** |
| `error: product_not_found` / `invalid_url` | bad ASIN or malformed URL — fix the caller |
| **empty dataset, run status `SUCCEEDED`** | **the Apify-shaped version of "a wall fetches successfully"** — never record as "no reviews" |
| run status `FAILED` / `ABORTED` / `TIMED-OUT` | retry once, then gap |
| **HTTP 402** | out of credit — this will look like a data problem and is not |
| returned star ≠ requested band | actor filter misbehaving — discard, §3.4's trap in a new costume |
| returned count < requested where budget was not the cap | partial result — gap it |

And on the §2 fallback path, if it is ever used:

| Signature | Meaning |
|---|---|
| 403 + 991 bytes + `awswaf` | Trustpilot challenge — run JS / re-mint token |
| **200 + ~3.7 KB + `api-services-support@amazon.com`** | **Amazon bot page — not a product page** |
| 200, star aggregates present, 0 review containers | Amazon review-stripped page — record a gap |
| 302 → `/ap/signin` | Amazon login wall — do not follow |
| 200 but 0 containers where a star aggregate is non-zero | stale selector, **not** an empty product |

Each must raise a **gap**, never an empty result set. The bar to clear is run
`yoracare`, where a successful fetch of a wall became a cited source.

**4 — A cost ceiling, before the first real run.** Pass `maxTotalChargeUsd` on every
actor call and cap `maxReviews`/`maxItems`. Per-event billing means a mis-specified
input — no `maxReviews`, all five bands, 20 products — silently authorises
20 × 500 × $0.006 = **$60** where $3.90 was budgeted. The cap is the only thing
between a bug and that invoice.

**Out of scope:** Reddit (§4 — approval-gated, no star ratings, cannot move the
done-criterion), browser-use (§6), and proxies for Trustpilot (§2.1 shows they fix
nothing).

---

## 8. Things that will bite you

- **Amazon's bot page is HTTP 200 with a 3.7 KB body.** No captcha, no error status.
  Detect `api-services-support@amazon.com`. Everything that checks `status == 200`
  will sail straight past it.
- **Amazon serves review-stripped product pages to the VPS** — correct title, star
  aggregates, `id="customerReviews"`, and zero review text. Aggregates are not
  evidence of reviews.
- **`curl` without `--compressed` makes Amazon's block look like a big page.** The
  first VPS fetch reported 287,908 bytes and looked like a win; it was gzip, and
  grep silently reported "binary file matches" on every marker. Always
  `--compressed`, and check the decompressed size.
- **Trustpilot's 403 means "run JavaScript", not "blocked".** Byte-identical from a
  data-centre and a residential address. Better headers and proxies are wasted work.
- **The WAF token expires silently**, under two hours — measured dead at 120 min.
  Mid-run expiry is indistinguishable from a permanent block.
- **Chrome in a container writes `dbus` errors to stderr and works fine.** Do not
  treat stderr as failure.
- **`filterByStar=one_star` returns Amazon's unfiltered sample**, which enters the
  corpus as thirteen 1★ reviews that are mostly 5★. `three_star` returns zero. Both
  look like success.
- **`data-hook="review-body"` matches nothing** on current Amazon markup. Every
  tutorial uses it. It fails as "no reviews", not as an error. See §9.
- **Apify pricing is absent from `/v2/acts/{id}`** and present on `/v2/store`.
- **The actor's documented field names are not its actual ones.** `reviewDescription`
  and `ratingScore`, not `text` and `rating`. An adapter written from the README
  returns `undefined` for every excerpt and looks like an empty source.
- **`usageTotalUsd` is $0 if you read it from what `.call()` returns.** It settles
  afterwards. A cost guard reading it immediately measures nothing, forever.
- **Apify rejects a `maxTotalChargeUsd` *below* the actor minimum** with HTTP 400 —
  the cap has a floor ($0.50 Amazon, $0.45 Trustpilot). The obvious safety
  instinct, setting a small cap, fails the call outright.
- **Error records are billed as results** — `no_relevant_reviews_found` costs
  $0.006. Thin products are not free to discover.
- **On the FREE plan the actor silently accepts 1 start URL and 10 reviews per run**
  and says so only in the run log, not in the response. Batching more products into
  `productUrls` will not error; the extras are dropped.
- **Apify per-run start fees dominate small calls** — $0.05 on a $0.065 job. Batch
  *where the plan allows it*, which on FREE it does not.
- **A review can be verbatim, first-hand, correctly attributed — and about a
  different product.** Recycled ASINs carry their old listing's reviews (§5.8).
  `isVerified: false` and topical mismatch are the only tells.
- **An empty Apify dataset on a `SUCCEEDED` run is the new "wall fetches
  successfully".** It is well-formed JSON saying nothing, and it will be recorded as
  "this product has no reviews" unless something distinguishes it from
  `no_relevant_reviews_found`.
- **Apify 402 is out-of-credit, not a data problem** — it will surface mid-run,
  mid-product, and read exactly like a source going quiet.
- **Per-event billing makes an unbounded input expensive, not slow.** No
  `maxReviews` + five bands + 20 products = 20 × 500 × $0.006 = **$60** against a
  $3.90 budget. `maxTotalChargeUsd` on every call is the only backstop.
- **`painPointAnalysis` / `reviewInsights` on the Trustpilot actor are LLM
  paraphrase**, billed at up to 67× the per-item rate, and forbidden by §2.3
  regardless of price. They are one boolean away at all times.
- **Amazon's actor returns only reviews that have text**, so its count will not
  match the rating total Amazon displays. That mismatch is correct behaviour, not a
  shortfall to chase.
- **`sort: "helpful"` is the actor's default** and re-inherits Amazon's popularity
  skew — the exact bias §2.5.2 flagged in the free sample. Pass `"recent"`.
- **A residential IP is not a general unblocker.** It fixes Amazon, does nothing for
  Trustpilot, nothing for Reddit. Diagnose the specific wall before paying for a
  route.

---

## 9. Amazon selectors, for whenever Amazon is reachable

Recorded because they cost twenty minutes to find and every guide online is stale.
Verified **[laptop]** against markup served 2026-09-17:

| Hook | Status |
|---|---|
| `data-hook="review-body"` | **0 matches** — stale; this is what most scrapers use |
| `data-hook="reviewTextContent"` | **0 matches** — also wrong |
| `data-hook="reviewRichContentContainer"` | ✅ the review text |
| `data-hook="reviewTitle"` | ✅ title, inside an `<h5>` |
| `data-hook="review-date"` | ✅ `"Reviewed in the United States on December 13, 2016"` |
| `data-hook="review-star-rating"` | ✅ inner `<span class="a-icon-alt">5 out of 5 stars</span>` |
| `data-hook="avp-badge"` | ✅ presence = Verified Purchase |

Containers split cleanly on `<div id="R…" data-hook="review">`. Yield **[laptop]**:
13 containers, 13 complete, `{3:1, 4:1, 5:11}`, 13/13 verified.

Assert `reviews > 0` wherever a star aggregate is non-zero, and fail loudly — the
wrong selector returns zero reviews from a page that has thirteen.

---

## 10. Reproducing these measurements

Scripts are in `probes/review-mining/` with usage notes in its README. They are
**probes, not readers** — kept so these numbers can be re-checked when a site
changes. Anything promoted to a real reader belongs in `server/src/` with tests per
`CLAUDE.md`.

| File | Measures | Run from |
|---|---|---|
| **`apify_spike.py`** | **the chosen route** — both actors, spend-capped, ~$0.20. Settles §5.6 | anywhere with a token |
| `vps_probe.sh` | the whole VPS matrix: Trustpilot via Chrome, Amazon direct, Reddit | **the VPS** |
| `tp_browser.py` | Trustpilot WAF challenge via Selenium; `__NEXT_DATA__` shape | laptop |
| `tp_filter.py` | `?stars=` / `?page=` behaviour; WAF-token harvest and replay | laptop |
| `az_extract.py` | Amazon review extraction against current markup | laptop |

**Always record which vantage point a run used.** The laptop/VPS split is the single
most load-bearing distinction in this document, and three of the four sources behave
differently across it.

---

## 11. Status

| Source | Route | Cost | Star control | State |
|---|---|---|---|---|
| **Amazon** | **Apify `junglee/amazon-reviews-scraper`** | $6/1k reviews | **`filterByRatings`** | ✅ **executed** — 5 runs, $0.168, fields observed (§5.6) |
| **Trustpilot** | **Apify `memo23/trustpilot-scraper-ppe`** | $0.75/1k + $0.05/run | **`filterStars`** | ✅ **executed** — filter honoured, $0.0538 (§5.8b) |
| **ASIN resolver** | **Apify `junglee/free-amazon-product-scraper`** | $0.012/result | n/a | ✅ **executed** — title → asin + `reviewsCount` (§5.8a) |
| Trustpilot | Chrome `--dump-dom` + `?stars=N` | free | full | ✅ **fallback, VPS-proven** (§2) |
| Trustpilot | WAF-token replay over plain HTTP | free | full | optimisation, laptop-only |
| Amazon | direct GET `/dp/` | free | none | ❌ bot page at HTTP 200 |
| Amazon | headless Chrome | free | none | ❌ bot page — block is by address |
| Amazon | Firecrawl (default or stealth) | per scrape | none | ⚠️ 0–8 reviews, ASIN-dependent, **below the floor** |
| Reddit | OAuth API / Apify `trudax` | free\* / $4/1k | none possible | ⛔ **out of scope** (§4) |
| browser-use | — | $0.15–0.40/run | — | ⛔ **rejected** (§6) |

\* free tier reportedly non-commercial only — unverified, §4.2.

**Where this leaves the node.** §2.5's "review mining cannot complete at all" is no
longer true. Trustpilot is solved twice over — free from the VPS today, and through
Apify once a token exists — and Amazon has a route that sells the one thing no free
path offers: **a star filter that actually filters.** Between them they satisfy both
halves of §2.3, the marketplace floor and the mandatory 3★.

Three things stand between this and a working node, in order:

1. ~~An `APIFY_TOKEN` and a spike~~ — **done** (§5.6). Token provisioned, Amazon
   actors executed — Amazon, Trustpilot **and** the ASIN resolver — real field names
   captured, **$0.41 spent** of a $5 monthly cap. What it surfaced instead: the free
   plan's **1 URL / 10 reviews per run** ceiling makes batching impossible, and a
   **paid-plan decision** is now the open procurement question.
2. **The wall detector** (§7.3). Apify moves the walls into JSON; an empty dataset on
   a `SUCCEEDED` run is the new 200-with-a-bot-page, and a 402 will read as a data
   problem when it is a billing one.
3. **A spend cap on every call** (§7.4). Per-event billing turns a missing
   `maxReviews` into $60 where $3.90 was budgeted.

Without (2), every improvement here is one silent success away from filling the
corpus with page furniture again — which is the failure run `yoracare` already
demonstrated once.
