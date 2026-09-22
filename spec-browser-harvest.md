# Browser harvest — reviews from a real, signed-in browser — spec

Every route this project has measured hits one of two walls, and Amazon has both:

| Wall | What it does | Measured |
|---|---|---|
| **Address** | Hetzner gets a 3.7 KB bot page **at HTTP 200** — to curl, to headless Chrome, to Firecrawl in both proxy modes | `spec-review-mining.md` §3.1–3.2 |
| **Sign-in** | `/product-reviews/` 302s to `/ap/signin` from **every** address tested, residential included | §3.4 |

A real browser, on a residential address, with a signed-in session, is the only
thing that clears both at once. **This spec records the decision to build that as
an operator-driven harvest tool, and to write down exactly why the unattended
version is not the same thing.**

Status: **not built.** §11 is the gate — one measurement decides whether any of
this is worth writing. §12 is the checklist.

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
   reviews per product across the bands, and 3-star in particular** — not
   §2.3's minimum of ten, which is a floor for the contract, not an ambition.
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

## 8. Corpus integration

Harvested reviews enter the corpus exactly as a fetched page does, because
everything downstream already depends on that:

- One JSON document per (asin, band), written verbatim.
- `source_id` = sha256 **of the exact bytes written**, so
  `GET /runs/:id/sources/:sha` re-hashes and matches. Hashing a normalised form
  turns that audit into a permanent false negative.
- `kind: marketplace_review`, `publisher: amazon.com`, locator per review from its
  own permalink.
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
