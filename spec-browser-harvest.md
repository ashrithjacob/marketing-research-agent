# Browser harvest — reviews from a real, signed-in browser — spec

**Destined for its own repository.** This was written inside
`agent-collection/marketing-research-agent` and is being extracted. Everything it
depends on from that repo is restated in §0 rather than cited, so the document
stands on its own; where a measurement lives in the old repo the filename is
given, but you should not need to open it.

Status: **not built.** §11 is the gate — two measurements decide whether any of
this is worth writing. §12 is the checklist.

---

## 0. The problem

### 0.1 What the reviews are for

The consumer is a market-research agent. One of the things it gathers is
**verbatim customer language**: what a buyer actually wrote, with the star
rating, the date, and a code on three axes — **why they bought**, **why they
stayed**, **why they quit**.

The word doing the work is *verbatim*. The instruction the agent is given:

> Never clean up, summarise or paraphrase a quote: "I wake up at 3am and can't
> get back to sleep" is usable and "sleep maintenance issues" is not, and the
> degradation is irreversible.

That single rule rules out most of the market. Every vendor selling "review
intelligence", "AI review summaries" or "pain point analysis" is selling the
paraphrase, which is the thing that has already destroyed the value. What is
needed is the sentence, unmodified, with a locator that can be re-read.

It also rules out putting a language model in the extraction path, however
convenient — a model reporting what it saw is a paraphrase hazard sitting exactly
where paraphrase is forbidden. See §9.

### 0.2 Why 3-star specifically

One-star reviews are mostly logistics: it arrived broken, it never arrived, the
seller was rude. Five-star reviews are mostly enthusiasm, and a proportion of
them are incentivised. **The 3-star band is where somebody kept the product and
still says what is wrong with it** — the only place `why_stayed` and `why_quit`
routinely appear in the same paragraph.

So a route that returns "reviews" in bulk but cannot select a star band is not
useful for this. It returns the 5-star mass, because that is what a product page
shows by default. Star control is the requirement, not a nice-to-have, and it is
the requirement that every cheap route fails.

**The target is hundreds of reviews per product across the bands, with 3-star
well represented.** A contract floor of ten exists downstream; it is a floor, not
the goal.

### 0.3 What is in the way

Two separate walls, and Amazon has both. They look alike and have opposite fixes,
which is the single most expensive confusion available here:

| Wall | What it does | Where it was measured |
|---|---|---|
| **Address** | A datacentre IP gets a 3.7 KB bot page **at HTTP 200** — to curl, to headless Chrome, and to Firecrawl in both proxy modes. A residential IP gets 13 real reviews from the same URL. | `spec-review-mining.md` §3.1–3.2 |
| **Sign-in** | `/product-reviews/`, the page that paginates, 302s to `/ap/signin` from **every** address tested, residential included. Only `/dp/` is readable signed-out, and it holds ~13 reviews. | §3.4 |

A better browser does not solve the first. A better address does not solve the
second. **Always record which machine a measurement came from** — a laptop result
does not predict a server one, and on this question they disagree completely.

There is a third trap that is not a wall but corrupts data: on `/dp/`, Amazon's
own `filterByStar` parameter **lies in two directions**. `three_star` returns
zero containers, which reads as "no 3-star reviews exist". `one_star` returns the
*unfiltered* sample — thirteen reviews presented as 1-star, eleven of them really
5-star. Fabricated star data, undetectable from the page alone. Any harvester
must check the spread that came back against the band it asked for, and discard
the page when they differ.

### 0.4 What has been tried, and what each of them actually returns

All measured 2026-09-22 against `amazon.com/dp/B000BD0RT0`, a listing the actor
reports as having **845 written reviews**:

| Route | Reviews it returned | Star control | Cost |
|---|---|---|---|
| **Firecrawl** (cloud scraping API) | **0** of 1,455,348 characters — a real product page with a sign-in prompt where the reviews should be | none | ~1 credit |
| **AnakinScraper**, self-hosted, plain HTTP handler from a residential IP | **13**, spread `{3:1, 4:1, 5:11}` | none — you get what Amazon chose | free |
| **Outscraper** | **13** (asked for 50) | **none, and the API has no star parameter at all**; its spec documents `limit` as "Maximum is 12" | free to 500, then $2/1k |
| **Apify** `junglee/amazon-reviews-scraper` | **76 distinct** in a ten-run walk, spread `{1:18, 2:15, 3:12, 4:13, 5:18}`, 76/76 verified purchases | **yes, verified** — asked 3-star, got 3-star | **$0.6002 charged** |

Reading that table: **only the paid actor can express the question.** The free
routes all return the same ~13 reviews the `/dp/` page renders, of which exactly
**one** is 3-star. The gap between "one 3-star review" and "a hundred" is the
entire problem.

Apify's ceiling is 500 per product — 100 per star band, from its own input
schema — at $0.006/review on the entry tier, so $3.00 per product and $60 for a
twenty-product run.

### 0.5 What is left

A real browser, on a residential address, with a signed-in session, is the only
thing that clears both walls at once — and being signed in is what makes
`/product-reviews/` reachable, which is what makes pagination past ~13 possible.

**This spec records the decision to build that as an operator-driven harvest
tool, and to write down exactly why the unattended version is not the same
thing.**

---

## 1. The decision

> **Reviews may be harvested through a real browser driven by a consenting
> operator, into the run corpus, as a separate step from the agent's run. The
> harvest is a tool the operator runs; it is not something the agent initiates.**

Three consequences, in increasing order of importance:

1. **The corpus stops depending on what a datacentre IP can see.** Harvested
   reviews are archived and content-hashed exactly like a `web_fetch` body, so
   nothing downstream changes.
2. **Volume becomes reachable, not just the floor.** The target is **hundreds of
   reviews per product across the bands, and 3-star in particular** — not the
   downstream contract's minimum of ten (§0.2), which is a floor, not an aim.
   At the documented ceiling that is up to 100 per band and 500 per product.
   Apify can sell that for $3.00/product; this route would be free — *if* §11
   passes.
3. **The human stays in the loop, and that is the design, not a limitation.**
   The consent is what makes this defensible. An architecture that engineers the
   human out is a different product with a different risk profile, and §6 says so
   plainly.

---

## 2. Why this is worth building: the evidence

**Two independent sources agree on 500 reviews per product.**

- The Apify actor's own input schema: *"max amount of reviews per product is 100
  per star rating, so in the best-case scenario … you get 500 reviews per
  product."*
- The Chrome extension's store listing: *"Max Mode can collect up to 500 reviews
  per cycle by cycling through star ratings."*

Same number, same method — walk the five bands — reached independently by a paid
actor and a browser extension. That is the strongest signal in this document.

**The star filter probably works on `/product-reviews/`, and the §3.4 finding does
not contradict that.** §3.4 measured `filterByStar` lying in two directions —
`three_star` empty, `one_star` unfiltered — **on `/dp/`**, the embedded widget.
The reviews page is a different surface. Evidence it behaves: rows returned by
`junglee/amazon-reviews-scraper` carry their own

```
reviewCategoryUrl: https://www.amazon.com/product-reviews/B000BD0RT0
  ?pageNumber=1&filterByStar=three_star&sortBy=recent&scope=reviewsAjax0
```

and that actor's output **was verified to honour the band** (`--stars 3` returned
`{3: 5}`, 2026-09-22). So the actor reaches reviews through the same URL shape a
browser would, with the same parameter, and gets honest results.

**Unverified, and it is the whole gate.** We have never once loaded
`/product-reviews/` ourselves — it 302s. Everything above is inference from
someone else's URLs. §11 is the measurement that turns it into fact, and nothing
in §7–§10 should be written before it passes.

**What it is worth in money.** 500 reviews/product costs $3.00 at the Apify FREE
tier. A 20-product stage-1 run is $60, against a $5/month plan cap.

---

## 3. Two architectures, and they are not interchangeable

### A — Operator-consented harvest (recommended, specified in §4)

A person who owns the Amazon account starts the browser, signs in themselves,
watches it work, and can stop it. The automation acts **on behalf of a present,
consenting human, using that human's own account.**

This is what the Chrome extension does, and it is why the extension exists rather
than being a server. It is the same posture as every legitimate browser-automation
product: the session belongs to the person, and the person is there.

### B — Unattended VPS browser on a dedicated Amazon account (as asked; see §6)

A throwaway Amazon account, signed in once, session stored on the VPS, driven
headlessly with no human present.

**This is a Conditions of Use violation, and the burner account is the part that
makes it one rather than a grey area.** Amazon's CoU prohibits automated access;
creating an account whose purpose is to get around that is deliberate
circumvention, not an edge case. §6 documents what it costs and what happens when
it fails. **This spec does not design around Amazon's detection**, for the reason
in §9.

The engineering below is shared. The difference is entirely who is present and
whose account it is — which is also the entire difference in risk.

---

## 4. Architecture A — how the consent actually works

The interesting problem is that the operator is on a laptop and the cockpit is on
a VPS. Three ways to bridge that, in increasing order of complexity:

### 4.1 Local harvest, upload (start here)

```
operator laptop                          VPS
┌──────────────────────────┐            ┌────────────────────┐
│ mra-harvest (Playwright) │            │  mra app           │
│  ├ persistent profile    │            │  ├ POST /harvest   │
│  ├ operator signs in     │  upload    │  └ corpus/runs/... │
│  └ writes reviews.json   │───────────▶│                    │
└──────────────────────────┘            └────────────────────┘
```

The harvester is a local CLI. It opens a headed Chrome with a persistent profile,
waits for the operator to sign in **by hand the first time**, walks the bands,
writes a JSON file, and `POST`s it to the cockpit, which archives it into the run
corpus under the same sha256 rules as `web_fetch`.

No credentials ever reach the VPS. No remote control. The operator sees every page
the browser loads. **Build this one first** — it proves §11 and delivers the data,
and everything in §4.2 is an ergonomics upgrade on top of it.

### 4.2 Remote browser the operator drives (the product idea)

If the harvest must run from the cockpit UI, the browser lives on the VPS and the
operator is given a live view of it:

```
browser ──── wss ────▶ noVNC ──▶ Xvfb :99 ──▶ Chrome (headed, persistent profile)
   │                                                    ▲
   │  "Start harvest"                                   │ CDP
   └──────────────▶ mra app ──────────────────────────┘
```

- **Xvfb + x11vnc + noVNC** in a sidecar container. The operator opens a panel in
  the cockpit and sees the real browser.
- **The operator signs in themselves, in that window.** The app never sees the
  password, never types it, never stores it. It cannot: it is a VNC pixel stream
  in one direction and CDP commands in the other.
- **A visible, revocable session.** The panel shows what URL is loaded and a Stop
  button that kills the context. A harvest that cannot be watched and stopped is
  architecture B wearing A's clothes.
- **Consent is per-session and expires.** §5.

This is a real product shape — Browserbase, Steel, Anchor all sell it — and the
consent flow is the part that has to be right, not the plumbing.

### 4.3 Extension-in-the-loop (do not)

Playwright *can* drive a Chrome extension: persistent context only, Chromium only,
headed only, via `--load-extension` / `--disable-extensions-except`. So
simulating the "Collect reviews" click is technically possible.

**Do not do it.** Two reasons, both practical before they are ethical:

- The extension handles *authentication information* (its own store listing says
  so) and runs on your signed-in Amazon session, which reaches orders, addresses
  and saved cards. 446 users, one publisher, and "nothing is sent to external
  servers" is unverifiable from outside. Extensions get sold and silently updated.
- It buys nothing. The extension's method is public — cycle the star bands on
  `/product-reviews/` — and we can issue those URLs directly. Driving its UI adds
  a fragile DOM dependency on someone else's markup **on top of** our fragile DOM
  dependency on Amazon's.

Its existence is useful as **evidence the method works** (§2). That is all we need
from it.

---

## 5. Sessions, credentials and what is never stored

| Item | Where it lives | Lifetime |
|---|---|---|
| Amazon password | **Nowhere.** Typed by the operator into the browser, never through our code | — |
| `storage_state` (cookies + localStorage) | Encrypted at rest, keyed by a secret **not** in `.env` | Expire after N days, re-auth on 302 |
| Harvested reviews | `corpus/runs/<runId>/sources/<sha256>` | As any other source |
| Consent record | Database row: who, when, which ASINs, which account | Audit trail |

Rules that are not negotiable:

- **A 302 to `/ap/signin` mid-harvest is "re-auth needed", never "no reviews".**
  This is §2.4's Trustpilot lesson repeated: a token ageing out mid-run looks
  exactly like a permanent block, and that misreading survived a whole spec
  revision last time.
- **Never store the password to re-authenticate automatically.** If the session
  dies, the harvest stops and asks for a human. That is the consent model working,
  not a bug to fix.
- **One profile per account, never shared between operators.**
- **`storage_state` is a credential.** It goes in the same bucket as
  `APIFY_TOKEN`: gitignored, never logged, never in a tool result the model sees.

---

## 6. Architecture B, honestly costed

If the dedicated-account version is built anyway, these are the things that decide
whether it was a good idea, and none of them are technical:

1. **The account gets terminated, and the question is when.** Amazon closes
   accounts for automated access. A burner has nothing to lose, which is the
   point — but it also means the harvest stops without warning, mid-run, and the
   failure looks like §3.1's bot page.
2. **Termination can reach further than the burner.** Amazon links accounts by
   device, address and payment instrument. A burner created from the same VPS, or
   sharing anything with a real account, risks the real one. **Never create it
   from a machine or card that touches a personal account.**
3. **It is deliberate circumvention, and that changes the legal character.**
   Scraping public review text is one thing; creating an account to get around a
   technical access control is another, and the second is what CFAA-adjacent
   arguments attach to. This is a decision for whoever carries the company's risk,
   not for the person writing the scraper.
4. **It is not more capable than A.** Same URLs, same 500/product ceiling, same
   selectors. The *only* thing it buys is that no human is present — and that is
   precisely what it costs.
5. **The failure mode is silent and correctness-shaped.** A blocked session
   returns pages that parse to zero reviews. Without the §8 gap rules, that
   becomes "this product has no 3-star reviews" in the corpus.

**Recommendation: build A, and make the harvest cheap enough to run that nobody
wants B.** Twenty products at ~90 seconds each is half an hour of a laptop being
on. That is not a problem worth a terminated account.

---

## 7. The harvest engine

Shared by both architectures.

### 7.1 URL template

```
https://www.amazon.{tld}/product-reviews/{asin}
  ?filterByStar={one_star|two_star|three_star|four_star|five_star}
  &sortBy=recent
  &pageNumber={1..N}
  &formatType=all_formats
```

Bands in the order `3, 1, 2, 4, 5` — 3-star first, because it is the band the
contract requires and the one most likely to be thin.

### 7.2 Extraction

**Reuse `crawl_tests/common.py:amazon_reviews()`.** It already carries the §9
selectors, the four-way diagnosis, and 24 passing tests. Do not write a second
extractor; §9 of `spec-review-mining.md` records that the wrong selector returns
zero reviews from a page that has thirteen, and the only defence is one extractor
with tests.

### 7.3 Stopping

- Stop a band when a page yields zero new review ids, or at `pageNumber` 10
  (100/band is the documented ceiling).
- Stop the product at the requested count.
- **Verify the spread against the band requested on every page.** If a `three_star`
  page returns anything else, discard the page and record it — §3.4's trap must be
  checked for, not assumed away, and this is the first time we will ever have been
  able to check it.

### 7.4 Politeness

Not optional, and not only for etiquette — it is what keeps a session alive:

- One request at a time per account. No concurrency.
- 2–5s randomised between page loads; 10–20s between products.
- Hard cap per session (say 2,000 reviews), then stop and require a new start.
- Stop on the first sign of throttling. Do not retry into a block.

---

## 8. Handing the data over

The harvester's output is an archive, not a database. Whatever consumes it — the
research agent today, something else later — gets files it can re-read and
re-hash, because that is what makes a quote checkable a month after the run:

- One JSON document per (asin, band), written verbatim. No normalisation, no
  trimming, no re-encoding — see §0.1.
- `source_id` = sha256 **of the exact bytes written**. The consumer re-hashes the
  file to prove the quote still matches its source; hashing a normalised form
  turns that audit into a permanent false negative.
- Per review: text, star, date, verified-purchase flag, and its own permalink as
  the locator.
- For the research agent specifically, that lands as `kind: marketplace_review`,
  `publisher: amazon.com`, under `corpus/runs/<runId>/sources/<sha256>` — the
  same path and rules its `web_fetch` tool already uses, so nothing downstream
  changes.
- **Gaps are recorded, not inferred.** Reuse the four diagnoses already in
  `amazon_reviews()`: unloaded placeholder, sign-in prompt, stale selectors, no
  markup. Add a fifth: `session_expired`. Only "the page rendered, the band was
  honoured, and there were no reviews" may ever be written as "this product has no
  reviews at this band".

---

## 9. What this spec will not specify

**No detection evasion.** No fingerprint spoofing, no CAPTCHA solving, no proxy
rotation to dodge a ban, no timing jitter tuned to look human. Three reasons:

1. If the harvest needs to disguise itself, the consent story is fiction and
   architecture A's whole justification is gone.
2. It is an arms race we lose. §3.3 is the lesson: Firecrawl worked on Monday and
   returned zero on Tuesday, and the fix was not in the fetch layer.
3. A system that only works while undetected has no honest failure mode — and this
   project's entire defence against bad data is that failures are legible.

If a page needs solving to reach, the answer is that it is not reachable, recorded
as a gap. That is `spec-review-mining.md` §6's verdict on browser-use restated:
*"no browser configuration guarantees that every CAPTCHA can be avoided or
solved."*

**No LLM in the extraction path.** §6 rejected browser-use on four counts; your
own browser kills exactly one of them (the address block). The other three stand,
and the sharpest is that §2.3 requires verbatim content-hashed excerpts. A model
reporting what it saw is a paraphrase hazard exactly where paraphrase is
forbidden. `--dump-dom` cannot paraphrase.

The navigation is a URL template. There is nothing here for an agent to decide.

---

## 10. Warnings

Collected so they are seen before the mistake, not after.

- **Amazon's Conditions of Use prohibit automated access.** This applies to
  architecture A as well. A consenting operator using their own account is
  defensible and is still against the CoU. Know which risk you are accepting.
- **Do not use a personal Amazon account for A.** Same reasoning as B's burner,
  from the other direction: the account you automate is the account that can be
  closed, and a personal one has orders, addresses and cards attached.
- **A signed-in browser is a credential.** Anyone with CDP access to that browser
  has the account. Bind the debugging port to loopback, never publish it, and
  treat the noVNC panel as authenticated-only.
- **`storage_state` in a tool result is a leaked session.** The model must never
  see it. Same rule as `APIFY_TOKEN`.
- **A 302 to signin is re-auth, never "no reviews".** Repeated from §5 because it
  is the single most likely way bad data enters the corpus.
- **Playwright extensions: headed Chromium with a persistent context only.** If
  you ever do go the extension route, headless will silently not load it.
- **Deploy kills live runs** (`../CLAUDE.md`), and a harvest is longer than a run.
  Do not deploy mid-harvest.
- **The VPS has 3.8 GB, no swap, five containers and ~2.2 GB free.** A resident
  Chrome plus Xvfb is real memory, and the OOM killer may pick agentchat.
  §5.1 of `spec-review-mining.md` declined a resident Chrome for this reason;
  architecture 4.2 reopens that decision and must be measured, not assumed.
- **446 users is not a vetted extension.** §4.3.

---

## 11. The gate — measure this before writing anything else

**Two questions, and the second is now as load-bearing as the first:**

1. **Does `filterByStar` tell the truth on `/product-reviews/` when signed in?**
2. **How deep does `pageNumber` go before it stops returning new reviews?**

The target is hundreds per product with 3-star well represented, so page 1 of a
band proves nothing on its own. An honest filter that only ever serves ten
reviews is not a route to 100 three-star reviews; it is a slower Outscraper.

Everything in §2 rests on inference from the Apify actor's URLs. If the parameter
lies on that page the way it lies on `/dp/`, this whole route produces fabricated
star data and is worth less than the $3.00 it saves.

```
for band in (1, 2, 3, 4, 5):
    load /product-reviews/B000BD0RT0?filterByStar={band}&sortBy=recent&pageNumber=1
    extract with amazon_reviews()
    assert every row's star == band
```

Five page loads, signed in, by hand if necessary. Also record, while there:

- reviews per page (expected ~10) and whether `pageNumber` walks past 10
- whether the totals match the 845 the actor reports for this ASIN
- how long a session survives before the 302 returns

**If the spread does not match the band requested, or the 3-star band cannot
pass ~10 reviews, stop.** Write it up, mark this
spec superseded, and keep buying from Apify — where the band was verified honest
on 2026-09-22.

Build it as `crawl_tests/crawl_browser.py`, headed, one ASIN, no cockpit
integration. It is a probe, and probes live there.

---

## 12. Implementation checklist

- [ ] **§11 gate**: `crawl_tests/crawl_browser.py`, five bands, one ASIN, signed in
- [ ] Record the result in this spec — including if it fails
- [ ] Local harvester: persistent profile, band walk, pagination, stop rules
- [ ] Reuse `amazon_reviews()`; add the `session_expired` diagnosis
- [ ] Politeness: serial, randomised delays, per-session cap, stop-on-throttle
- [ ] `POST /api/research/runs/:id/harvest` — archive, sha256, `marketplace_review`
- [ ] Consent record: who, when, which ASINs, which account
- [ ] `storage_state` encrypted at rest, gitignored, never in a tool result
- [ ] Tests: band-mismatch discard, 302-is-re-auth, gap diagnoses
- [ ] `../setup.md` if any of this runs on the VPS — same change, not later
- [ ] Only then: evaluate 4.2 against the memory measurement in §10

---

## 13. Non-goals

- **Not a stage-2 replacement.** Apify stays until this is proven and running. A
  laptop harvest is not an unattended pipeline.
- **Not an agent capability.** The agent never opens a browser, never signs in,
  never decides to harvest. It reads what the corpus holds.
- **Not multi-tenant.** One operator, one account, one profile. A service that
  harvests on behalf of strangers is a different product and a different spec.
- **Not Amazon-general.** Reviews on `/product-reviews/`. Not orders, not prices,
  not anything requiring a purchase.

---

## 14. What moves into the new repo

The scraper is being extracted, so this is the inventory. Most of it exists.

**Comes with it, already written and tested:**

| From | What it is |
|---|---|
| `crawl_tests/common.py` → `amazon_reviews()` | The extractor: the measured `data-hook` selectors, plus the four-way diagnosis that distinguishes *unloaded placeholder*, *sign-in prompt*, *stale selectors* and *no markup*. **Do not rewrite this.** |
| `crawl_tests/common.py` → `wall_check()` | Detects a bot page that arrived as a successful fetch. Tiered, because a naive version flagged a real 20,181-character product page on the word "captcha" in a newsletter form. |
| `crawl_tests/test_common.py` | 24 cases pinning both of the above, including fixtures taken from real blocked bodies. |
| `crawl_tests/crawl_apify.py` | The incumbent to benchmark against, including the band-and-sort walk and the live-balance preflight. |

**Written fresh in the new repo:** the harvester itself (§7), the consent flow
(§4), session storage (§5), and the §11 gate probe.

**Stays behind:** the research agent, the corpus writer, the cockpit. The new
repo produces archived review files and knows nothing about what reads them.

**Why the extractor must travel rather than be rewritten:** the selectors most
guides publish are stale, and stale selectors fail *silently* —
`data-hook="review-body"` and `data-hook="reviewTextContent"` both return zero
matches on a page holding thirteen reviews. The only defence is one extractor
with tests that fail loudly when the markup moves.
