# Stage 1 — what's left to deliver

Status: 18 September 2026. Effort in hours, rough.

> **Updated 18 September.** The 16 September version said 3-star reviews needed a
> signed-in browser experiment and that Trustpilot was blocked. Both were settled on
> 17 September by buying access through Apify, a service that runs the page readers
> on its own connections: Amazon (including by star rating) and Trustpilot are now
> both reachable. The two questions that version asked you are answered below, and
> one new one replaces them.

## Where the four areas stand

| Area | Status |
|---|---|
| Product data | Collecting. One change left. |
| Competitors | **Done: direct and indirect, tested on a real run.** Ad libraries not yet attempted. |
| Review mining | **Built, not yet tried on a real run.** Amazon by star rating and Trustpilot are connected and tested piece by piece. |
| Category data | Collecting. Measuring the wrong thing in places. |

## Product data

| To deliver | Hours |
|---|---|
| Record each active ingredient separately — name, dose, unit | 1 |

Today the ingredient panel is stored as one block of text. Competitor matching and demand both key off the individual ingredient, so both shrink to brand-name research without this.

## Competitors

**Delivered 18 September.** Each competitor is now labelled **direct** (same active ingredient, same form — another mullein capsule against a mullein capsule) or **indirect** (same active, different form — mullein drops, a spray, a tea or a gummy). The label isn't the AI's opinion: the system checks it against the two products' forms and rejects a run that gets it wrong. A brand that treats the same problem with a *different* ingredient is listed as a gap, not as a competitor.

The two groups are also searched separately, so a long list of direct competitors can't end the search before the indirect ones are found.

**Tested on a real run** (Mullein, UK, competitors only): 5 direct and 8 indirect competitors, each with its price, dose and its own marketing line word for word. It cost about 9 cents (3 for the AI, and about 6 for one Amazon search at Apify's listed price) and took under 7 minutes. Both groups were still turning up new brands when it stopped, and the report says so rather than calling the list complete.

**One thing that matters for you:** name a specific product in the brief, not just an ingredient. "Mullein" left the system to pick one mullein capsule to compare against, and every direct/indirect label follows from that choice. "Nutravita Mullein drops" would have made the capsules indirect and the drops direct.

| To deliver | Hours |
|---|---|
| ~~Label each competitor direct or indirect~~ | done |
| ~~Search each group separately~~ | done |

Not included: testing whether I can read competitor ad libraries — the record of which ads a rival runs, and for how long. The first run found no ad-library entries for any mullein brand. Roughly 2 hours, and it may return nothing, so it sits outside this estimate.

## Review mining

**What changed.** Amazon and Trustpilot both refuse my server's address, and no free workaround reached Amazon's full review list. So both now go through Apify, which I pay per review collected. Tested on 17 September against real products for $0.41 in total.

**What I can read now:**

| Source | Now |
|---|---|
| Amazon reviews | **Yes, one star rating at a time** — including 3-star, which is the one that matters. Each review is kept word for word with its star, date and whether the purchase was verified |
| Choosing the Amazon product | The agent searches Amazon by product name and picks the listing with the most reviews, not the first result. Picking badly was the problem before: my hand-picked listings had 2–14 reviews, the right ones had 41–61 |
| Trustpilot | **Yes.** These reviews are about the *seller* — delivery, support, refunds — not the product, so they are kept separate from product reviews and never counted in their place |
| Reddit | Out of scope, decided 17 September |
| YouTube comments | Out of scope, decided 16 September |

**One thing to expect.** In supplements, many more people leave a star rating than write a review. One product had 61 ratings and 28 written reviews, and not one of the written reviews was 3-star. When that happens the report says so plainly — "no 3-star reviews with text" — rather than filling the space with 2- or 4-star reviews. That is a true answer about the product, not a failure.

**What's built so that a failure isn't reported as a finding.** If Apify runs out of credit, the report says it's a billing limit, not "no reviews". If Apify comes back empty, that's recorded as a gap, not as proof the product has no reviews. And if a star filter returns the wrong stars, those rows are thrown away.

| To deliver | Hours | Cost |
|---|---|---|
| First full run with the review sources switched on, checked against what the spec asks for | 1 | Under $1 of Apify per product (see decision 1) |
| Search the right Amazon for the market — today it always searches amazon.com, even for a UK brief. The competitors run hit this too: its Amazon results were US listings | 1 | — |

## Category data

| To deliver | Hours |
|---|---|
| Measure search volume on the active ingredient, not the brand (needs the product-data item) | 1 |
| Enforce the 3-year trend — the agent is told to find one, but nothing yet rejects a run that returns a single month | 1 |
| Require currency and region on market-size figures; date-stamp Amazon sales figures | 1 |

## Checks on the whole report

Two checks the specification requires that aren't built yet. Until they are, the report is only as good as the model's honesty.

| To deliver | Hours |
|---|---|
| Confirm every quote actually appears, word for word, in the page it cites | 2 |
| Treat a "checking your browser" block page as a failed read, not as a source | 1 |

## Totals

| | Hours |
|---|---|
| Total work | ~9 |

The 16 September estimate was ~14. The review-mining items (8 hours) came out, because Apify replaced the browser experiment, Reddit and the Trustpilot reader. The two new review-mining items (2 hours) and the two checks above (3 hours) went in. The two competitor items (2 hours) are now done.

## Decisions

**Answered since 16 September:**

1. ~~Should I run the signed-in browser experiment?~~ **No longer needed.** Apify reaches Amazon's star-filtered reviews without an Amazon account, so no account is at risk.
2. ~~How should I reach Trustpilot?~~ **Through Apify**, alongside Amazon — one supplier instead of a proxy plus a separate reader.

**What I need from you now:**

1. **Which Apify plan?** We're on the free plan: $5 of use a month, and at most 10 reviews each time I ask for one star rating on one product. Estimated from Apify's prices (not yet measured on a full run), one product across all five star ratings plus Trustpilot comes to roughly $0.40–$0.70. That's a handful of products a month. The spec's minimum is 10 reviews per product, so the free plan meets it, but with no room to spare within any one star rating. A paid plan raises both limits. I'd rather make this call after the first full run shows how many reviews we actually get, so my suggestion is to stay free until then.
