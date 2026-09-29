# Stage 2 as a pipeline — spec

Stage 2 mines customer reviews for the targets stage 1 found. Until 2026-09-30 an
agent did it: a model turn loop that searches Amazon, calls `mine_reviews`, and records a
packet through the ledger. **The decision this spec records: stage 2 is a code
pipeline with no model in it. The listings are matched by code before the run,
the pulls are the existing Apify calls, and the packet, its gaps and its node
status are computed by code.**

Status: **built 2026-09-30** — §3, §3a, §3b, §4, §5 and §6, with the tests in §7. Checked by `mra check` and a local smoke test on stored data (run `99002ee8`'s listings: 14 matched, c15/c16/c17 now rejected; its stage-2 plan: 14 targets on Amazon, 8 on Trustpilot, Wanderlust not offered). **Not yet checked on a real stage-2 run**, which spends Apify money (§7). §9 records what building it decided. Reach (which routes exist, what
Apify returns, what it costs) stays in `spec-review-mining.md`; this spec changes
who drives it.

---

## 1. What happened — run `f1b67523`, 2026-09-29, local

Brief `https://mullevia.com/products/mullevia-mullein-drops`, node `review_mining`,
`z-ai/glm-5.3-flash`, the roster from stage-1 run `99002ee8`. From
`research_llm_calls`, `research_events` and the run trace:

| When | What |
|---|---|
| 17:37:41–17:39:37 | 6 model calls (6–19 s each): fetch the brief site, 5 × `amazon_find_product`, record a source, 5 attributes, 2 gaps, 2 saturation curves |
| 17:39:37–17:43:29 | `mine_reviews`: 3 Amazon listings × 5 bands, 3 Trustpilot domains. **3 min 52 s, $1.37 in Apify charges (23 `apify.charged` events), 315 reviews** |
| 17:43:29–18:20:43 | Call 7: **2,233 s, 332,947 reasoning tokens (OpenRouter `/generation`, provider Modal), no output.** Stopped by the operator; the run ended `cancelled` |

The mining — the whole point of the stage — was the 3 min 52 s. The model never
reads a review (`agent/prompt/text/node-rules.ts`: "You will not read the
reviews"), so its only decisions were which listing to mine and which Trustpilot
domains to pull, and it got both partly wrong:

- **Searches that code had already done.** The stage-2 plan screen looks up an
  Amazon listing per target before the run (`StageTwoListings`, cached in
  `research_target_listings`). The agent searched again five times.
- **The wrong store.** Code had matched c21 (Herb Pharm, UK) to
  `amazon.co.uk/dp/B000S86S3M`. The agent mined `amazon.com/dp/B000S86S3M`, the US
  listing of the same product as c1's — one 1,652-review pool pulled twice.
- **Rows that mean nothing for a fixed set of pulls:** product facts recorded
  against `review_mining` (caused by the brief block telling every site-brief run
  to record `product_data`, which stage 2 cannot), a saturation curve with zero
  themes recorded before any review was mined, and a second curve with
  `class: "direct"`, which the prompt reserves for competitors.

## 2. The decision

| # | Decision | Rejected | Why |
|---|---|---|---|
| 1 | **No forum or Reddit voice in stage 2.** Stage 2 is Amazon and Trustpilot reviews only | Keeping a model step to `web_fetch` forum threads | Decided with you, 2026-09-29. It is the only part of stage 2 that would need a model, and the run above did none of it |
| 2 | **Code matches each target to a listing, and the rule is strict enough to be trusted unchecked** (§4) | Letting a model choose or re-check listings | The model re-searched and chose worse than code (§1). With no model behind it, the matcher is the only check, and today's rule passes wrong products (§4.1) |
| 3 | **The stage-2 packet is computed, and its contract fits a fixed set of pulls** (§5): status by rule, no saturation curve, gaps computed and allowed to be empty | Keeping stage 1's done-is-saturation rule and non-empty gap rule for stage 2 | Saturation measures when searching stops yielding; stage 2 does not search. The non-empty gap rule exists to stop an agent inventing completeness; there is no agent |
| 4 | **Amazon listings are found in stage 1** (§3a): code looks up and matches every competitor's listing when a stage-1 run ends, the Competitors tile shows each competitor's website and Amazon link. **Every target, champion or competitor, is mined from Amazon if it has a matched listing, and from Trustpilot (its own domain) only if it does not.** A target with neither does not appear in stage 2 | Looking listings up when the stage-2 plan opens (today), and listing unmatched targets there in amber. (Superseded the same day: "a competitor with no Amazon listing does not appear in stage 2 at all", replaced by the Trustpilot fallback at your request; and a draft that pulled Trustpilot for every target and kept it out of `complete`, which overcomplicated it) | Decided with you, 2026-09-29. Whether a competitor is on Amazon is a fact about the market, so it belongs with stage 1's record. A competitor sold only on its own site still has customers, and Trustpilot is where their reviews are |

## 3. The pipeline

Started exactly as today (`POST /runs` with `nodes: ["review_mining"]` and the
ticked `targets`, gated on a completed stage-1 run). `RunLauncher` hands a stage-2
run to a `ReviewMiningJob` instead of `RunAgentFactory`.

1. **Targets.** Every target stage 2 offers (§3a): the champion and each
   competitor with a matched Amazon listing, a Trustpilot domain, or both,
   filtered to the ticked ids.
2. **Listings.** The ones stage 1 found and matched (§3a), read from
   `research_target_listings`. If stage 1's lookup never ran (no token then, or a
   stage-1 run from before this change), `StageTwoListings.ensure` runs it now,
   with the same matcher.
3. **One listing, one target.** Two different targets cannot be the same Amazon
   listing, so two targets resolving to the same (store, ASIN) means the matcher put
   at least one of them on the wrong product. **Neither is mined for it.** Both
   become a gap ("listing `<url>` matched both c15 and product — not mined"), and
   the plan screen shows the collision before the run. The reviews are never filed
   under two targets. (Superseded the same day: "each listing is mined once, both
   targets cite the same pulls", which would have hidden exactly this error.)
4. **Trustpilot domains.** Only for targets with no matched Amazon listing (§3a).
   The host of the
   target's own `url`, `www.` stripped, **only when the host carries the target's
   brand** (the same letters-and-digits
   comparison `BrandLabels`/`Names.squash` already do). A retailer page
   (`chemistwarehouse.com.au` for Wanderlust) gives no domain. The champion's
   domain is the brief's host. Each domain is pulled once.
5. **Pull.** The existing pull logic of `mine_reviews`, lifted out of the tool into
   a `ReviewPuller` class: every listing at the five star bands, one Trustpilot pull
   per domain, through the shared Apify queue (§7 of `spec-context-subagents.md`),
   filed in job order into `ReviewLedger`.
   A pull that fails is retried as §3b says.
6. **Save.** `ReviewLedger.saveTo` as today (`research_reviews`,
   `research_run_reviews`).
7. **Packet** (§5), validated by `PacketValidator` as today, stored with
   `packet_source = "pipeline"`.

What the cockpit sees: `run.started`; a `tool.started` / `tool.completed` pair per
pull in the fetch lane, so progress shows as it does now; `apify.charged` per actor
run; `reviews.saved`; `packet.ready`; `run.completed`. No LLM calls, so the run's
`usage` has no tokens and no billed model cost; Apify spend is in the events as
today.

**Stop** aborts the pulls in flight (they already take an `AbortSignal`); the run
is `cancelled`, and whatever was pulled is saved. **A restart** mid-run is
`failed`, as `recover()` does today.

## 3a. Amazon listings are stage 1's

**When a stage-1 run that covers `competitors` completes**, code — not the agent —
runs the listing lookup over its roster (`StageTwoRoster.of(packet)`: the champion
and every competitor): one Amazon search per target in that target's store
(`StageTwoListings.marketplace`), then the matcher (§4). It is the lookup the
stage-2 plan screen runs today (`POST /stage2/listings`, cached per stage-1 run in
`research_target_listings`), moved to the end of stage 1.

- **Cost:** about $0.01 of Apify per target (`FEATURE_MAP.md`, the stage-2
  go-ahead), so about $0.23 for run `99002ee8`'s 23 targets. **Every stage-1 run
  with `competitors` now spends this automatically**, on top of the agent's own
  `amazon_find_product` calls; it shows as `apify.charged` events on the stage-1
  run.
- It runs after the packet is accepted and before the run is marked `completed`,
  through the shared Apify queue. It does not change the packet. An `invalid` or
  `failed` run gets no lookup: stage 2 is gated on a completed stage 1 anyway.
- A lookup that fails, or no `APIFY_TOKEN`, does not fail the run: the tile says the
  Amazon lookup was unavailable, and the plan screen can run it later as today.
- **The Competitors tile** shows, for each competitor, its website (the page stage
  1 read, `competitor.url`) and either its matched Amazon listing, as a link, or
  "not on Amazon" with the matcher's reason. The listings are served with the run.

**What stage 2 then offers — one rule for the champion and every competitor**
(decided with you, 2026-09-29):
- **A matched Amazon listing:** mined on Amazon, at all five star bands.
- **No matched listing, but its own domain** (§3 step 4: the host of its own site,
  carrying its brand; for the champion, the brief's host): mined on Trustpilot
  instead — the only customer voice there is for a brand sold on its own site.
- **Neither** (no matched listing, and only a retailer page, like Wanderlust's
  `chemistwarehouse.com.au`): not listed in the stage-2 plan and not mined. It stays
  in stage 1's packet and tile.
- On run `f1b67523`'s brief the champion gets Trustpilot: its Amazon search
  returned Nature's Answer, which fails **brand**.
- What Trustpilot holds: the company's page (`trustpilot.com/review/<domain>`),
  reviews of the company. They are about the product sometimes and about delivery
  or refunds often: 1 of 4 on `avogel.co.uk` in run `f1b67523` was about the
  product, and `spec-review-mining.md` §5.8b found the same on `huel.com`. In that
  run `mullevia.com` and `herb-pharm.com` returned none.
- The amber "another brand" rows on the plan screen go: an unmatched target is no
  longer shown there.

## 3b. When a pull fails — one retry, for transient failures only

Decided with you, 2026-09-29. Today the only retry of a failed pull is the agent
calling `amazon_reviews` or `trustpilot_reviews`; with no agent, the pipeline does
it. `apify-client` (2.25.0) already retries each HTTP request to Apify up to 8
times (network errors, 429, 5xx; `maxRetries = 8`, from 500 ms) — that covers the
connection to Apify, not an actor run that failed, and stays as it is.

Each pull ends in one of these, and the adapters (`adapters/apify/amazon-reviews.ts`,
`trustpilot-reviews.ts`, `runner.ts`) report which as a typed outcome rather than
only a gap string:

| Outcome | Seen as | Retry |
|---|---|---|
| **Absent** | `no_relevant_reviews_found`, or rows with no review text — the band has no written reviews | **None.** A true answer; it is a gap |
| **Transient** | the call throws after the client's own retries; or the run ends `FAILED`, `TIMED-OUT` or `ABORTED` with an empty dataset | **Once**, after 10 s, as a new actor run. A second failure is a gap naming both errors |
| **Still running** | the run is `RUNNING` when the wait (`MRA_APIFY_WAIT_SECONDS`, 300) ends | **Once**, by waiting again on the **same** actor run (`apify-client`'s `run(id).waitForFinish`), which starts nothing new and is not charged again |
| **Out of credit** | Apify 402 | **None**, and no further pull starts in this run: each remaining one is a gap saying the account is out of credit |

- The count is a setting, `MRA_APIFY_PULL_RETRIES`, default **1**.
- **Cost:** a transient retry starts a new actor run and is charged again. Run
  `f1b67523`'s Amazon pulls cost $0 to $0.25 each (its `apify.charged` events), so
  a retry at most doubles the cost of the pull that failed, and only for failures.
- The cockpit shows a retried pull as a second `tool.started`/`tool.completed`
  pair for the same target and band, and the trace records both attempts.

## 4. The matcher

### 4.1 What today's rule passes

`ListingMatch.mismatch` (`agent/listing-match.ts`) accepts a listing when the brand
matches and the title names **no other** form. It never asks whether the listing
is this product. On the roster in §1, from `research_target_listings`:

| Target | Is | Matched to | Why it passed |
|---|---|---|---|
| c15 | Nature's Answer *Mullein-X Throat Spray* | "Nature's Answer Mullein Leaf Herbal Supplement - 1oz" (a liquid) | brand matches; the title names no form, so "no other form" holds |
| c16 | A.Vogel *Mullein & Marshmallow Spray* | "A.Vogel **Sinuforce Nasal Spray** + Menthol" | brand and form match; no mullein in it |
| c17 | Gaia *Mighty Lungs* | "Gaia Herbs **Sinus & Lung Supreme**, 60 Vegan Capsules" | brand and form match; a different product |

### 4.2 The rule

A listing matches a target only when all three hold:

1. **Brand** — as today.
2. **Active** — the title names at least one of the target's actives
   (`MiningTarget.actives`).
3. **Form, named** — the title names the target's form. For `liquid`, a volume
   (`ml`, `fl oz`, `oz`) counts as naming it. A title that names no form is **not**
   a match for any other form.

A rejection keeps its reason (`brand`, `active`, `form`) in
`TargetListing.mismatch`, and the plan screen already shows it.

Against the 23 listings above (the champion and 22 competitors): c15 fails **form** (no "spray"), c16 and c17 fail
**active** (no "mullein"); c5, c7, c9, c11, c12 and the champion already fail
**brand**. c1, c2, c3, c4, c6, c8, c10, c13, c14, c18, c19, c20, c21 and c22 still
pass. That table is the matcher's regression test.

## 5. The packet

| Section | Built from |
|---|---|
| `brief` | the run's brief |
| `sources`, `excerpts` | `ReviewAssembly`, unchanged: one source per pull, one excerpt per review, verbatim |
| `measurements` | per pull, `written_reviews_total` and `ratings_total` when Apify returned them, citing the pull |
| `nodes` | one `review_mining` entry: **`complete` when every mined target has at least one 3★ review**, else `incomplete`, with `why` naming the targets without one |
| `gaps` | computed: a listing two targets collided on, a failed pull, a band the tools reported empty, a target with no Trustpilot domain. **May be empty** |
| `saturation` | none |

Validator changes, stage 2 only: `CompletenessCheck` no longer requires a
saturation curve for a complete `review_mining`, and no longer fails an empty gap
list. The 3★ rule, scope, citations and the schema stay. A packet the validator
refuses is now a bug in this code, not a model's mistake; it is still stored as
`invalid` with the problems, because that is what happened.

## 6. What this retires, and what stays

**Retired:**
- the stage-2 agent path: stage 2's prompt (the `review_mining` node rules, the
  roster block and its text, the brief block's stage-2 use), and the stage-2 use of
  the `record_*` tools and `finish`;
- `mine_reviews`, `amazon_reviews` and `trustpilot_reviews` as agent tools, and
  their lines in the system prompt. That also removes the bug where a whole
  stage-1 run was told about review tools it did not have (run `99002ee8`);
- `ReviewRendering`'s model-facing text; its archiving and ledger filing move into
  `ReviewPuller`.

**Superseded:** `spec-context-subagents.md` §11, "Stage 2 uses the ledger too".
The phase-1 ledger path stays for stage 1.

**Stays:** `amazon_find_product` (stage 1's competitors node uses it), the review
ledger and `ReviewAssembly`, `StageTwoListings` and the plan screen with its cost
estimate, the reach and cost facts in `spec-review-mining.md`, and the review
analysis job that runs on stored reviews.

## 7. Build and check

Tests, with a scripted Apify runner and a model provider that fails any call:
- a completed stage-1 run with competitors runs the lookup once per target and
  stores the matches; an `invalid` one does not; a lookup failure leaves the run
  `completed`;
- a target with a matched listing is mined on Amazon and not on Trustpilot;
- a target, champion or competitor, with no matched listing but its own domain is
  mined on Trustpilot;
- a target with neither is absent from the stage-2 plan and from the mined pulls;
- the matcher table in §4.2;
- a roster mines only matched listings;
- two targets resolving to the same (store, ASIN) mine nothing for it, and both
  get a collision gap;
- an unmatched ticked target becomes a gap with its reason and title;
- Trustpilot pulls only brand-owned hosts, each once;
- the packet validates; `complete` exactly when every mined target has a 3★ review;
- a transient failure is retried once and then succeeds, or fails and becomes one
  gap naming both errors; an absent band is not retried; a run still running at
  the wait is waited on again without starting a new one; a 402 stops the pulls
  not yet started and gaps them;
- Stop mid-run ends `cancelled` with the pulls so far saved;
- no model is called.

Then one real run. **It spends Apify money**, so it is agreed with you and priced
first from the plan screen's estimate; one small roster is enough.

## 8. Open questions

- **Overriding a listing.** A competitor the matcher rejected now disappears from
  stage 2 (§3a). Should you be able to supply its listing by hand in the
  Competitors tile, so it comes back?
- **Review analysis afterwards.** Whether a completed stage-2 run should start the
  review analysis job by itself.

---

## 9. Decided while building

- **The stage-1 lookup runs right after `completed`, not before.** §3a said before;
  an Apify search can wait up to 300 s, and the run's status must not wait on it.
  The run stays live until the lookup ends, and `packet.listings {total, matched}`
  makes the cockpit re-read the run, so the Competitors tile fills in seconds later.
- **A powder is named by its weight, as a liquid by its volume** (`g`, `gm`, `kg`,
  `lb`). The creatine run's "Switch Nutrition Purest Creatine 500gm Unflavoured"
  names no form word; without this §4.2 would have rejected a correct match.
- **An active is named when any word of it of four letters or more is in the
  title**: "creatine monohydrate" is named by "creatine". Titles rarely spell the
  full compound.
- **A stored verdict is re-judged on every read** (`StageTwoListings.judged`, used
  by the plan route and `GET /runs/:id`), and the new verdict saved. Without it, run
  `99002ee8`'s rows, matched under the old rule, would have offered c15, c16 and c17
  on the wrong products.
- **A target in a collision falls back to Trustpilot** if it has its own domain, and
  otherwise stays listed with its note so the gap is recorded.
- **Waiting again on a still-running actor run happens inside `ApifyActorRunner`**,
  with the same count as the pull retry (`MRA_APIFY_PULL_RETRIES`).
- **The plan returns `offered`** (everything stage 2 can mine) separately from
  `targets` (the approved subset the estimate prices), and the plan screen lists
  `offered`.
- **A stage-2 run records no model** (`model: ""`), and `RunSupervisor.steer`
  refuses it: there is no agent to steer.
- `StageTwoRoster` now gives the champion the brief's url, so it has a store for
  its lookup and a domain for Trustpilot.
- **The plan shows each Trustpilot-mined target's Trustpilot score and review
  count** (decided with you, 2026-09-30), so you can see whether a pull is worth
  it. Read in the same lookup as the Amazon listings, right after it, and only for
  targets that will be mined on Trustpilot. Route: Firecrawl reads
  `trustpilot.com/review/<domain>` (1 credit each; it passes Trustpilot's
  JavaScript challenge, which a plain fetch does not, `spec-review-mining.md`
  §2.1), and `TrustpilotProfiles` parses the company's own header — the page also
  lists other companies' scores. Measured 2026-09-30: huel.com 4.2 from 29,447
  reviews; herb-pharm.com 0 reviews; mullevia.com has no Trustpilot page. Stored
  on the listing row (`trustpilot`), no new table. The plan screen asks for a
  lookup when a Trustpilot-mined target has no score yet, which fills older runs
  at a cost of Firecrawl credits only.
- Retired with the agent path: `mine_reviews`, `amazon_reviews`,
  `trustpilot_reviews`, `ReviewRendering`, `RosterBlock`, the roster text, the
  `review_mining` prompt rules, `StageTwoListings.withAmazon`,
  `StageTwoRoster.amazonListing`, and the review ledger on the stage-1 path.
