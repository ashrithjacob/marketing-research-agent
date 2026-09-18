# Stage 1 — what's left to deliver

Status: 16 September 2026. Effort in hours, rough.

## Where the four areas stand

| Area | Status |
|---|---|
| Product data | Collecting. One change left. |
| Competitors | Collecting. Cannot yet tell direct from indirect. |
| Review mining | **Thin.** Amazon's top 10 are reachable; the rest needs a sign-in. |
| Category data | Collecting. Measuring the wrong thing in places. |

## Product data

| To deliver | Hours |
|---|---|
| Record each active ingredient separately — name, dose, unit | 1 |

Today the ingredient panel is stored as one block of text. Competitor matching and demand both key off the individual ingredient, so both shrink to brand-name research without this.

## Competitors

| To deliver | Hours |
|---|---|
| Label each competitor direct or indirect (same active + same form / different form) | 1 |
| Stop searching each group separately, so a full direct list can't end the indirect search | 1 |

Not included: testing whether I can read competitor ad libraries — the record of which ads a rival runs, and for how long. Roughly 2 hours, and it may return nothing, so it sits outside this estimate. Worth doing once the rest lands.

## Review mining

**What I can read today, tested 16 September:**

| Source | Today |
|---|---|
| Amazon product page | The reviews Amazon shows there — **10 to 17 per product**, free |
| Amazon review pages (all reviews, filter by star) | Needs an Amazon account — it's a sign-in page, not a payment page |
| Reddit | Blocked — refused both by my reader and by Reddit itself |
| Trustpilot | Blocked **from my server only** — its host bans data-centre addresses. Fine from a normal connection |
| YouTube | Video descriptions only, not comments |

Reddit and Trustpilot are both free to read. Neither is blocked because the data is protected — they block the kind of address my server has.

**The Amazon limitation.** Nothing on Amazon costs money. The reviews on a product page are free but they are Amazon's pick, not mine — measured on two products: one gave 17 reviews (14 of them 5-star), the other gave 10 (6 of them 5-star). They skew positive, and I cannot ask for a particular star rating there.

The full review list, including the 3-star filter, asks me to sign in. An account is free to create, but signing in automatically to collect reviews goes against Amazon's terms, and the account is what they would close.

One more thing worth knowing: the same product page sometimes returns its reviews and sometimes returns none, depending on how long I wait for it to load. The reader has to check that reviews actually arrived and try again when they didn't.

| To deliver | Hours | Cost |
|---|---|---|
| Amazon top 10 reviews — read the product page, store each review with its star and date, retry when none load | 1 | Free |
| Amazon 3-star reviews — experiment driving a real browser, signed in, to reach the star-filtered pages | 3 | Free to try, may fail |
| Reddit access | 2 | Free, official |
| Trustpilot review text — reader, plus a connection its host accepts | 2 | Free, see decision 2 |

**My recommendation:** take the top 10 now and let me spend 3 hours on the browser experiment. If it fails, I'll come back to you with the options rather than spending further.

## Category data

| To deliver | Hours |
|---|---|
| Measure search volume on the active ingredient, not the brand (needs the product-data item) | 1 |
| Require a 3-year trend instead of a single month | 1 |
| Require currency and region on market-size figures; date-stamp Amazon sales figures | 1 |

## Totals

| | Hours |
|---|---|
| Total work | ~14 |

## What I need from you

1. **Should I run the signed-in browser experiment?** It's the only route to the 3-star reviews, and it uses an Amazon account against Amazon's terms — that account risks being closed, so I'd use a throwaway, never a business account. If you'd rather I didn't, I'll take Amazon's top 10 and state that limit in every report.
2. **How should I reach Trustpilot?** Reading it costs nothing, but their host refuses my server's address. Either a small proxy subscription (a few pounds a month) or I run that one step from an ordinary connection. I need your preference here, not your budget.
