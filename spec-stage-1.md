# Spec — Stage 1: raw material collection

**Status:** built (stage 1); node requirements extended 2026-09-16, §2.5 measures what
is actually reachable · **Date:** 2026-09-11, revised 2026-09-16 · **Parents:** `spec.md` (what the
researcher does), `cockpit-spec.md` (how you watch it) · **Engine:**
`@earendil-works/pi-agent-core`, in-process (was: hermes runs API — see §6 and §8.2)

This is the first of five stage specs. It is deliberately the narrowest one, because
stage 1 is the only stage whose output is allowed to contain no thinking at all.

---

## 1. What stage 1 is

Four nodes: **product data**, **competitors**, **review mining**, **category data**.
Their job is to put material in a box. Not to read it, not to weigh it, not to notice
patterns in it.

`spec.md` §3 names the failure directly: *"Concluding while collecting is the single
most common failure."* Everything in this document exists to make that failure hard
rather than merely discouraged.

### 1.1 The one rule, made structural

> **The stage-1 packet has no field a judgement could be written into.**

There is no `claim`, no `finding`, no `summary`, no `insight`. A validator rejects
the packet if one appears. An agent that wants to conclude something in stage 1 has
nowhere to put it, which is a stronger guarantee than a prompt saying "don't".

Three things are *not* judgements and are allowed:

| Allowed | Why it isn't a judgement |
|---|---|
| **Excerpt** — a verbatim span copied from a source | Transcription, not interpretation |
| **Measurement** — a number stated by a source, with its unit and period | "1.9M searches/mo (Ahrefs, 2026-08)" is copied; "the category is growing" is not |
| **Attribute** — a field lifted off a page (dose, price, format, first-seen date) | Same: read off, not worked out |

The line is: *if a second person with the same source would write down a different
value, it is a judgement and does not belong in stage 1.*

**The one honest exception** is `theme` (§5). It is a clustering label over excerpts,
needed because the done-criterion is saturation and saturation is measured in themes.
It is marked as a working index, it may never be restated as a finding, and stage 2
may re-cluster the same excerpts differently without that being a contradiction.
This is the weakest joint in the design and it is written down rather than hidden.

---

## 2. The four nodes and when each is done

Done is **saturation**, never a count (`spec.md` §3, §6.3-D). Concretely for every
node: *done when three consecutive admitted sources produce no new theme, and the
node's mandatory attributes are either captured or gapped.*

Three is a threshold pulled from nowhere — it is a starting value to be tuned against
the logged saturation curve, not a finding. §9 says how we'll know if it's wrong.

### 2.1 product data

Mandatory attributes, each captured or gapped with a reason:

`name · brand · form · active_ingredients[] · full_ingredient_panel (verbatim, actives
and inactives) · servings_per_container · price · subscription_terms ·
claims_made_on_own_site (verbatim) · coa_present`

Each entry in `active_ingredients[]` carries `name_as_printed · name_normalised ·
dose · unit · per (serving | capsule | ml) · standardisation` — the last for extracts
that state a concentration ("10:1", "95% curcuminoids"). `name_as_printed` is
transcription; `name_normalised` is lowercase, trimmed, one accepted synonym mapping
(`vitamin B3` → `niacin`). Anything requiring a judgement about equivalence is a gap,
not a guess.

**Why actives are split out from the panel, rather than living inside it.** They are
the join key for two other nodes: §2.2 defines a competitor by shared active
ingredient, and §2.4 measures search volume *for the active ingredient*, not for the
brand. A panel captured only as one verbatim blob cannot be joined on, so both
downstream nodes silently narrow to brand-name research. The verbatim panel is
captured as well — it is the audit trail, and inactives matter for formulation
claims.

Where the panel lives, in descending order of trust: the product's own label image or
supplement-facts panel, the brand's own page, the marketplace listing, a retailer
listing. Below that it is a gap. A panel transcribed from a third-party article is
**not** admissible as the panel; it may be captured as a `reference` source and must
be gapped as unverified.

Saturation does not apply — this node is a finite checklist. It completes when every
attribute has a value or a gap. **A missing COA is a gap, not a zero.**

### 2.2 competitors

Two classes, and the distinction is mechanical rather than a judgement:

| Class | Test |
|---|---|
| **Direct** | same active ingredient **and** same form |
| **Indirect** | same active ingredient, **different** form — the same problem solved in another format |

Both classes are researched to the same depth. Indirect competitors are not a
footnote: a magnesium spray and a magnesium gummy compete for the same buyer as a
capsule, and §2.4's search volume is measured over the ingredient, so the ingredient's
market is the one being sized.

The test is mechanical on purpose. It reads two attributes already captured in §2.1
(`active_ingredients[].name_normalised`, `form`) and compares them, so a second person
with the same two products classifies them identically — which is what keeps it inside
stage 1's rule. **A brand that shares the problem but not the ingredient is neither**:
capture it as a source if it is useful, and gap it as "same problem, different active"
rather than inventing a third class here. Deciding whether a different molecule is a
substitute is a stage-2 judgement.

Per competitor: `name · url · relation ∈ {direct, indirect} · active_ingredients[] ·
form · dose_per_serving · positioning_copy (verbatim) · price · price_per_dose ·
ad_library_entries`.

Each ad-library entry **must carry `first_seen`**. `spec.md` §7 is blunt about why:
longevity is the only outside performance signal there is. An ad with no first-seen
date is captured, marked `first_seen: null`, and **counted as a gap** — not silently
dropped, because a competitor whose ad dates we couldn't get is a hole in the
sophistication read that stage 3 depends on.

Saturation applies to competitor *discovery*, **per class**: three consecutive
searches surfacing no new direct brand, and three surfacing no new indirect one. One
combined counter lets a rich direct set satisfy the criterion while the indirect
search has barely started, which is the failure this splits to avoid.

### 2.3 review mining

The densest node and the one most likely to be faked, so it has the most structure.

Per excerpt: `text (verbatim) · star_rating · date · source_id · locator ·
axis ∈ {why_bought, why_stayed, why_quit}`.

**Locator for a review from the review tools: `{"kind": "url", "url": "<permalink>"}`.**
A review pulled through Apify has no character offsets in a fetched page, and its
permalink points at exactly that review, which makes it a better locator than a
range. `url` was added to the locator kinds (`char_range`, `url`, `selector`,
`note`) on 2026-09-20. Before that, the tools printed the permalink as a bare
`locator: https://…` and the contract had no kind to hold it. A Mayaverra
review-mining run invented `{"kind": "url", "value": …}` on all 19 excerpts and
was rejected on those alone. The tools now print the locator as the JSON to copy.
When the actor gives only a review id, it is `{"kind": "note", "note": "review id …"}`.

**Volume and spread, per product researched:** at least **10 marketplace reviews**,
covering 1★ through 5★ with 3★ mandatory (below), plus whatever forum material exists
(Reddit and niche boards). Ten is a floor for *coverage*, not a done-criterion —
saturation still decides when to stop, and a node that hits ten without saturating
keeps going. A node that cannot reach ten is **incomplete with a gap naming the wall
it hit**, never complete-with-fewer.

Rules:

- **A review is first-hand or it is not a review.** The excerpt must be the customer's
  own words, taken from the page where that customer posted them. A reviewer's summary
  of other reviews ("multiple customers have flagged…"), a YouTube description, and a
  roundup article's paraphrase are all *somebody else's stage 3*. They may be captured
  as `reference` or rejected as `review_roundup`, and they may never become a
  `review_mining` excerpt. §2.5 records the run where exactly this happened.
- **A wall is not a page.** A bot check, a cookie interstitial or a login page that
  fetches successfully is an absence, not a source — see §2.5.
- **Verbatim is immutable.** Stored exactly as it appears, including typos. `spec.md`
  §6.2-6 — the moment "I wake up at 3am and can't get back to sleep" becomes "sleep
  maintenance issues", it is gone and cannot be recovered. Enforced in §4: excerpt
  text is content-hashed and the store rejects an update.
- **3★ is mandatory coverage.** A review-mining node with no 3★ excerpts fails its
  done-criterion regardless of saturation. This is the demo's "weight 3★" judgement
  promoted from a manual correction to a default, because it is right every time.
- Three-axis coding is a **label on an excerpt**, not a new sentence. The axis says
  which question the customer was answering, not what the answer means.

### 2.4 category data

Measurements only, each carrying `metric · value · unit · period · source_id`. Three
questions, in the order they are worth answering:

| Question | Metric | Notes |
|---|---|---|
| How big is the market? | `tam` / `category_size` | currency and geography mandatory; a figure without a stated market is a gap |
| How many people want this? | `search_volume` **for each active ingredient**, not the brand | trend over **≥3 years**, monthly. A point estimate where a trend was needed is a gap (`spec.md` §7) |
| Is anyone actually buying? | `amazon_sales` / `units_sold` / `bsr` | traction, measured on the marketplace rather than claimed by a report |

**Search volume is measured on the active ingredient** (§2.1) and, where they differ,
on the problem phrase a buyer would type. Brand volume measures the brand's marketing
spend to date, which is a different question and belongs to the competitor node.

**Amazon sales are the traction reading.** A market-size report is somebody's model;
units moving on a marketplace this month are an observation. Capture what the page
states — best-seller rank, "N bought in past month", review counts as a lower bound on
sales — and record the observation date, because all three move. An estimate produced
by a third-party sales-estimation tool is admissible as a `reference` measurement with
its tool named in the source, never as an Amazon figure.

TAM built by multiplying two numbers from different sources is a **calculation, not a
measurement**, and stage 1 does not do it. Capture both inputs, gap the product. Stage
2 may multiply them where it can show its working.

---

## 2.5 What the two tools can actually reach — measured 2026-09-16

§10 says stage 1 assumes "whatever SearXNG can find and Firecrawl can read". That
sentence was never tested against the sources §2.3 and §2.4 need. It has been now,
live, from the VPS container:

| Target | Result | Consequence |
|---|---|---|
| SearXNG search | **works** — ~40 results/query from Google CSE and Brave | finding pages is not the problem |
| DuckDuckGo, Wikidata engines | CAPTCHA / HTTP error on every query | harmless; the other two carry it |
| Amazon product page (`/dp/…`), default fetch | 138k chars, star aggregates, **no review text** | the default fetch trims the reviews away — see §2.5.2 |
| Amazon product page, `onlyMainContent: false` + `waitFor: 4000` | **10–17 real reviews** with star, title, date, "Verified Purchase" | the ten-review floor is reachable free, with caveats |
| Amazon `/product-reviews/…` | **blocked**: 3.1k chars of page furniture, no reviews | the ≥10-review floor is currently unreachable |
| Reddit, via Firecrawl | **refused by Firecrawl itself**: *"we do not support this site"* | no forum material at all |
| Reddit JSON, direct from the container | **403** | the VPS IP is blocked too; it is not a Firecrawl-only limit |
| Trustpilot, via Firecrawl | **bot wall**, 170 chars: *"Verifying your connection…"* | and it arrives as `success: true` — see below |
| Trustpilot, direct from the container, full browser headers | **403 from CloudFront on every path, homepage included** (991 bytes) | an address-reputation block, not a scraping-difficulty one — see §2.5.3 |
| YouTube watch page | title and description only, **not comments** | `video_comments` sources have contained no comments |

**The failure mode this exposes is worse than the blocks themselves.** A wall fetches
*successfully*: Firecrawl returns 200 with a short body, `web_fetch` archives it, and
the agent receives a page. Nothing in the pipeline distinguishes 170 characters of
"Verifying your connection" from a real page, so it became a cited
`review_platform` source in run `yoracare` (2026-09-12). The agent, having no reviews,
then filled `review_mining` from what it *could* read: YouTube descriptions and
roundup prose. That run's 7 review excerpts contain 1 star rating and lines like
*"Multiple customers have flagged that it's actually manufactured in China"* — a
stranger's conclusion, stored as raw material, which is precisely the failure §1 exists
to prevent.

**So the honest current state of the four nodes:**

| Node | Reachable today |
|---|---|
| product data | yes — brand site, marketplace listing, retailer pages |
| competitors | partly — sites and listings yes; ad libraries untested here |
| review mining | **thin** — Amazon's own sample of 10–17 reviews, once fetched properly (§2.5.2); no forums, no review platforms, no control over star spread |
| category data | partly — published reports and keyword pages yes; Amazon traction figures come off pages that fetch, but BSR placement varies |

### 2.5.2 Amazon reviews are reachable after all — measured 2026-09-16

> **SUPERSEDED 2026-09-17 by `spec-review-mining.md` §3 — re-measured from the VPS
> and the conclusion no longer holds.** Four corrections:
>
> (a) **"Amazon reviews are reachable" is no longer true from production.** Five
> consecutive `curl --compressed` fetches from the VPS returned Amazon's bot page
> — *at HTTP 200, 3,781 bytes* — and headless Chrome from the VPS got the same.
> The block is keyed to the **address**, so no fetch tuning reaches it.
> (b) **The Firecrawl path this section recommends has degraded.** Re-run one day
> later with the exact settings below, `amazon.com/dp/B000BD0RT0` returned **0
> reviews** across two `waitFor` values and both proxy modes, where this section
> measured 17. The best result on any ASIN was 8 — below §2.3's floor of ten.
> (c) **"Renders after first paint" was the wrong mechanism.** Reviews are
> server-rendered and present in the first response body; a plain `curl` from a
> residential address returns 13 complete reviews with no browser and no `waitFor`.
> Firecrawl's `onlyMainContent: true` was trimming them. Point 4's `waitFor`
> non-determinism is therefore a Firecrawl artifact, not an Amazon one.
> (d) Point 3's login wall is **confirmed** from a second, unrelated address:
> `/product-reviews/` 302s to `/ap/signin` regardless of origin.
>
> Also new and not recorded here: `?filterByStar=` on `/dp/` is silently broken in
> **both** directions — `three_star` returns zero reviews, `one_star` returns the
> *unfiltered* sample. See `spec-review-mining.md` §3.4 before ever using it.

The first pass concluded Amazon carried no review text. That was an artifact of
**how** it was fetched, not of the page. `web_fetch` sends
`onlyMainContent: true` and no wait; Amazon renders its reviews after first
paint, so the trimmed, un-waited fetch returns the listing without them.

Fetched with `onlyMainContent: false` and `waitFor: 4000`:

| Product | Reviews | Star spread |
|---|---|---|
| `amazon.com` B000BD0RT0 (magnesium glycinate) | 17 | 3★×2, 4★×1, 5★×14 |
| `amazon.co.uk` B0GZVQMXX4 (yoracare bar) | 10 | 1★×2, 4★×2, 5★×6 |

Each carries a title, a star rating, a posted date, a country and a "Verified
Purchase" marker — first-hand customer text of the kind §2.3 requires.

**Three limits, and they are the reason this is a floor rather than a solution:**

1. **The sample is Amazon's, not ours.** These are the reviews the product page
   chooses to show. Both samples skew to 5★ (14 of 17; 6 of 10).
2. **Star coverage is luck.** §2.3 makes 3★ mandatory. One product had two 3★
   reviews; the other had none. A run on the second product cannot complete its
   review node honestly, and the correct behaviour is to say so.
3. **The star-filtered pages want a login, not a better fetch.** Retested
   2026-09-16 with the same untrimmed, waited settings that unlocked the product
   page: `/product-reviews/…`, its page 2, and `?filterByStar=three_star` all return
   **Amazon's "Sign in or create account" page**, identically (3,508 chars, zero
   reviews). It is an authentication wall, so no amount of fetch tuning reaches it —
   which retires the experiment as originally framed. What remains is a *signed-in
   browser session*, and that is a terms-of-use decision rather than a technical one:
   automated collection under an account risks that account. §13.2 timeboxes it.

4. **The fetch is not deterministic.** The same URL with `waitFor: 10000` instead of
   `4000` returned **0 reviews** and a 25% smaller body, minutes after returning 17.
   A reader that does not assert "reviews > 0, else retry" will silently collect
   nothing and the run will look merely disappointing.

5. **Amazon captchas this server directly.** A plain fetch from the container gets
   "Enter the characters you see" — so the working path today runs through Firecrawl's
   addresses, not ours, the mirror image of §2.5.3's Trustpilot problem.

So the honest position: the product page yields a usable ten-ish first-hand
reviews per product for free, `review_mining` stops being empty, and a paid
supplier buys *choice over the sample* — which is what 3★ coverage and star
spread actually need.

### 2.5.3 Trustpilot is an IP block, not a paywall — measured 2026-09-16

> **SUPERSEDED 2026-09-17 by `spec-review-mining.md` §2. The measurements below are
> correct; the diagnosis and the remedy are both wrong.** The same 403 with the same
> 991-byte body was reproduced from a *residential* address, so address reputation
> is not the cause. Those 991 bytes are an **AWS WAF JavaScript challenge**
> (`awswaf.com/challenge.js`), served to any client that does not run JS, from any
> network. The remedy proposed here — "a proxy or any non-data-centre network path"
> — buys nothing.
>
> **Trustpilot is solved, from the VPS, for free.** One `docker run` of
> `zenika/alpine-chrome --dump-dom` clears the challenge unattended and returns 20
> reviews as structured JSON in `__NEXT_DATA__`, in ~9s. `?stars=3` returns 20 3★
> reviews and composes with `?page=N`, so **§2.3's mandatory-3★ rule stops being a
> matter of luck** — which was the constraint failing this node.
>
> The reasoning error worth keeping: this section varied headers and address — the
> two things that do not matter here — and never varied *whether JavaScript ran*. A
> domain-wide 403 is equally consistent with a domain-wide challenge.

Prompted by a community Trustpilot scraper that works fine for its users, both
paths were tested from the VPS:

| Attempt | Result |
|---|---|
| Firecrawl scrape | 200, 170 chars, "Verifying your connection…" |
| Direct fetch, minimal headers | 403, 991 bytes |
| Direct fetch, full Chrome header set (UA, `sec-ch-ua`, `Sec-Fetch-*`, `Accept-Language`) | 403, 991 bytes |
| Direct fetch of `trustpilot.com/` — the **homepage** | 403, 991 bytes, `server: CloudFront` |

The homepage failing with a complete browser header set rules out fingerprinting
as the cause: the block is on the requesting address, applied at CloudFront, and
it covers the whole domain. Hetzner ranges are data-centre ranges, and Trustpilot
refuses them wholesale.

**So this is a routing problem, not a data problem.** Any path with a
non-data-centre address reads Trustpilot normally: a proxy, a home connection, a
laptop running the step. The parser itself is unremarkable — the review text is in
the served HTML. Budget the work as *a reader plus a route*, and note the same
question is likely to apply to Reddit, which also 403s the container directly.

### 2.5.1 What would fix it, and what each costs

> **PARTLY SUPERSEDED 2026-09-17 by `spec-review-mining.md` §4 and §7.** The Reddit
> bullet below — "the obvious first build" — no longer holds. Reddit closed
> self-service app registration in late 2025; every token now needs manual approval,
> and the free tier is reportedly non-commercial only, which a marketing research
> agent is not. Reddit also carries **no star ratings**, so it can never satisfy
> §2.3's mandatory-3★ rule. It is now recommended **last**, not first.
>
> The Trustpilot bullet is also wrong, and in the costly direction: "a proxy or any
> non-data-centre network path fixes it" would have bought proxies that change
> nothing. Trustpilot is now **first**, and free — see §2.5.3's superseded note.
> The Amazon bullet's conclusion ("no free, permitted route exists") has survived
> and hardened: from the VPS there is no working route at all, paid or free, that
> we currently possess.

None of these is implemented; none has been tested beyond the table above.

- **Reddit's official API.** Free tier, OAuth app credentials, 100 queries/minute,
  and it returns comment trees as JSON. This is the only one of the four that is a
  documented, permitted route rather than a workaround, and it is the obvious first
  build. It needs a third tool (`reddit_search`/`reddit_thread`) or a fetch path that
  recognises reddit URLs.
- **Amazon reviews.** No free, permitted route exists. The options are a paid
  scraping API that specialises in Amazon and handles the blocking itself, or a
  residential-proxy/stealth mode on the fetch layer. Both cost money per page; the
  first is likelier to keep working. Amazon's own Product Advertising API returns
  listings, not review text, so it does not solve this.
- **Trustpilot.** *Not* the same shape as Amazon — see §2.5.3. The page itself is
  ordinary server-rendered HTML that community scrapers parse without difficulty; what
  fails is our address. A proxy or any non-data-centre network path fixes it.
  (Both halves of that diagnosis are wrong — see §2.5.3's superseded note. Stage 0,
  which bought a Trustpilot *rating* per shop separately, was removed from the app
  on 2026-09-18, so review text is now the only thing at stake.)
- **YouTube comments.** The Data API v3 returns `commentThreads` on a free quota. A
  genuine source of customer language, and the cheapest after Reddit.

> **SUPERSEDED 2026-09-17.** `review_mining` *can* complete: Trustpilot runs from
> the VPS, free, with deliberate 3★ coverage (`?stars=3`), which removes the
> dependency on Amazon's sample happening to include 3★. See
> `spec-review-mining.md` §2 and §7. The paragraph below describes the state before
> that route existed; the gap-not-excerpts behaviour it prescribes is still right
> and still unenforced.

**Until the fetch fix in §2.5.2 lands, `review_mining` cannot complete at all**, and
even after it the node completes only when Amazon's sample happens to include 3★. The
correct behaviour in both cases is a node marked `incomplete` with a gap naming what
was missing — not excerpts sourced from whatever happened to be fetchable. That behaviour is not yet enforced;
§4.1's proposed rules 7–9 are what would enforce it.

---

## 3. Corpus admission — a stage-1 responsibility

`spec.md` §6.2-4 is the reason this section exists: when membership in the corpus is
the only gate, the cheapest way to pass it is to widen the corpus. So what may enter
is controlled *here*, at the only stage that adds to it.

Every source carries `kind`, `admitted`, and `admission_reason`. **Rejected sources
stay in the packet.** They are what the cockpit renders as `SKIPPED`, and deleting
them would hide the shape of what was searched.

| `kind` | Default | Note |
|---|---|---|
| `first_party` | admit | brand's own site, label, COA. Mark `marketing: true` if promotional |
| `coa` | admit | strongest evidence class in this category |
| `marketplace_review` | admit | Amazon, own store |
| `review_platform` | admit | Trustpilot and similar |
| `forum` | admit | Reddit, niche boards |
| `video_comments` | admit | YouTube, TikTok comments |
| `ad_library` | admit | `first_seen` required or gapped |
| `trial` | admit | needs dose, form and population — not the abstract |
| `reference` | admit | Examine and similar secondary compendia |
| `keyword_data` | admit | search-volume tooling |
| `competitor_marketing` | admit + `marketing: true` | evidence of what they *claim*, never of what is true |
| `seo_listicle` | **reject** | marketing dressed as review data |
| `review_roundup` | **reject** | same |
| `ai_generated` | **reject** | when detectable; a gap entry when suspected but unproven |

Rejection defaults are **configuration, not code** — a run's `admission_policy`
overrides them, and a standing judgement (§7) writes to that policy. The demo's
headline interaction ("reject SEO listicles" and later fetches visibly skip) is this
mechanism, with the rule pre-loaded instead of typed.

`marketing: true` is not a rejection. It is a weakening flag that stage 2 and the
entailment checker read: a claim resting only on marketing sources is visibly weaker
than one resting on a COA, and that has to be visible rather than argued.

---

## 4. The run contract for stage 1

One packet per run per stage. This is `cockpit-spec.md` §1's "the agent must emit the
schema, as JSON, not markdown" made concrete for stage 1.

```jsonc
{
  "contract_version": "1",
  "stage": 1,
  "run_id": "…",                     // echoed back; the service is the authority
  "brief": { "product": "…", "url": "…", "market": "UK" },

  "sources": [{
    "id": "sha256:…",                // over normalised captured text — the corpus key
    "url": "https://…",
    "title": "…",
    "kind": "forum",                 // §3 enum
    "publisher": "reddit.com",
    "fetched_at": "2026-09-10T09:14:22Z",
    "first_seen": null,              // ad_library only; null is a gap, not a zero
    "marketing": false,
    "admitted": true,
    "admission_reason": "forum — admitted by default policy",
    "archived": true,                // raw body written to the corpus volume (§6)
    "node": "review_mining"
  }],

  "excerpts": [{
    "id": "sha256:…",
    "source_id": "sha256:…",
    "text": "I wake up at 3am and can't get back to sleep. Every single night.",
    "locator": { "kind": "char_range", "start": 4120, "end": 4187 },
    "captured_at": "2026-09-10T09:14:25Z",
    "node": "review_mining",
    "star_rating": 3,                // review nodes only
    "posted_at": "2026-04-02",
    "axis": "why_quit",              // review nodes only
    "themes": ["3am waking"]
  }],

  "measurements": [{
    "id": "…", "node": "category_data",
    "metric": "search_volume", "value": 1900000, "unit": "searches/month",
    "period": "2026-08", "source_id": "sha256:…", "locator": {…}
  }],

  "attributes": [{
    "id": "…", "node": "product_data",
    "key": "dose_per_serving", "value": "400 mg",
    "source_id": "sha256:…", "locator": {…}
  }],

  "saturation": [{
    "node": "review_mining",
    "curve": [ { "source_id": "sha256:…", "new_themes": 4, "cumulative_themes": 4 },
               { "source_id": "sha256:…", "new_themes": 0, "cumulative_themes": 11 } ],
    "stopped_because": "three consecutive sources added no new theme"
  }],

  "nodes": [{
    "node": "product_data",
    "status": "complete",            // complete | incomplete
    "done_criterion_met": true,
    "why": "10 of 10 mandatory attributes captured; COA gapped"
  }],

  "gaps": [{
    "node": "competitors",
    "missing": "CalmWell ad library returns no UK creative",
    "would_need": "a UK-IP ad-library pull, or a manual capture",
    "blocking": false
  }]
}
```

`brief.url` stays in the contract but the UI never collects it *as a separate
field*: the operator's brief is a product and a market, and finding the URLs —
own site, reviews, competitors, ad libraries — is the agent's job, via SearXNG
(find) and Firecrawl (fetch). When it is empty the prompt says so explicitly, or
a careful agent stalls asking for one.

**Revised 2026-09-21: a url is a brief in its own right, and it lives in
`brief.url`.** Operators paste a store URL into the product box, so
`normaliseBrief()` moves it: `product` keeps names only, `url` keeps the site,
and `product` may now be empty on the way in. The prompt for a site brief drops
the `**Product:**` line entirely and says the first job is to fetch the site and
set `brief.product` to *the product's own name as the site writes it*.

The failure that forced this: brief `https://thedropletco.co.uk/` printed as
"**Product:** https://thedropletco.co.uk/" directly above "No product URL was
supplied — finding it is part of the job". The agent spent a turn reconciling the
two, wondered whether the example's MagnaCalm was the real brief, and finally
wrote `brief.product` as "Droplet (The Droplet Co) — luxury reed diffuser home
fragrance". The §4.1 brief check then rejected the packet, because a domain holds
no spaces and `thedropletco` is not a substring of "the droplet co". Three
changes came out of it: the brief is normalised, the prompt for a site brief asks
for the name, and the check compares on letters and digits only — plus it accepts
outright when the packet's `brief.url` names the same host, which is the exact
signal and was present all along.

### 4.1 Validation, which is where the rule is enforced

The packet is rejected — the run marked `invalid`, not `completed` — when:

1. Any object carries a key outside the schema. **This is what makes §1.1 real**: an
   agent that writes `"finding": "…"` gets a hard failure, not a warning. Strict
   rejection over silent stripping, because stripping teaches nothing.
2. An excerpt's `source_id` does not resolve to a source in the packet.
3. An admitted `ad_library` source has `first_seen: null` and no matching gap.
4. The `review_mining` node is `complete` with zero 3★ excerpts.
5. **`gaps` is empty.** `spec.md` §4.3: *if the gap list is empty, treat the run as
   failed*. Real research always has holes; a run claiming none is a run that stopped
   looking.
6. A node is `complete` with an empty saturation curve and no finite checklist.

Rule 1 is the load-bearing one and also the most likely to be annoying in practice.
It stays strict until a real run shows it rejecting something legitimate, and if that
happens the fix is to widen the schema deliberately — not to loosen the validator.

### 4.2 Proposed rules 7–9 — not built, and each has a measured cause

Rules 1–6 catch an agent that writes the wrong *shape*. The yoracare run (§2.5) was
schema-valid and still produced paraphrase attributed to customers, so these three
close what it walked through. They are mechanical checks over data the service already
holds; none needs the model's cooperation.

7. **An excerpt's text must occur verbatim in its source's archived body.** The
   service has the bytes and the claimed span, so this is a substring check, not a
   judgement. It is the single strongest guarantee available here: it makes quote drift
   and invented quotes into hard failures instead of §9.3's manual spot-check of five.
   Whitespace normalised on both sides before comparing, and nothing else.
8. **A source whose archived body is below a floor, or matches a wall signature, is
   not admissible.** Measured signatures: "Verifying your connection", "Enable
   JavaScript and cookies to continue", a body under ~1,000 characters from a domain
   known to paginate reviews. Such a fetch becomes a gap naming the domain and the
   wall — the outcome "we could not read Trustpilot" is useful; a 170-character
   Trustpilot "source" is not.
9. **`review_mining` excerpts may only cite sources of kind `marketplace_review`,
   `review_platform`, `forum` or `video_comments`.** In the measured run they cited
   YouTube descriptions and roundup text. A `reference` source can inform the brief; it
   cannot supply a customer's words.

Rule 7 also changes what §9's hand-check is for: with it, the manual pass stops
verifying transcription and starts verifying *selection* — whether the excerpts chosen
are representative — which is the part a machine cannot do.

### 4.3 Schema deltas these nodes need

`schema.ts` today has no field for the things §2.1–§2.4 now require. Recording them
here so the next implementation change is a list rather than an inference:

| Where | Add |
|---|---|
| `attributes` | nothing structural — actives are attribute rows keyed `active_ingredient.<n>.name_as_printed` / `.name_normalised` / `.dose` / `.unit` / `.per` / `.standardisation` |
| competitor rows | `relation ∈ {direct, indirect}`, `form`, `active_ingredients[]`, `price_per_dose` |
| `measurements` | nothing structural; `metric` gains the vocabulary in §2.4 (`tam`, `category_size`, `search_volume`, `amazon_sales`, `units_sold`, `bsr`) and `period` becomes mandatory for all of them |
| `nodes` | a `coverage` block for review mining: `{ reviews_captured, stars_covered[] }`, so "ten reviews across the star range" is checkable rather than asserted |

Competitor rows are the only genuinely new shape. Everything else is vocabulary over
the existing `attributes`/`measurements` tables, which is deliberate: a flat key-value
row that a person can read is harder to smuggle a judgement into than a nested object
with a free-text field.

---

## 5. Themes

`theme` is a short label attached to excerpts, created by the agent, scoped to one
node and one run. It exists for one reason: the done-criterion is "new sources stop
producing new themes", so without themes there is no measurable done.

Constraints that keep it from becoming a finding:

- A theme has **no description field** — only a label and the excerpts under it.
- Themes do not appear in any stage-1 output the strategist reads. They appear in the
  saturation curve and the cockpit's evidence view, both of which are audit surfaces.
- Stage 2+ may re-cluster freely. A theme is not a commitment.

---

## 6. How the packet gets out of the agent

Two channels, because the two payloads have opposite shapes. Both constraints below
were checked against the running system, not assumed.

**Packet → the run's final output.** The agent's assistant text, accumulated across
every turn of the run. The packet is small, structured and control-plane-ish, so it
rides the channel that is guaranteed to be there. The service extracts the last
fenced ```json block from that text and validates it.

> **Superseded (2026-09-11):** this used to read hermes's runs API — `message.delta`
> and a `run.completed` carrying `output`. The harness is now in-process, so the
> channel is `Agent.subscribe()`'s `message_end` events rather than an HTTP stream.
> The *shape* of the contract is unchanged, deliberately: the packet is still the
> last fenced JSON block in what the model wrote, and `packet.ts` did not change when
> the engine did. One trap moved rather than disappearing — the agent re-emits the
> **whole** assistant message on each `message_update`, so a naive "append every
> delta" accumulates the output N times over. `runner.ts` tracks the text per message
> and emits only the growth.

**Raw bodies → a corpus directory.** Bodies are large and must be stored as the
fetched artifact rather than a summary (`spec.md` §7). Every `web_fetch` writes the
body it retrieved to `/corpus/runs/<run_id>/sources/<sha256>` and returns the id to
cite; the service serves them back for audit.

> **Superseded (2026-09-11):** the agent used to write these files itself, with the
> shell tool, and set `archived: true` to say it had. That put a mechanical step on
> the model's to-do list, and a model that skips it emits a packet claiming an
> archive that does not exist — an audit trail that lies. Archiving now happens
> inside the tool, before the agent sees the text, and the `sha256:` id it hands back
> is the hash of the **exact bytes written**. That is what makes
> `GET /api/research/runs/:id/sources/:sha` able to re-hash the file and report
> `X-Corpus-Digest-Matches`; an id computed over any normalised form of the text
> would make that check a permanent false negative.

### 6.1 Why not the obvious alternatives

- **Not a callback into the service.** SEC-001 (setup.md) deliberately removed the
  agent sandbox's route back to the gateway. Giving the research agent — the one
  agent whose whole input is untrusted web content — a fresh write path into the
  app's database would undo the fix that was just made.
- **Not the sandbox's own persistence.** hermes's docker terminal backend does
  bind-mount `/workspace` to `~/.hermes/sandboxes/docker/<task_id>/workspace`
  (`tools/environments/docker.py`, `container_persistent` defaults true), so files
  *do* survive. But the path is keyed by task id, which the service does not control
  or reliably know. An explicit named volume is the same mechanism with a stable address.
- **Not parsing prose.** `cockpit-spec.md` §1: *"If the researcher returns prose, you
  have built a prose viewer with tabs."*

### 6.2 The infrastructure this needs

**Set on the VPS on 2026-09-10**, not aspirational:

A named Docker volume — no host path, no permissions to get wrong, identical
locally and on the VPS:

```yaml
# docker-compose.yaml
mra:
  volumes: [mra_data:/data, corpus:/corpus]               # writes and reads
```

> **Superseded (2026-09-11):** this was two containers, with `mra` mounting
> `corpus:/corpus:ro` because hermes owned the writes. One process owns both now, so
> the mount is read-write. The property that made read-only worth having is kept
> explicitly rather than by accident — see note 1.

Two notes:

1. Nothing under `/corpus` may ever be executed or read as instruction. The only
   writer is `web_fetch`, which writes a body and nothing else; the only reader is a
   route that serves it as `text/plain` under `Content-Security-Policy: default-src
   'none'` with `X-Content-Type-Options: nosniff`. The read-only mount used to be one
   of the things enforcing that. Now the two ends of the path are.
2. If the volume is absent, sources are emitted with `archived: false` and each one
   generates a gap. **The run still completes.** Degrading honestly beats blocking,
   and the gap list is exactly where "we did not keep the evidence" belongs. The tool
   catches the write failure and reports it in its own result, so the agent is told
   rather than left to infer it.

---

## 7. Standing judgements

The demo's step-in loop, made real. A judgement is a persistent rule the human gives
once and the agent applies for the rest of the run *and every future run*.

```
judgement: id · kind · text · created_at · active · applied_count
kind ∈ { source_rule, weighting, avatar_rule, language_rule, custom }
```

Two application paths, and the difference matters:

- **At run start** — active judgements are rendered into the run's instructions, and
  `source_rule` judgements additionally mutate the run's `admission_policy` so
  rejection is mechanical rather than a matter of the model remembering.
- **Mid-run** — `POST /v1/runs/{id}/steer` injects the correction without restarting.
  The run's `applied_count` is incremented by the service when a source is rejected
  under that policy, so "applied 4 times" is a count of real events rather than a
  claim.

Stage 1's judgements are overwhelmingly `source_rule`, which is why admission policy
is a first-class run field rather than a prompt paragraph.

---

## 8. Surfaces

### 8.1 Its own service, not a tab

`cockpit-spec.md` §6 originally put this in agentchat as a second tab. That is
**superseded** — the reasoning is recorded there, and the short version is that
the researcher's whole input is fetched from the open web, so it gets its own
process, its own database and its own login.

> **Superseded (2026-09-11):** "and its own hermes gateway". The harness is now
> embedded in this process, so there is no second gateway. The isolation argument is
> unchanged and is met by narrowing instead: the agent has exactly two tools, both
> read-only against the web, and no shell. See §8.2.

```
marketing-research-agent/
  server/src/
    settings.ts    every env var, MRA_-prefixed
    schema.ts      the contract in §4 as zod objects, .strict()
    packet.ts      extract the fenced JSON from run output, validate, say why not
    prompt.ts      brief + admission policy + judgements -> stage-1 instructions
    tools.ts       web_search (SearXNG) + web_fetch (Firecrawl, auto-archiving)
    store.ts       ResearchStore interface + SqliteResearchStore
    runner.ts      RunSupervisor — one pi Agent per run, owns its event stream
    api.ts         /api/research/*
    app.ts         auth + routes + the built SPA
    main.ts        process entry: recover, then serve
  frontend/src/
    App.tsx        the header-bar shell: subject chip, run clock, step-in, start
    StartRun.tsx   the brief as a modal — product + market, no URL field
    RunView.tsx    the three demo columns: rail, now/lanes/trace, findings
    StageRail.tsx  five stages + the gate; stage 1 live, its four nodes, curves
    StepIn.tsx     standing judgements
  docker-compose.yaml   the whole stack, one file: cockpit (harness inside)
                         and search (SearXNG); page-fetching is Firecrawl's
                         cloud API, called directly — `docker compose up`
  searxng/settings.yml   JSON output is off by default upstream; this turns
                         it on, which is the one override SearXNG needs
  deploy/
    Caddyfile.snippet   marketing.vanis.ai (was research.vanis.ai — renamed at deploy)
    vps/                production compose, deploy.sh, change-password.sh,
                         mra-snapshot.sh — see ../setup.md §5a
```

| Endpoint | Does |
|---|---|
| `GET /api/research/runs` | list |
| `POST /api/research/runs` | start a stage-1 run from a brief |
| `GET /api/research/runs/{id}` | run + packet + counts + usage |
| `GET /api/research/runs/{id}/events` | SSE, live; replays persisted events on reconnect |
| `POST /api/research/runs/{id}/steer` | inject a correction |
| `POST /api/research/runs/{id}/stop` | cancel |
| `GET /api/research/judgements` · `POST` · `DELETE /{id}` | standing rules |
| `GET /api/research/runs/{id}/sources/{sha}` | raw body from the corpus volume |
| `GET /api/research/config` | model, corpus path, and whether it is mounted |

**The service persists every event as it arrives.** `Agent.subscribe()` is an
in-memory, in-process callback: a listener that is not attached when an event fires
never sees it, and there is no replay. So the supervisor subscribes for the life of
the run and writes every event to SQLite before fanning it out; the browser reads
the service's replayable stream. Getting this backwards gives you a cockpit that
loses the run when you refresh the page. (Under hermes the same rule held for a
different reason — its SSE queue was single-consumer, so a second tab *split* the
stream rather than missing it. Same conclusion, and it is why `api.ts` subscribes
before it replays.)

**A run does not survive a restart.** `RunSupervisor.recover()` runs at startup and
marks anything left non-terminal as `failed`, saying so.

> **Superseded (2026-09-11):** this section previously read "**A run survives a
> restart**" and reconciled non-terminal runs against `GET /v1/runs/{id}`. That was
> true when the run executed inside a separate, longer-lived hermes container. The
> agent now lives in this process and dies with it, so there is nothing upstream to
> ask. Recording the death is the only honest option; inventing an outcome, or
> leaving the row on `running` forever, are both worse. The operational consequence
> is real and belongs in the README: **rebuild between runs, not during one.**

### 8.2 One harness, and a much smaller one

**Superseded (2026-09-11).** This section used to contrast agentchat's hermes with
the researcher's own second hermes instance. There is no second instance now — and
no hermes here at all.

| | agentchat | the researcher |
|---|---|---|
| Engine | hermes gateway, over HTTP | `pi-agent-core`, in-process |
| Runs as | systemd user unit on the host | a container in this stack |
| Model access | gateway's default route | a named OpenRouter model, always |
| Memory across runs | long-term, keyed `agentchat` | none — each run starts clean |
| Tools | shell, browser, files, memory | `web_search`, `web_fetch` |
| Agent shell runs in | a throwaway container (SEC-001) | there is no shell |
| Lifecycle | always on | up when you are using it |

The row that carries the isolation argument is now **Tools**, not the address. A
poisoned page reaching this agent finds two functions that read the web and a
directory it can only append fetched bodies to. It cannot run a command, cannot read
this service's database, and has no memory to persist an instruction into for the
next run — the transcript is discarded when the run ends.

This is the isolation that matters. `spec.md` §6.2 and `cockpit-spec.md` §8 both
say the corpus is attacker-influenceable; a shared gateway would put a poisoned
page one tool call away from the chat agent's long-term memory.

> **Superseded (2026-09-11):** what used to sit here was `TERMINAL_ENV=local` — the
> reasoning being that inside a container, "local" *is* the sandbox, and the
> alternative would need the host's Docker socket mounted in. Moot now: there is no
> terminal tool to configure. The strongest version of that argument is the one that
> survived, which is that the agent was never given a shell in the first place.

### 8.3 Crawl lanes, and what they are honestly worth

`tool.started` carries `{tool, preview, lane}`, where preview is the primary argument
— the query for `web_search`, the url for `web_fetch`. Lanes are a liveness
indicator; **the packet is the record.** The cockpit must never count sources from
tool events: a fetch that fails emits a lane and contributes no source, and one that
succeeds may still be rejected on admission.

Tool → lane mapping: `web_search` → `search`, `web_fetch` → `fetch`.

> **Superseded (2026-09-11):** the preview used to arrive already truncated by
> hermes (`agent/display.py: build_tool_preview`), so a lane's URL might be an
> ellipsis, and `web_extract` took a *list* while previewing only its first element —
> which is what made "never count sources from lanes" load-bearing rather than
> stylistic. Both quirks are gone: the preview is built here, from the real argument,
> and `web_fetch` takes exactly one url. The rule stays anyway, for the reason above.

---

## 9. Verification

Stage 1 works when, on a product the agent has never seen:

1. The packet validates against §4 on the **first** run, with no schema loosening.
2. Every excerpt's `source_id` resolves, and every admitted source's body is in the
   corpus volume — or is gapped as unarchived.
3. Five excerpts pulled at random are **byte-identical** to the text on the page they
   claim to come from. This is the check that catches quote drift, and it is done by
   hand.
4. The gap list is non-empty and each entry names something collectable.
5. A rejected source appears in the packet with a reason, and a `source_rule`
   judgement measurably changes what is admitted on the next run.
6. The saturation curve for review mining is monotone-ish and flattens. If it flattens
   at source 3 every time, the threshold in §2 is wrong (too eager) — that is what the
   curve is logged for.
7. **Nothing in the packet reads as a conclusion.** Read it cold: every line should be
   boring. If it is interesting, stage 1 did stage 3's job.

Point 7 is subjective and stays that way. The validator catches the schema violation;
a person catches the sentence that technically fits `attributes` and is really an
opinion.

---

## 10. Not in scope

Stages 2–5, the viability gate, the angle map, the entailment checker, the skill
editor, and the GRADE mode. Each is a later spec. The gate in particular is
tempting because the demo makes it look nearly free — it is not, it needs stage 3
output to gate on.

Ad-library and review scraping are named in `spec.md` §7 as the hostile ones. This
build assumes **whatever SearXNG can find and Firecrawl can read**, and everything
they cannot becomes a gap entry. That is the design, not a shortfall: a stage 1 that
fails loudly on a source it cannot get is more useful than one that quietly returns
less.

> **Measured 2026-09-16 (§2.5), and it is worse than this paragraph assumed.** The
> clause holds only where a blocked page *fails*. Amazon's review pages, Trustpilot and
> Reddit do not fail — they return a wall with HTTP 200, or Firecrawl refuses the
> domain outright — so the run does not gap them, it fills the node with whatever else
> was readable. "Fails loudly" is a property that has to be built (§4.2, rules 7–9),
> not one the fetch layer provides.

> **Superseded (2026-09-11):** this read "whatever hermes's existing web tools can
> reach". The clause was doing more work than it looked like — under hermes, "what
> the tools can reach" depended on which backend the harness had auto-detected on
> that machine, which is exactly how the first live run ended up driving a browser
> (§10a). Naming the two services makes the boundary a property of this repo instead
> of a property of the deployment. The principle is unchanged, and it is the reason
> `web_fetch` throws on a Firecrawl error rather than returning an empty string: a
> tool that fails silently turns a reachability limit into a fabricated absence.

---

## 10a. What the first live runs measured

Written down because these were surprises, and `setup.md` carries the fixes.

> **Historical (2026-09-10), and kept deliberately.** The first three findings below
> are about the hermes stack and no longer describe how this runs — but they are the
> argument that produced the port, so deleting them would delete the reasoning. The
> pattern worth carrying forward: *every one of them was a silent degradation.* A
> dead search tool that logged a WARNING and fell back to a browser; an extract
> backend that did not exist; a reused session that inherited a poisoned transcript.
> None of them failed loudly, and all three looked like a bad agent from the outside.
> §10b records what the same run looks like now.

**hermes's web tools were both dead.** `web_search` failed with `ddgs package is
not installed` and `web_extract` with *"DuckDuckGo is a search-only backend and
cannot extract URL content"*. Neither failed loudly: the gateway logged a
WARNING and **the agent silently fell back to `browser_exec`**, driving Bing one
page at a time. A run that should take minutes was still crawling after twenty,
and from the outside it looked like a bad agent rather than a broken tool.

Fixed by installing `ddgs` into hermes's venv — with the trap that hermes's venv
has no `pip` and `uv` is not on the non-interactive `PATH` (`~/.hermes/bin/uv`
is the one that exists). Verified live: `web_search` returned 5 results in 2.6s,
no gateway restart needed.

**`web_extract` is still unfixed.** ddgs is search-only, and every extract
backend (firecrawl, tavily, keenable, exa, parallel) wants an API key. Page
fetches go through the browser until that is settled. That is a real ceiling on
stage 1 and it belongs in the gap list of every run made before it is fixed.

**Session reuse silently poisons a run.** Reusing one `session_id` across two
runs made the second inherit the first's transcript — including its failed tool
calls — so it went straight back to the browser instead of retrying search.
hermes loads history from `state.db` when a session is named and *ignores the
request body*, which is the trap `CLAUDE.md` already warns about on the chat
path; it applies to runs too. `RunSupervisor` uses `research-{run_id}`, unique
per run, and §11's question about one-session-per-run is answered: yes,
and not by accident.

**The agent pulls the existing `product-research` skill** (`skill_view` calls in
the trace). Worth knowing, because that skill's methodology is not the
compartment's and nobody asked for it — a reason to build the
`research-compartment` skill sooner rather than later.

**Stage 1 is not a five-minute job.** The first fair run made 48 web searches
before it stopped gathering. `usage` is now recorded per run so cost stops being
a guess.

---

## 10b. What the port measured

First run on the in-process engine, 2026-09-11, `deepseek/deepseek-v4-flash-0731`,
brief "MagnaCalm magnesium glycinate 400mg / UK". Cancelled at ~9 minutes rather than
run to completion, so these are floor figures, not a full run:

| | |
|---|---|
| Tool calls | 14 in the first 75 seconds (searches and fetches interleaved) |
| Events persisted | 3,303 |
| Bodies archived | 14 |
| Tokens | 702,322 total — 288,918 input, 406,528 **cache reads**, 6,876 output |
| Cost | $0.0265 |

Three things this actually established, none of which were assumed:

1. **Cache reads dominate.** 406k of 702k tokens were cache hits, because the run is
   dozens of turns over a growing transcript and `Agent` is given a stable
   `sessionId` per run. Cache reads are priced at roughly a quarter of input here, so
   this is most of why a 700k-token run costs under three cents. A model without
   prompt caching would cost several times this for identical work.
2. **Usage must be summed across turns.** The final assistant message carries only its
   own turn — reporting that number would understate a run by an order of magnitude.
   `runner.ts` accumulates it, and §11's cost question is answerable because of that.
3. **Cancel settles cleanly.** `run.stopping` → `run.cancelled`, `live: false`, usage
   and partial output retained. The abort is distinguished from a failure by whether
   the operator asked for it, which is why a stopped run does not read as a crash.

The corpus audit was checked end to end on this run's real data:
`GET /api/research/runs/:id/sources/:sha` returned the archived body with
`X-Corpus-Digest-Matches: true`, `text/plain`, and `default-src 'none'`.

---

## 11. Open questions

- **Is three the right saturation threshold?** Instrumented, not assumed (§9.6).
- ~~**What does a stage-1 run cost?**~~ **Answered, and the answer changes the
  design.** ~700k tokens and $0.027 for nine minutes of gathering (§10b), most of it
  cache reads. Re-running a stage is cheap enough to be the default correction
  mechanism — which is the assumption the whole "correct it with a judgement and run
  it again" loop rested on. Still open: what a run that reaches saturation on all
  four nodes costs, since the measured run was cancelled.
- ~~**One hermes session per run?**~~ **Answered: yes, and it is load-bearing.**
  A reused session id made a run inherit the previous one's transcript (§10a). Moot
  in its original form — there is no hermes and no `state.db` to load history from,
  and each run builds a fresh `Agent` with an empty transcript, so isolation is now
  the default rather than something to get right. The `sessionId` is still unique per
  run, for a different reason: it is the prompt-cache key, and sharing it across runs
  would mean cache hits against an unrelated transcript.
- **Does the agent reliably emit a valid packet?** The whole design rests on it. If
  the first three runs need hand-fixing, the answer is a stricter prompt or a
  post-run repair pass — **not** a lenient validator.
- **Where do themes live long-term?** In the packet for now. If stage 2 wants to
  re-cluster, they may want to be a separate mutable artifact keyed to immutable
  excerpts.
---

## 12. Raw notes, and where each one went

Working notes from the 2026-09-14 conversation. Folded into the spec above where they
are stage-1 requirements; the rest are parked with the stage that owns them, because a
note about ad formats is not a note about collection.

**Now specified above:**

| Note | Where it landed |
|---|---|
| extract all active ingredients | §2.1 — `active_ingredients[]`, split out from the verbatim panel, with the reason |
| direct = same active + same form; indirect = same active + different form | §2.2, with the mechanical test and per-class saturation |
| Amazon reviews, more than 10, and a way around Amazon's limits | §2.3 volume floor; §2.5 measures the wall and §2.5.1 lists the routes |
| Reddit and similar | §2.5 — blocked twice over today, and the fix is the Reddit API |
| TAM, keyword volume for the active ingredient, Amazon sales as traction | §2.4 |

**Parked, with the stage that owns them:**

- **Avatars built from real reviews** — a synthesis over excerpts, so stage 2 at the
  earliest. It is the clearest example of why §2.3's first-hand rule matters: an avatar
  built from a YouTuber's summary of reviews is a portrait of the YouTuber.
- **Ads are the most important signal across platforms. Long-form statics: a hook
  image over story-format body copy; some start on the product page. The click
  sometimes lands on an advertorial rather than the product page.** Stage 3
  (sophistication and angles). Stage 1's job here is narrower and already specified:
  capture the creative and its `first_seen`, gap it when the date is missing (§2.2).
- **"Marketing highlights their own desires, talk to them in their own language."**
  The argument for verbatim capture, already load-bearing in §2.3, and a stage-4 copy
  principle. Not a collection rule.
- **Hockey-stick traffic, high Trustpilot, big five, 5–10 low-saturation products** —
  these are stage 0's gates, specified in `spec-stage-0.md` §4 and built. Listed here
  only so the note is not read as an unbuilt stage-1 requirement.
- **"Veloma"** — an unexplained name in the notes; recorded verbatim rather than
  guessed at. If it is a product or competitor to seed a run with, it belongs in a
  brief, not in the spec.

---

## 13. To do

Everything §2 now requires that the build does not yet do, ordered so each item
unblocks the next. Nothing here is started. "Done when" is the check, not a feeling.

### 13.1 First — stop the silent failures

These are small, need no new service, and every one of them was caused by a real run
(§2.5). Until they land, every other item produces confident nonsense faster.

- [ ] **Rule 7 — an excerpt must occur verbatim in its source's archived body.**
      `packet.ts` validates shape only and never opens the corpus; the run id and the
      bodies are both to hand in `runner.ts`. Whitespace-normalise both sides, compare,
      fail the run `invalid` naming the excerpt.
      *Done when* a packet quoting text absent from its body is rejected, with a test
      covering both a byte-identical pass and a paraphrase fail.
- [ ] **Rule 8 — a wall is not a page.** In `tools.ts`, treat a body under ~1,000
      characters, or one matching a wall signature ("Verifying your connection",
      "Enable JavaScript and cookies"), as a failed fetch: no archive, no source_id, an
      error telling the agent to gap the domain.
      *Done when* the Trustpilot URL from §2.5 produces a gap rather than a source.
- [ ] **Rule 9 — review excerpts may only cite review-bearing source kinds.**
      `schema.ts` cross-object rule, alongside the existing 3★ check.
      *Done when* an excerpt on a `reference` source fails validation.
- [ ] **Fix the example leak in `prompt.ts`.** `spec-stage-0.md` §5.3 measured it on
      stage 0 and fixed it there; stage 1 still puts a complete magnesium packet last,
      which is why runs drift toward magnesium whatever the brief. Move the brief and
      the task after the example, as stage 0 does.
      *Done when* a test asserts the brief appears after the worked example.

### 13.2 Then — make review mining possible at all

§2.3 cannot complete today (§2.5). In cost order:

- [ ] **Reddit API tool.** Free tier, OAuth client credentials, ~100 queries/min,
      returns comment trees as JSON. New tool plus `MRA_REDDIT_*` settings; sources
      land as `kind: forum`. The only permitted route of the four, so it goes first.
      *Done when* a run captures ≥5 forum excerpts with post dates and permalinks, and
      a missing credential degrades to a gap rather than an error.
- [ ] ~~**YouTube comments.**~~ **Cut from scope 2026-09-16.** Data API v3
      `commentThreads` would work on a free quota, but Reddit covers the same ground —
      unpaid customer language — and one forum source is enough to prove the node.
      Revisit only if Reddit yields thin material. The existing `video_comments`
      sources, which contain descriptions rather than comments, should stop being
      admitted regardless (§4.2 rule 9).
      *Done when* `video_comments` excerpts carry comment text and posted dates.
- [ ] **Amazon, step one: fetch the product page properly.** `onlyMainContent: false`
      plus `waitFor: 4000` returns 10–17 first-hand reviews (§2.5.2). Needs per-domain
      fetch options, a parse into excerpts with star, date and country, and a retry —
      the same call returned 0 reviews at a 10s wait (§2.5.2, limit 4), so "reviews > 0
      or try again" is part of the work, not a refinement of it.
      *Done when* a run captures ≥10 Amazon reviews with star ratings on a live product.
- [ ] **Amazon, step two: timebox 3 hours on a signed-in browser.** The plain-fetch
      version of this experiment is already answered — those pages want a login
      (§2.5.2, limit 3). What is untested is driving a real browser, signed into a
      throwaway account, to `/product-reviews/…?filterByStar=three_star`. Success
      fixes 3★ coverage; failure makes the paid question real. Note two constraints
      before starting: automated collection under an account is against Amazon's terms
      and the account is what gets closed, and this server is captcha'd by Amazon
      directly, so the browser likely needs the same non-data-centre route as
      Trustpilot (§2.5.3). Stop at 3 hours either way and record which.
- [ ] **Then decide the paid supplier.** What it buys is *choice over the sample* —
      star spread, volume, recency — not merely "reviews". Only worth pricing once
      step two has answered.
      *Done when* the decision is recorded here, including "not buying", in which case
      §2.3's floor becomes "whatever the product page shows, typically 10–17" and 3★
      coverage becomes best-effort with a gap when absent.
- [ ] **Trustpilot: a reader plus a route (§2.5.3).** The parse is easy; the block is
      on our server's address, so the work is a fetch path that is not the VPS — a
      proxy, or running that step off a residential connection. Free either way, bar a
      few pounds a month for a proxy.
      *Done when* a run captures Trustpilot review text with star ratings and dates.

### 13.3 Then — the schema and prompt for the new node requirements

- [ ] **`active_ingredients[]` as attribute rows** (§2.1, §4.3 keying), and
      `prompt.ts` instructing the split of actives from the verbatim panel.
      *Done when* a run on a multi-ingredient product yields one row per active with
      dose and unit, and the verbatim panel alongside.
- [x] **Competitor rows** — the one genuinely new shape (§4.3): `relation`, `form`,
      `active_ingredients[]`, `price_per_dose`. Today competitors are loose attributes,
      so direct-versus-indirect cannot be expressed at all.
      *Done when* a packet distinguishes the two classes and the validator rejects a
      competitor with no `relation`.
      **Done 2026-09-18**, and one step further than asked: the validator does not
      only require `relation`, it recomputes it from `form` against a new
      `competitor_reference` (the product's own form and actives — a
      competitors-only run has no §2.1 attributes to compare with) and rejects a
      label the forms contradict. `form` became a fixed vocabulary for the same
      reason. Verified on a real run: 5 direct, 8 indirect. See `workings.md` §2c.
- [x] **Per-class competitor saturation** (§2.2): two curves, not one.
      **Done 2026-09-18**: `saturation[].class`, and `competitors` cannot be
      `complete` without a curve for each class.
- [ ] **Category metric vocabulary** (§2.4): `tam`, `category_size`, `search_volume`,
      `amazon_sales`, `units_sold`, `bsr`, with `period` mandatory, and the prompt
      telling the agent to measure volume on the *active ingredient*.
- [ ] **`nodes[].coverage` for review mining** — `{ reviews_captured, stars_covered[] }`
      so §2.3's floor is checkable rather than asserted.

### 13.4 Then — verify, with numbers

- [ ] **Re-run the yoracare brief** once 13.1 and 13.2 land, and check it against §9
      point by point. The 2026-09-12 packet is the before; keep it for comparison.
- [ ] **Answer §11's remaining cost question.** Every measured run so far was
      cancelled, so the cost of a run that saturates all four nodes is still unknown.
- [ ] **Cockpit: surface the wall gaps.** A run that gapped Amazon and Reddit should
      say so where the operator looks, not only inside the packet JSON.

### 13.5 Not doing yet, deliberately

Ad-library capture beyond what a normal fetch reaches; anything in stages 2–5;
avatars (§12). The ad libraries are the next hostile source after reviews, and worth
attacking only once the review path works — the same wall problem, and less of the
signal.


Add a check (product truth):
-> every scientific fact of the product should be reinforced by customer reviews