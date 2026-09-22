# Stage 1 — the changes to make

Status: 21 September 2026. Effort in hours, rough. Costs are measured unless marked
otherwise.

> Read alongside `stage1-client-status.md` (18 September), which lists the work that
> was already outstanding. This document covers only what changed on 21 September and
> what each change costs.

## The work, in one table

| You asked for | Where it stands | Hours | Extra cost |
|---|---|---|---|
| Thousands of real reviews per product, consistently | Today's floor is **10**. Needs a paid Apify plan | 3 | ~$6 per 1,000 reviews |
| Reviews from the near-name products on Amazon too, as many from each | Today only **one** listing is read | 3 | ~$6 per extra listing |
| Review mining as step 2, started after you confirm stage 1 | **The split is done.** The confirm button is not | 2 | — |
| USA only | Five markets are ticked by default today | 1 | — (saves money) |
| The cockpit: more to see, less to read, reasoning on the logs page | Today the middle column is a wall of streamed prose | 1 | — |
| First full run end to end, checked against the spec | | 1 | ~$25 of Apify |
| Tests, so none of the four can quietly stop working | | 2 | — |
| **Total** | | **~13** | **~$25 per product per run** |

---

## 1. Thousands of real reviews per product, not ten

**Today.** The specification asks for at least ten reviews per product and the system
is built to that number. It is capped there twice over: my own setting stops each
request at ten, and Apify's free plan refuses more than ten reviews and more than one
product per request whatever I ask for.

**What changes.** The target becomes thousands of real reviews per product, gathered
across the main listing and the near-name listings in change 2. The agent keeps
pulling star band by star band and listing by listing until the listings are exhausted
or the run's budget is, and the report carries the count as a number — how many
reviews, from which listings, from which star ratings — so "did we get enough" is
something you read rather than something you trust.

**What "real" means, precisely.** A review counts only if it has written text — a bare
star rating is not a review, and most ratings have no text. It must be on the listing
for this product; recycled Amazon listings keep the reviews of whatever was sold there
before, and those are thrown out. And the same review appearing on two of the
near-name listings is counted once, not twice. Those three rules are why the number in
the report will be smaller than Amazon's own review count, and smaller is the correct
answer.

**The honest part.** Thousands only exist where the listings are big. The four
products measured on 17 September had between 2 and 61 reviews each — for a product
like those, thousands is not a target I can hit, and no amount of budget changes that.
For a mainstream product with large listings it is straightforward, and the near-name
listings in change 2 are what carry it over the line. When the set comes to 340
reviews, the report says "340 reviews across four listings" and treats the shortfall
as a gap. It does not pad the number with text-free ratings, and it never counts
Trustpilot reviews toward it, because those are about the seller's delivery and
refunds rather than the product.

**What this costs.** Almost all of it is the Amazon reader. These are Apify's prices,
read off its public store listing on 17 September and corroborated by real charges on
the runs that day: the five-run spike billed $0.41 in total, and a single error record
billed exactly $0.006.

| Source | Price | Per 1,000 |
|---|---|---|
| Amazon reviews (`junglee/amazon-reviews-scraper`) | $0.006 per review | **$6.00** |
| Trustpilot reviews (`memo23/trustpilot-scraper-ppe`) | $0.00075 per review + $0.05 per request | **$0.80** |

So 1,000 Amazon reviews is $6, and four listings of 1,000 is about $25 a product —
roughly ten times the figure in my 18 September note, spent per run. Trustpilot is
eight times cheaper and is not where the money goes.

**The $6 is the free-tier price.** Apify prices by *your plan*, not by how much you
buy. The $0.006 above is the free column; the top tier is recorded at $0.001 a review,
which is $1.00 per thousand. At 4,000 reviews a product that is the difference between
$24 and $4. When the floor was ten reviews the tier did not matter; at thousands it is
the largest single lever on the bill, which makes it the same decision as "which
plan". I have not run a paid tier, so treat the cheaper column as a quoted price
rather than a measured one, and the tiers in between are not recorded at all.

**The new guard this needs, and how it is set.** Today nothing stops a run from
spending: each request is capped on its own, but there is no ceiling across a whole
run. At ten reviews a request that did not matter; at thousands it decides the bill,
so a per-run spend ceiling goes in with this change — the run stops and reports what
it got, rather than running to the end of the Apify balance.

**Decided 21 September: the budget stays flexible**, so the ceiling is a setting
rather than a number baked into the code. It starts conservative, it is visible on the
run, and it moves in one place once the first run shows what a product actually
yields. A run that stops on the ceiling says so — "stopped at the spend ceiling with
1,240 reviews" — which is a different statement from "this product has 1,240
reviews", and the report keeps them apart.

**The free plan is now out of the question.** It gives $5 a month and ten reviews a
request. One product at 4,000 reviews is five months of that allowance and 400
separate requests. **A paid plan is required**, and the tier is decision 1 below.

| To deliver | Hours |
|---|---|
| Raise the per-request cap and loop bands and listings until the listings or the budget run out | 1 |
| Drop text-free ratings, off-product reviews and duplicates across listings | 1 |
| A per-run spend ceiling as a setting you can move, and coverage in the report: reviews captured, per listing, per star band | 1 |

## 2. The near-name products on Amazon

**Today.** The agent searches Amazon for the product name, sorts what comes back by
review count and reads **the single most-reviewed listing**. That was a deliberate fix
on 18 September — listings picked by hand had 2 to 14 reviews while the resolver found
41 to 61 — but it throws away everything else it found.

**What changes.** The agent keeps the whole set: the same product sold under a
slightly different name, a different brand, a different pack size, a relisting. It
reads reviews from each of them, most-reviewed first, down to a cut-off.

**Each listing stays labelled.** Every review keeps the listing it came from — name,
ASIN, review count — so the set can be read as one pool or one listing at a time, and
a single dominant listing cannot quietly speak for the product. This matters because
recycled Amazon listings keep the reviews of whatever was sold there before; keeping
them separate is what makes that visible instead of blended in.

**What it costs.** Roughly $6 per extra listing at 1,000 Amazon reviews each, on the
free tier — $1 on the top tier. Four listings per product is about $24 of Amazon
reviews, and that is almost all of the ~$25 per product in the table above. How many listings to read, and how deep into each, is a
money question rather than a technical one, so it is decision 2 below.

| To deliver | Hours |
|---|---|
| Keep the candidate listings instead of one, and match them on name and ingredient | 1 |
| Read reviews from each, and attribute every review to its listing | 1 |
| Count coverage per listing, so a shortfall names which listing was thin | 1 |

## 3. Review mining is step 2, after you confirm step 1

**Mostly delivered, 21 September.** Review mining was the fourth part of stage 1. It
is now **stage 2, on its own**, and stage 1 is three parts: product data, competitors,
category data.

The reason is that review mining is unlike the other three. It is the only one that
spends money, and the only one a product can be structurally unable to satisfy — no
Amazon listing, no Trustpilot profile, nothing to read. Bundled in, one dead review
step marked the whole stage-1 report invalid, and a product with no reviews could not
produce a stage-1 report at all. Split, a thin review result says something true about
that product and nothing about whether the rest of the research was any good.

The order also reads the way the work happens: describe the product, its competitors
and its category first, then go and listen to customers about the listings you found.

**Already working:** stage 2 is refused until a stage-1 run for the same product has
finished. Asking for it early returns a plain message saying to run stage 1 first.

**What is left.** That gate opens by itself the moment stage 1 finishes. You asked for
it to open when *you* confirm, which is a different thing — stage 1 finishing does not
mean stage 1 is right, and stage 2 spends money on the listings stage 1 chose. So:
stage 1 completes, you read it, you press confirm, and only then will stage 2 start.
A rejected stage 1 is re-run instead.

| To deliver | Hours |
|---|---|
| A confirm step on a finished stage 1, and stage 2 gated on it rather than on completion | 2 |

## 4. USA only

**Today.** The start form ticks five markets by default — US, UK, Australia, New
Zealand, Canada — and the agent researches all of them. Amazon, meanwhile, is always
searched on amazon.com regardless. On a UK brief that mismatch was a bug on the 18
September list: UK product, US listings.

**What changes.** The US is the only market ticked, and it is the default rather than
the only option — **decided 21 September: US only for now**, so the other four stay in
the list, unticked, ready for the day the UK comes back. The bug disappears rather
than getting fixed, because amazon.com is now the right Amazon to be searching. A
source from another market is recorded as a gap naming the market, not quietly used in
place of a US one.

**This makes the other changes cheaper.** Four markets' worth of competitor and
category searching comes out of every run, and the review budget goes to depth on US
listings instead of breadth across countries.

| To deliver | Hours |
|---|---|
| Default the brief to the US alone, keep the other markets available, and gap non-US sources rather than admitting them | 1 |

## 5. The cockpit: more to see, less to read

**Today.** The middle of the screen is the agent talking. Its narration streams in
line by line, and underneath sit four flat lists — every source, every attribute,
every measurement, every gap, one row each. It reads like a transcript, which is
useful when you are debugging the agent and tiring when you want to know whether the
run is going well. At ten reviews a run that was survivable. At four thousand it is
not: the one number you will want — how many real reviews do we have — would be
somewhere in a scroll of prose.

**One hour, and what it buys.** This was scoped at ten hours; you asked for one. One
hour is real, and it buys a thin version of all three things you asked for rather than
one of them finished. It works because most of it is rearranging what already exists.

| In the hour | Why it is cheap |
|---|---|
| **Reviews captured, with a bar per star rating**, and the 3-star band marked | The counts come from the coverage field change 1 already adds; this draws them |
| **The narration cut to one live line** — *reading listing 2 of 4, 1,240 reviews so far* | The full text already exists on the logs page, so nothing is lost by hiding it here |
| **The four long lists collapsed** to a heading with a count, opened when you want them | Wrapping sections that already render |
| **Apify spend shown beside the model cost** in the header | Change 1's spend ceiling already has to total the spend; this prints it |

**What that leaves out, named so it is not quietly lost:**

| Deferred | Hours |
|---|---|
| A card per listing — what each contributed, which were dropped for being thin | 2 |
| The spend meter drawn against its ceiling, and the stopped-on-ceiling state | 1 |
| Gaps as chips rather than paragraphs | 1 |
| Logs page: reasoning shown on its own, and paired with the tool call it led to | 2 |

**Reasoning moves to the logs page — this part needs no hours.** The logs page already
holds every model call: what was sent, what came back, the thinking, the tokens and
the cost, in its own tab so it can sit open beside the cockpit. Making it the only
home for reasoning is subtraction from the cockpit, not addition to the logs page.
What is deferred above is the *nicer* version — reasoning paired with the tool call it
produced. The plain version, all of it in one place, arrives in the hour.

The split is the point. **The cockpit is for watching. The logs page is for asking
why.** Today they overlap, and the overlap is what makes the cockpit long.

**Saturation curves stay.** They already exist in the stage rail and they are the one
visual that earns its place: a curve that flattens is a node that stopped finding new
material. Nothing replaces them.

| To deliver | Hours |
|---|---|
| The four items in the table above | 1 |

The confirm button in change 3 and the market default in change 4 are also UI, and
their hours are already counted there rather than here.

**One caveat about testing.** The two hours below buy tests for the server's
behaviour. The cockpit has no test runner — it is checked by its type checker and by
eye — so UI changes are verified by looking at them on a real run. That is worth
knowing when you read "tested".

## Tests

Every behavioural fix in this system carries a test that fails if the behaviour ever
goes away, and these four are no exception. Concretely: a run that captures 40 reviews
cannot report the review node as complete when thousands were asked for; a text-free
rating counted as a review fails the build, as does a product whose alternate listings
are ignored; a stage-2 run started before stage 1 is confirmed is refused;
and a brief outside the US is gapped rather than researched.

Two hours. It is the cheapest of the six items here and the reason the other five stay
delivered after the next change lands on top of them.

## Still outstanding from 18 September

Unchanged by any of the above, and still needed:

| To deliver | Hours |
|---|---|
| Record each active ingredient separately — name, dose, unit | 1 |
| Measure search volume on the active ingredient, not the brand | 1 |
| Enforce the 3-year trend; require currency and region on market-size figures | 2 |
| Confirm every quote appears word for word in the page it cites | 2 |
| Treat a "checking your browser" block page as a failed read, not a source | 1 |

## Decided, 21 September

| | Decision |
|---|---|
| **How deep per product** | **The top four listings only**, ranked by review count, dropping any with fewer than ten. Four is a ceiling, not a quota. |
| **Geography** | **US only for now.** The other four markets stay in the list, unticked, rather than being removed. |
| **Budget** | **Flexible.** The spend ceiling is a setting, starting conservative, moved once the first run shows the real yield. |

## The one thing still open

"We will see how many reviews we get" needs a run to see it with, and **that run cannot
happen on the free plan.** Ten reviews a request and $5 a month is not a small version
of thousands of reviews; it is a different thing entirely, and a measuring run on it
would tell us only what the free plan's ceiling is.

So one step has to come before the measurement: moving off the free plan onto the
cheapest paid step that lifts the ten-review cap. That is a billing action on your
side, not a build item on mine.

What protects you while the budget is flexible is the ceiling above. It is built
before the first paid run, not after, so the worst case is a run that stops early and
says why — never an invoice nobody expected.

**What I will bring back from that first run:** what 4,000 reviews across four
listings actually cost, how many of them were real written reviews rather than bare
ratings, and how much the top tier would have saved at that volume. The plan decision
is then made against measured numbers instead of a price list.

## Assumed unless you say otherwise

- 1,000 reviews per listing as the starting depth, so four listings is roughly 4,000.
- The spend ceiling starts at $30 per run — about one product at free-tier prices,
  and a number that stops a bug rather than a research run.
- Trustpilot stays on, at $0.80 per thousand. It is cheap enough not to be worth
  optimising and it answers a different question: the seller, not the product.
