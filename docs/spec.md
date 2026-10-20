# Avatar Strategist — Product Spec

Oct 17, 2026 · @jacob

## Goal

**North star: build the growth strategist that gets smarter with every account it serves.** An always-on agent for health and supplement direct-response (DR) brands that learns from every market it studies and every ad outcome it sees, so each new customer starts with the accumulated judgement of all previous ones.

What that means in practice:

- **Cross-account learning is the moat.** Patterns that win (avatars, angles, mechanisms, claim framings, awareness levels) are learned across all client segments in the vertical. Each client's raw data stays siloed; only anonymised patterns are shared.
- **Outcomes, not research.** The product is judged on winning ads found, money leaks plugged and CPA reduced, not on hours saved.
- **Proactive, not reactive.** The agent watches markets and accounts continuously and comes to the operator with findings and ready-to-ship work.
- **Honest by design.** It reports gaps only when the evidence supports them, labels estimates as estimates, and flags compliance risk before anything ships.

**North-star metric:** share of agent-originated long-form statics that become winners (run 21+ days at or below target CPA), tracked per account and across the vertical. A rising rate over time is the proof that the learning loop works.

**MVP goal:** given a product URL or name, produce an evidence-backed avatar analysis, honest gap report and ready-to-post long-form statics, with the data stored in a shape that later feeds the learning loop.

## Positioning

Claude with a TrendTrack MCP is a capable analyst that starts from zero every chat and only works when asked. This product differs on five axes:

| Capability | Claude + TrendTrack MCP | Avatar Strategist |
| --- | --- | --- |
| Customer voice | A few dozen reviews pasted by hand | Thousands of reviews scraped, deduplicated, stored and weighted by source |
| Analysis | Unweighted summary | Demand (reviews) compared against supply (competitor ads) to find winning and untargeted avatars |
| Memory | None between chats | Persistent segment model, test log and outcome history |
| Initiative | Waits for a prompt | Watches markets and accounts, alerts with drafted fixes (post-MVP) |
| Learning | None | Learns from ad outcomes per account and across accounts (post-MVP, foundations in MVP) |

Competitors (Atria, GetHookd, Brandsearch, TrendTrack) mine competitor ads. None combines them with real customer reviews to find gaps and sophistication mismatches, and none specialises in long-form statics for health DR.

## MVP scope

The MVP is a single-run analysis for one product that ends in an avatar report and ready-to-post long-form statics. It works for any health or supplement product; examples in this spec use a lung-support supplement for illustration only. Target markets are the US first, then the UK, Canada, Australia and New Zealand.

**In scope**

- Input by product URL or product name
- Product, ingredient, claims, economics and market research (supplementary context)
- Market awareness and sophistication diagnosis with evidence
- Competitor review collection and storage (core data)
- Competitor long-form static ad collection from TrendTrack (core data)
- Avatar and sub-avatar synthesis, winning targeting, honest gap detection
- Long-form static generation for winning avatars and real gaps, with a compliance pass
- A visual report UI with charts
- Data stored in a schema ready for the learning loop

**Out of scope for MVP** (see Later phases)

- Always-on monitoring and proactive alerts
- Meta ad-account connection and the outcome feedback loop
- Cross-account learning in production
- Advertorial, landing-page, email and video outputs
- Pushing ads to Meta

## Inputs

The user gives one required input and optional context; the agent resolves the rest.

| Field | Required | Example | Notes |
| --- | --- | --- | --- |
| Product URL **or** product name | Yes | brand.com/products/product-name, or "mullein lung drops" | A URL is scraped directly; a name triggers a search to resolve the product and candidate URLs, confirmed by the user |
| Target markets | No (default: US first, then UK, CA, AU, NZ) | US (primary), UK, Canada, Australia, New Zealand | Drives review marketplaces, ad countries and compliance rules |
| Known competitors | No | 3–10 brand names or URLs | Agent proposes more; user can accept or remove |
| Brand constraints | Yes, collected in onboarding before the first run | Claims the brand can and cannot make, voice notes | Feeds generation and compliance |
| Price and offer | No (scraped if URL given) | €32.95, 2+1 and 3+2 bundles, subscription | Used in economics and offer framing |

**Confirmation step:** before spending on scraping, the agent shows the resolved product, proposed competitor list and estimated cost (review volume × source price), and the user approves.

## Pipeline overview

&#91;embedded content: MVP pipeline · 7 stages, 4 inputs merge into one avatar map\]

Four research streams run in parallel; reviews (demand) and competitor long-form statics (supply) are the core, product and sophistication research add context. *Changed 2026-10-20: three streams run in parallel (product and market, reviews, competitor ads); market awareness and sophistication, renumbered stage 4, reads all three and runs after them, because sophistication is read off competitor ads (`spec-stage4.md`).* They merge into one avatar map, which drives winning-avatar and gap briefs, then generated ads and the report. Everything is stored for the learning layer.

## Stage 1: Product and market research

This stage builds supplementary context for the analysis. It is weighted low in avatar decisions but drives the mechanism, proof and compliance sections of every ad.

**Tools:** Firecrawl (page scraping, hosted plan), SearXNG (search, hosted plan for the MVP), Parallel and Scira (deep research tasks; Scira under evaluation, see below), TrendTrack MCP (shops, ads, competitors).

| Research area | What the agent extracts | Primary sources |
| --- | --- | --- |
| Product details | Name, format, dose, price, bundles, subscription, guarantee, claims on page, testimonials | Firecrawl on the product page; TrendTrack `search_shops` and `find_similar_shops` |
| Competitors | 5–15 direct competitors: DTC brands, Amazon sellers, their prices and positioning | TrendTrack (shops and advertisers in the niche), Amazon search results, Google Shopping |
| Ingredients and doses | Each ingredient, dose per serving, evidence level, safety and interactions | NIH Office of Dietary Supplements fact sheets, NIH Dietary Supplement Label Database, PubMed, Examine.com |
| Claims landscape | Claims competitors make; which are permitted, risky or prohibited | FTC Health Products Compliance Guidance, Meta Health and Wellness ad policy, EU and GB health-claims registers |
| Economics | Price per unit, bundle discount, estimated COGS, breakeven ROAS | Product pages, Alibaba and 1688 listings for comparable white-label products, user-supplied figures |
| Market size and demand | Category demand trend, search volume, Amazon units and revenue estimates, seasonality | Google Trends, Amazon best-seller ranks and third-party sales estimators, Parallel deep-research summaries |

**Output:** a product brief and a competitor table, each claim linked to its source. Revenue and market-size figures are always labelled as estimates.

### Competitor product images and label reading

The agent pulls every product image for the client and each competitor, then reads the labels with a vision model so formulas can be compared on facts, not marketing copy.

**What to pull**

| Source | Images | How |
| --- | --- | --- |
| Shopify stores | Full product gallery, including label and supplement-facts shots | Public `/products.json` returns every product's image URLs at no cost ([example actor docs](https://apify.com/patel_dev_automation/shopify-scraper.md)); request the largest size variant |
| Amazon listings | Main image, alternate images, A+ content | Product data API or Firecrawl on the listing; request the high-resolution variant |
| Brand sites (non-Shopify) | Product page images | Firecrawl, collecting all `img` sources in the product gallery |

Each image is stored in object storage with its source URL, competitor, content hash and an image type assigned by a quick classifier: front of pack, back of pack, supplement-facts panel, lifestyle, infographic, other.

**What the vision model reads** (structured output, one record per product)

- Format and size: drops, capsules, gummies, powder; net contents (e.g. 60 mL, 2 fl oz, 90 capsules)
- Serving size, servings per container, directions for use
- Every ingredient with dose per serving, % daily value, extract ratio (e.g. 4:1) and standardisation where printed
- Proprietary blends flagged, with total blend weight when only that is disclosed
- Free-from and certification marks: vegan, non-GMO, alcohol-free, GMP, third-party tested
- Warnings, allergens, and "made in" or "distributed by" origin lines
- Claims and badges printed on the pack

**Derived comparisons**

- Price per serving and price per mg of the key ingredient
- Dose versus evidence: each key ingredient's dose compared with ranges from NIH fact sheets and the research in Stage 1
- Formula gaps between the client and competitors (e.g. a competitor with twice the mullein per serving, or an extra ingredient the client lacks), which feed proof points, "us vs them" sections and objection handling in Stage 7

**Quality rules:** every extracted field carries a confidence score and a link to the image region it came from. Label values are cross-checked against page text and listing bullets; conflicts are flagged rather than silently resolved. Low-confidence fields go to a review queue in the MVP.

**Output in the UI:** competitor images appear throughout the competitor analysis: a Competitors card grid led by each product's hero image, a gallery of label and packaging shots per competitor, and a formula comparison table (price, size, servings, price per serving, key doses, certifications, origin) with label thumbnails that open full size. Product thumbnails also appear on competitor ad cards and avatar detail pages, so every finding is tied to a recognisable product.

### Competitor classification and ranking

Every competitor is classified as direct or indirect, then ranked within its group, so the user sees who they really fight for the same buyer. Both groups target the same market.

| Group | Definition | Example (lung-support supplement) |
| --- | --- | --- |
| Direct | Same key active ingredient **and** same form factor | Other mullein drops and tinctures |
| Indirect | Same key active ingredient, **different** form factor | Mullein capsules, gummies, teas, powders |

**How classification works:** the key active ingredient and form factor come from label reading (above), cross-checked against the product title and page. A competitor whose label does not show the key active ingredient is excluded from both groups and listed separately as "other lung-support products" for context only. Low-confidence classifications go to the review queue.

**Ranking score** (computed separately within each group, 0–100)

| Signal | Source | Weight |
| --- | --- | --- |
| Winning long-form statics (count and win score) | Stage 3 | 25% |
| Total active Meta ads and ad longevity | TrendTrack | 20% |
| Review volume and rating | Stage 2, Amazon, Shopify widgets | 20% |
| Estimated store traffic and revenue (labelled estimate) | TrendTrack | 15% |
| Amazon best-seller rank in category | Amazon listing | 10% |
| EU/UK reach (real disclosed data, where available) | Meta transparency data via TrendTrack | 10% |

Signals are normalised within the group; a missing signal is dropped and the remaining weights rescaled, with the gap shown on the card. The top 5 direct and top 5 indirect competitors are analysed in full; the rest are listed with their score.

**Why the split matters for the analysis:** direct competitors set the copy and offer benchmark for long-form statics. Indirect competitors show avatars and angles the same buyer responds to in another format, which often reveals gaps (e.g. a strong "easy to take" theme in gummy reviews that drops ignore).

### Deep research engine: Scira (evaluation)

Scira is tested as the deep-research engine for Stage 1 and Stage 4 alongside Parallel; the winner on a fixed test set becomes the default.

**What Scira is:** an open-source AI search engine (formerly MiniPerplx) built on the Vercel AI SDK, with an "Extreme" mode that runs an LLM-driven deep research agent with multi-step planning and code execution ([GitHub](https://github.com/zaidmukaddam/scira/wiki)). Extreme searches use Exa or Parallel for content extraction, with Firecrawl as fallback, and every answer carries its sources ([docs](https://mintlify.com/zaidmukaddam/scira/how-it-works)).

**How it plugs in**

- Self-host Scira with Docker as a separate service; the agent calls it through a `research_provider` interface that Parallel and a plain SearXNG + Firecrawl pipeline also implement, so providers are swappable per task.
- Use Extreme mode for open-ended questions (market size, competitor landscape, ingredient evidence, claims landscape); keep TrendTrack, review scrapers and label reading as direct tools, since they need structured data rather than prose answers.
- Parse every Scira answer into claims plus source URLs and store them, so figures in the report link back to the page they came from.

**Test plan (5 questions, run on a pilot product)**

| Question | What a good answer contains |
| --- | --- |
| Market size and trend for the product's category in its target market | Sized estimate with method and dated sources, trend direction |
| Top 10 competitors and their positioning | Brands, prices, channels, main claim, links |
| Evidence for each of the product's ingredients and typical doses | Study types, dose ranges, safety notes, primary sources |
| Claims landscape and compliance risks | Common claims, which are risky under FTC and Meta rules |
| Evidence for market sophistication stage | Dated examples of claim escalation |

Score each provider (Scira Extreme, Parallel, own pipeline) on factual accuracy (spot-checked against sources), citation quality (primary versus aggregator, every figure sourced), coverage, cost per question and time per question.

**Decision rule:** Scira becomes default for a task if it matches or beats Parallel on accuracy and citations at lower cost; otherwise it stays as a fallback.

**Licence decision:** Scira is used as unmodified upstream code, self-hosted as a separate internal service that only the agent calls. Customers never interact with Scira directly, and its code is not merged into the product. This keeps the AGPL-3.0 licence listed on its GitHub repository from applying to the product's own code. Configuration (API keys, provider choice) stays in environment variables; any change Scira cannot support through configuration is built in the product's own wrapper, not in a fork. Pin the Scira version and record it with each research result.

## Stage 2: Review collection

Reviews are the highest-weighted input. The target is 3,000–10,000 written reviews across 5–15 competitors, collected once, stored, and refreshed incrementally. Expected cost for a full run: roughly $10–40, because the cheapest sources (Shopify review widgets) are nearly free.

**Important constraint:** since late 2024, Amazon shows only about 8 reviews per product to logged-out visitors and the full review pages sit behind a login ([DEV Community](https://dev.to/psymall/how-to-get-amazon-review-rating-data-at-scale-and-whats-actually-public-in-2026-4o93)). Scraping behind a login can breach Amazon's terms, so the MVP uses no-login sources only.

**Sources, cheapest first**

| Source | How | Cost | Volume and limits | Weight |
| --- | --- | --- | --- | --- |
| Shopify DTC competitors (Judge.me, Yotpo, Stamped, Okendo, Loox, Shopify Product Reviews) | Own fetcher on the review apps' public widget endpoints. Judge.me's public endpoint returns 20 reviews per page ([Apify actor docs](https://apify.com/memo23/judge-me-reviews-scraper)); Apify actors exist as fallback | Near zero (own code) | Often hundreds to thousands per brand; many health DR competitors run on Shopify | High: verified buyers of the exact competitor |
| Amazon (no login) | Pay-per-result Apify actors, e.g. one at $3 per 1,000 reviews over plain HTTP, capped at 100 per rating-and-sort pass ([prodiger](https://apify.com/prodiger/amazon-reviews-scraper)); another at $3.90 per 1,000 across 12 marketplaces ([junipr](https://apify.com/junipr/amazon-reviews-scraper)) | $2–4 per 1,000 reviews | Roughly 100 per star filter per product, so up to about 500 per ASIN; amazon.com first, then .co.uk, .ca and .com.au (which also serves New Zealand) | High: verified purchases, large volume |
| Trustpilot | Pay-per-result Apify actor or own fetcher | About $1–4 per 1,000 | Brand-level, often about shipping and service | Medium |
| Meta ad comments | Apify actor on competitors' top ads | Low | Objections and scepticism in buyers' own words | Medium |
| Reddit and health forums | Reddit API (free tier), SearXNG | Free | Problem language, prior solutions, scepticism | Low (web tier) |
| YouTube comments | YouTube Data API free quota | Free | Reviews and testimonial videos | Low |

Use pay-per-result actors, not compute-billed ones; Apify's cost problem is mostly compute billing, not per-review pricing. Avoid scraping sources that need a login.

**Volume, 2026-10-17:** up to 500 reviews per product (the client's and each confirmed competitor's) while testing, not 3,000–10,000 per run. Sources in the order built: the store's Judge.me widget (public JSON, 30 per page), then Amazon through woot.com's review endpoint (Amazon-owned, no login, free; 100 per star band, bands 3, 1, 2, 4, 5), measured working on 2026-10-17 and already used by `review-crawler`. A small agent finds a competitor's Amazon listing when its page is not on Amazon. Apify, Trustpilot, the other review apps, ad comments, forums and YouTube are not built yet (`docs/gaps.md`).

**Weighting rules** (applied in Stage 5). *Superseded 2026-10-17: no fixed weights in code for now. Stage 2 stores each review's raw signals (source, verified, date, helpful votes); stage 5's agent weighs them as it reads. The rules below are guidance for that agent, not a formula.*

- Source tier: Shopify verified and Amazon verified at 1.0; Trustpilot and ad comments at 0.6; forums and YouTube at 0.3; reviews of indirect competitors carry an extra × 0.8, since format affects what buyers praise and complain about
- Verified purchase × 1.0, unverified × 0.6
- Recency decay: full weight within 12 months, half weight after 24 months
- Helpful votes add a small boost; 1–2 star reviews are kept, since objections matter as much as praise

**Storage:** every review is written to the database with its scrape date, review date, source, product, rating, text, verified flag, helpful votes and a content hash for deduplication. Reviewer details are minimised: a pseudonymous reviewer id plus coarse attributes when stated publicly (country, self-reported age or condition mentioned in the text). Names are not stored. Refresh runs fetch only reviews newer than the last scrape.

## Stage 3: Competitor long-form static ads

This stage measures supply: which avatars competitors target, and which of those ads are winning. TrendTrack's `search_ads` supports the filters needed directly.

**Query recipe** (`mcp__trendtrack__search_ads`)

| Parameter | Value | Why |
| --- | --- | --- |
| `media_type` | `image` | Statics only |
| `min_description_length` | `2000` | Long-form copy (2,000+ characters) |
| `query` + `search_in` | Category keywords in `ad_copy` (e.g. "mullein", "lung", "mucus", "chest congestion"), then competitor domains via `search_in=domain` | Category sweep plus named competitors |
| `category_ids` | Resolved first with `lookup_filter_ids` (`type=categories`, e.g. "health supplements") | Narrows to the niche |
| `status` | `all` | Keep inactive ads for history and sophistication timeline |
| `ad_countries` | e.g. `{include:["US","GB","CA","AU","NZ"]}`, with a US-only pass run first | Target markets |
| `sort_by` | `longestRunning`, then a second pass with `reachDelta30d` (*2026-10-19: `reachDelta7d`; TrendTrack's API refuses the 30-day sort*) | Proven winners plus current scalers |
| `max_ads_per_brand` | 15 | Avoids one brand flooding the sample |
| `page` / `limit` | 20 per page, paginate | Results cap at 20 per call |

Add a **second pass for text-in-image statics:** some long-form statics put the copy in the image with short primary text. Pull high-ranking image ads with `max_description_length=300` and run vision OCR; keep those whose image text exceeds about 150 words.

**Winning signal per ad** (spend figures for US ads are estimates, so the score uses observable signals)

| Signal | Field or source | Weight |
| --- | --- | --- |
| Days running | `min_days_running`, first and last seen dates | High (30+ days strongly suggests profitability) |
| Duplicates and variants | `min_duplicates` / duplicate count | High (brands duplicate what scales) |
| Ad rank within its brand | `ad_rank` fields | Medium |
| Reach growth | `reachDelta7d` / `30d` | Medium (currently scaling) |
| EU/UK reach | Meta-disclosed reach for EU-delivered ads | Medium; real data, but of the target markets only the UK is covered |

Ads are bucketed into **winning** (top tercile of score), **testing** (under 14 days) and **dead** (stopped before 14 days). *Superseded 2026-10-17: an agent reads each ad's observable signals (days running, duplicates, reach deltas, status, rank) and picks the bucket with a one-line reason; no fixed score or tercile in code for now. Stage 3 also waits for stage 1, because its ad-copy keywords come from the product brief.*

**Per-ad extraction** (LLM, structured output): target avatar and sub-avatar, lead claim type (plain, bigger, mechanism, identity), awareness level of the opening, mechanism named, proof types, offer, objections handled, emotional driver, compliance risk flags. Each ad and its extraction are stored with the TrendTrack ad id and media link.

## Stage 4: Market awareness and sophistication

The agent scores the market on Eugene Schwartz's five sophistication stages and five awareness levels, from evidence rather than judgement. Each score shows its evidence and a confidence level.

**Sophistication rubric** (how far claims have escalated in the market)

| Stage | What the market looks like | Evidence the agent looks for | Example (lung-support supplement) |
| --- | --- | --- | --- |
| 1. First to market | Simple direct claim works | Few competitors, plain benefit claims | "Mullein supports your lungs" |
| 2. Bigger claim | Competitors enlarge the same claim | Claims stacked with numbers, speed, strength | "Clear your lungs in 7 days" |
| 3. Mechanism | A new "how it works" wins | Ads explain a reason why | "Dissolves trapped mucus at the source" |
| 4. Mechanism war | Competing mechanisms, each made bigger | Several named mechanisms, ingredient stacks, "5 superherbs" | Multiple brands with rival mechanisms |
| 5. Identification | Buyers tired of claims; identity and story win | Story-led, founder, "people like you" ads outperform claim ads | "For ex-smokers who still wake up wheezing" |

**Awareness rubric** (how much the typical buyer knows), scored from the share of each type across ad openings, search queries and review language: unaware, problem-aware, solution-aware, product-aware, most aware.

**Best sources, in order of value**

1. **Competitor ad history (TrendTrack).** Pull active *and* inactive ads with `status=all` and date windows (`created_before` / `created_after`) to see how claims escalated over 1–3 years. Classify each ad's lead claim as plain, bigger, mechanism or identity. This is the strongest single signal of stage.
2. **Competitor landing pages over time (Wayback Machine, via Firecrawl).** Headline and mechanism changes across snapshots show the escalation path.
3. **Amazon listings for the category.** Titles and bullet points of the top 30–50 listings show how crowded and inflated claims are.
4. **Review language (your Stage 2 data).** Phrases like "I've tried everything", "skeptical at first" or naming rival products indicate a sophisticated, claim-weary market. Mentions of first discovery indicate low awareness.
5. **Search demand mix (Google Trends, SearXNG results).** The share of problem queries ("chest congestion after quitting smoking") versus solution queries ("mullein drops") versus brand queries indicates awareness.
6. **Forums (Reddit, health communities).** How people describe the problem and what they have already tried.

**Output:** sophistication stage and awareness level, each with a confidence score, evidence links, and a timeline chart of claim types over time. The single source text for the framework is Schwartz's *Breakthrough Advertising*; the rubric above is its working summary.

*2026-10-20: the tools for this stage, its place in the pipeline (after stages 1, 2 and 3, with the per-avatar part in stage 5's judge) and what each source costs are proposed in `spec-stage4.md`. Awareness becomes a distribution per avatar per channel, not one level for the market.*

## Stage 5: Avatar and sub-avatar synthesis

The agent builds one avatar taxonomy from reviews, then maps competitor ads onto it, so demand and supply are measured on the same axes.

1. **Extract signals per review** (cheap LLM, structured output): who they are (situation, life stage, stated age or condition), pain, desired outcome, trigger moment, prior solutions tried, objections and doubts, result described, and verbatim phrases.
2. **Cluster into avatars.** ~~Embed the signals and cluster (e.g. HDBSCAN), then have a stronger model name and describe each cluster.~~ *Superseded 2026-10-17: an agent reads the reviews in batches and forms the groups itself. It keeps a memory of the avatars and angles found so far, and updates it as each batch confirms, splits or merges them. No embeddings: grouping by meaning is judgement the agent does better than a distance.* Repeat inside large groups to get sub-avatars (two levels maximum).
3. **Map ads onto the taxonomy.** Classify each long-form static from Stage 3 into the same avatars and sub-avatars.
4. **Measure both sides.**
   - Demand share = weighted share of reviews in the avatar (Stage 2 weights)
   - Supply share = share of long-form statics targeting the avatar, weighted by winning score
   - Win rate = share of that avatar's ads in the winning bucket
5. **Attach market context:** awareness level and sophistication evidence per avatar (Stage 4), plus product facts and permitted claims (Stage 1).

**What counts as "targeting that is doing well":** an avatar with a high win rate **and** meaningful demand share. Winning ads on an avatar with little review support are flagged as possibly budget-driven rather than resonance-driven.

**Per-avatar card fields:** name and one-line description; demand share and review count; supply share and ad count; win rate; top pains, desires and objections with example quotes; awareness level; best-performing angle and mechanism among competitors; confidence (low, medium or high).

**Minimum evidence** (*2026-10-17: guidance for the agent, not a fixed threshold in code*): an avatar needs at least 30 weighted reviews to be reported; smaller clusters go into an "emerging signals" list rather than the main analysis.

## Stage 6: Gap detection

A gap is reported only when demand clearly exceeds supply and the evidence clears fixed thresholds. If nothing qualifies, the report says so plainly and points the user to the winning avatars instead.

*2026-10-17: the thresholds below are guidance for an agent's judgement for now, not fixed rules in code; they are flexible until real runs show where they sit.*

**Gap types**

| Gap type | Rule (all conditions must hold) | Example |
| --- | --- | --- |
| Untargeted avatar | Demand share ≥ 10%, supply share ≤ 3%, at least 50 weighted reviews | Ex-smokers: 18% of reviews, 3% of ads |
| Under-served angle | Avatar is targeted, but a pain or desire raised in ≥ 20% of its reviews appears in < 5% of its ads | Morning mucus mentioned often, rarely used as a hook |
| Unanswered objection | An objection in ≥ 10% of an avatar's reviews is handled by < 5% of its ads | "Safe with my medication?" |
| Sophistication mismatch | Competitors fight at a higher stage than review language supports, or the reverse | Mechanism war in ads; buyers still persuaded by simple results |
| Awareness mismatch | Ad openings assume a different awareness level than reviews show | Ads assume product-aware; reviews show recent problem discovery |

**Guardrails against forced gaps**

- Each gap shows its numbers and 3–5 supporting quotes; no quotes, no gap.
- A demand cluster with no ads may exist because the claim is not allowed. The compliance check runs before a gap is reported, and blocked gaps are listed separately with the reason.
- Gap confidence is shown as low, medium or high, based on review count and source mix.
- When no gap passes, the report states "No strong gaps found" and explains why (e.g. the market is well covered), rather than lowering thresholds.

## Stage 7: Long-form static generation

For each winning avatar and each real gap, the agent produces ready-to-post long-form statics that the user can copy, edit and launch.

**Per brief, generate:**

- 2 primary-text variants of 2,000–3,500 characters, written at the avatar's awareness level and the market's sophistication stage
- 3 headline options and 2 hook (first-line) options
- An image brief: format (text-on-image, testimonial screenshot, before-and-after-free product shot), on-image text, layout notes
- CTA and offer framing using the product's real offer

**Structure** (adapted to awareness level): hook in customer language → problem agitation → failed alternatives → mechanism → proof (real review language, ingredients, guarantee) → objection handling → offer → CTA.

**Grounding rules**

- Every claim traces to a source: the product page, ingredient evidence or a permitted-claim list.
- Customer language comes from real review phrases. Quotes used as testimonials must be real, attributed in aggregate ("4,500+ reviews"), never invented people.
- For winning avatars, the copy beats the competitor pattern rather than cloning it: same avatar, sharper angle or a fresher mechanism framing.

**Compliance pass** (runs on every output)

- Flags disease, cure, treatment and guaranteed-result claims under FTC guidance and Meta's Health and Wellness policy
- Proposes compliant rewrites (e.g. "supports natural mucus clearance" instead of "clears COPD")
- Applies market rules with the US first (FTC and FDA dietary-supplement claim rules), then the UK (ASA CAP code, GB health-claims register), Canada (Health Canada natural health product rules), Australia (TGA advertising code) and New Zealand
- Shows a risk level per ad: low, review or block

**Output in the UI:** each ad as a card with a copy button, an edit-in-place field, its target avatar, the evidence behind it and its compliance status.

## UI and visualisations

The report leads with one picture: a demand-versus-supply map of avatars. Everything else is a drill-down from it. The UI should feel like a strategist's briefing, not a database.

**Screens**

| Screen | Purpose | Key visuals |
| --- | --- | --- |
| New analysis | Enter URL or product name, confirm product, competitors and estimated cost | Product preview card, editable competitor chips, cost estimate |
| Live run | Show progress while stages run (5–20 minutes) | Stage tracker with live counters: reviews collected, ads analysed, avatars found |
| Overview | The answer in 30 seconds | 3–5 finding cards (top winning avatar, top gap or "no strong gaps", sophistication stage, awareness level), plus the avatar map |
| Avatar map (hero) | Where demand and supply meet | Bubble chart: x = supply share, y = demand share, bubble size = review count, colour = win rate; top-left quadrant shaded as "gaps", top-right as "proven" |
| Avatar detail | Why this avatar matters | Bars for top pains, desires and objections; quote cards; competitor ads targeting it; awareness badge |
| Market | Sophistication and awareness with evidence | Stacked area chart of claim types over time (plain, bigger, mechanism, identity); awareness distribution bar; evidence list |
| Competitors | See every competitor at a glance, product first | Two ranked card grids, Direct and Indirect, with rank and score on each card, led by each competitor's hero product image, form factor badge, price, rating, review count, active long-form statics and top avatar; client's product pinned first for comparison. Clicking a card opens an image gallery (front, back, supplement-facts panel, lifestyle) beside the extracted label facts, with each value highlighted on the label it came from |
| Formula comparison | Compare client and competitor products on label facts | Table of price, size, servings, price per serving, key doses, certifications and origin, with label thumbnails; dose-versus-evidence bars for key ingredients |
| Competitor ads | Supply evidence | Gallery of long-form statics with winning, testing and dead badges, filter by avatar and competitor |
| Gaps | Opportunities, honestly scored | Gap cards with demand vs supply mini-bars, quotes and confidence; explicit "no strong gaps" state |
| Ads | Ready-to-post output | Ad cards with copy button, inline editor, avatar tag, compliance badge, "why this works" panel |
| Data coverage | Trust and cost | Reviews by source and competitor, ads by brand, run cost, data freshness |

**Design principles:** one accent colour for opportunities, a neutral palette elsewhere; every chart has a one-line takeaway as its title; every number links to the reviews or ads behind it; estimates are visibly labelled; works on a laptop screen first.

**Suggested stack:** Next.js with Tailwind, Recharts or visx for charts, shadcn/ui components; the report is also exportable as a shareable page and PDF.

## Data model

Postgres with pgvector holds everything; raw scraped payloads go to object storage. Every row carries `account_id` so client data stays siloed, and every analysed item keeps a link back to its source.

| Table | Key fields | Notes |
| --- | --- | --- |
| `accounts` | id, name, vertical, markets | One per client |
| `products` | id, account\_id, url, name, category, price, offer, ingredients (json), claims\_on\_page | Resolved in Stage 1 |
| `competitors` | id, product\_id, brand, domain, platform (shopify, amazon), asin\_list, review\_app, relationship (direct, indirect, other), key\_active, form\_factor, rank\_score, rank\_in\_group, score\_breakdown (json) | Proposed by agent, confirmed by user |
| `runs` | id, product\_id, started\_at, stage\_status (json), cost\_usd | One per analysis |
| `reviews` | id, competitor\_id, source, source\_review\_id, content\_hash, rating, title, body, review\_date, scraped\_at, verified, helpful\_votes, reviewer\_pseudo\_id, reviewer\_attrs (json), weight | Deduplicated by content\_hash; incremental refresh by review\_date |
| `review_signals` | review\_id, who, pain, desire, trigger, prior\_solutions, objections, outcome, quotes (json), embedding | Stage 5 extraction |
| `ads` | id, competitor\_id, trendtrack\_ad\_id, media\_url, copy, copy\_length, image\_text, first\_seen, last\_seen, days\_running, duplicates, ad\_rank, reach\_delta, eu\_reach, win\_score, bucket | Stage 3 |
| `ad_extractions` | ad\_id, avatar\_label, claim\_type, awareness, mechanism, proof\_types, objections\_handled, emotion, risk\_flags, embedding | Stage 3 |
| `avatars` | id, run\_id, parent\_id, name, description, demand\_share, supply\_share, win\_rate, review\_count, ad\_count, awareness, confidence | Two levels via parent\_id |
| `avatar_members` | avatar\_id, item\_type (review, ad), item\_id, score | Links evidence to avatars |
| `market_assessments` | run\_id, sophistication\_stage, awareness\_level, confidence, evidence (json) | Stage 4 |
| `gaps` | id, run\_id, type, avatar\_id, demand\_share, supply\_share, evidence\_ids, confidence, blocked\_reason | Stage 6 |
| `generated_ads` | id, run\_id, target (avatar or gap), primary\_text, headlines, hooks, image\_brief, risk\_level, compliance\_notes, status | Stage 7 |
| `outcomes` | generated\_ad\_id, launched\_at, spend, cpa, roas, days\_running, is\_winner | Empty in MVP; filled once the ad account is connected |
| `patterns` | id, vertical, pattern\_type, description, support\_accounts, lift\_estimate, confidence | Cross-account learning store; anonymised, no client identifiers |
| product\_images | id, product\_or\_competitor\_id, source, source\_url, storage\_key, content\_hash, image\_type, width, height, scraped\_at | Stage 1 image pull; deduplicated by content\_hash |
| label\_facts | id, product\_or\_competitor\_id, image\_id, format, net\_contents, serving\_size, servings, ingredients (json: name, dose, unit, dv, extract\_ratio), proprietary\_blend, certifications, warnings, origin, pack\_claims, field\_confidence (json) | Vision extraction from labels; feeds formula comparison |

## Cross-account learning foundations

The MVP does not learn from client ad outcomes yet, but it must store everything in a shape that lets learning start the day outcomes arrive. It can also start learning immediately from a free proxy: competitor ad survival across every segment it analyses.

**Memory layers**

| Layer | Scope | What it holds | Example |
| --- | --- | --- | --- |
| Segment memory | One account and product | Avatars, gaps, market assessment, history of runs | "Ex-smoker avatar grew from 12% to 18% of reviews since July" |
| Episodic log | One account | Every hypothesis, generated ad, decision and later outcome | "Ad #14 (ex-smoker, mechanism hook) launched; won at day 21" |
| Pattern memory | Whole vertical, anonymised | Generalised patterns with support and confidence | "In respiratory supplements at sophistication stage 4, identity-led hooks outlive mechanism hooks" |
| Playbooks | Whole vertical | Procedures the agent applies, updated as patterns firm up | Default awareness-level structure for a stage-4 health market |

**Ideas borrowed from Supermemory's published research:** its engine stamps each memory with two times (when it was recorded and when the event happened), versions memories by relation when new facts update old ones, and forgets expired information ([Supermemory research](https://supermemory.ai/research)). Apply the same to marketing memory:

- Store both *observed\_at* and *valid\_period* on every pattern, because what wins in a market decays.
- When new evidence contradicts a pattern, create a new version linked to the old one rather than overwriting it.
- Expire or down-weight patterns with no fresh supporting evidence after a set window (e.g. 6 months).

**Two learning sources**

1. **Competitor ad survival (available from day one).** Across every segment analysed, record which avatar types, claim types and awareness openings survive 30+ days versus die early. This builds vertical-level priors before any client launches an ad.
2. **Client ad outcomes (post-MVP).** Each generated ad becomes a scored prediction. Outcomes update pattern confidence, so a pattern's weight rises or falls with real results.

**Privacy rules**

- Raw reviews, ads, generated copy and outcomes stay inside the client's account.
- A pattern enters pattern memory only when supported by at least 3 accounts or segments, and holds no brand names or client figures.
- Contracts include explicit opt-in for anonymised pattern learning.

## Later phases

Each phase starts only when the previous one passes its gate.

1. **MVP: single-run avatar analysis** (this spec). Gate: the pilot customer confirms the avatars and gaps match what they know, and at least 3 generated statics are launched.
2. **Outcome loop.** Read-only Meta ad-account connection; launched ads tracked against target CPA; the episodic log fills; leak detectors for fatigue, losers and under-funded winners. Gate: 30 days of outcome data and a first "money recovered" figure.
3. **Always-on agent.** Daily review and ad refresh, weekly Slack digest, proactive alerts with drafted replacements, and a guided chat where the user asks questions, gets walked through findings and steers the agent (parked until this phase). Gate: operator acts on at least half of the alerts.
4. **Cross-account learning in production.** Pattern memory updated from outcomes across 5+ accounts; agent predictions scored and accuracy shown in the UI. Gate: winner rate of agent-originated ads rising quarter on quarter.
5. **More outputs for the same buyer.** Advertorial and landing-page blueprints, product-page objections, email angles, video scripts from proven angles; push to Meta as paused drafts.

**Explicitly out of scope until later:** SEO, general enterprise marketing, building a page editor, autonomous budget changes.

## Success metrics, risks and decisions

**MVP success metrics**

| Metric | Target |
| --- | --- |
| Reviews collected per run | 3,000+ across 5+ competitors |
| Long-form statics analysed per run | 100+ |
| Run time | Under 30 minutes |
| Data cost per run | Under $40 |
| Customer validation | Pilot customer agrees with at least 80% of avatar descriptions |
| Generated ads launched | At least 3 in the first month |
| Early outcome | At least 1 generated ad runs 21+ days at or below target CPA |

**Risks**

| Risk | Mitigation |
| --- | --- |
| Amazon review access tightens further | Lean on Shopify review widgets and Trustpilot; keep source adapters swappable |
| Too few long-form statics in a niche | Widen to adjacent categories; lower length threshold to 1,500 characters with a flag |
| Clusters look generic | Two-level taxonomy, minimum evidence rules, human review of names in MVP |
| Generated copy breaks health-claim rules | Mandatory compliance pass; "block" status prevents copying |
| US spend data is estimated | Win score uses observable signals; estimates labelled |

**Decisions made**

- Target markets: US first, then UK, Canada, Australia and New Zealand.
- Infrastructure: hosted plans for SearXNG and Firecrawl in the MVP; self-hosting revisited once volume justifies it.
- Models: the LLM for each task (high-volume extraction versus synthesis and copy) is set in the code's environment variables, so models can be swapped without code changes.
- Brand constraints: pilot customers share permitted claims and brand voice before the first run; collected in onboarding.
- Ad-account access: pilot customers grant read-only Meta ad-account access after the MVP, which starts the outcome loop (phase 2).
- 2026-10-17, review volume: 500 reviews per product while testing (stage 2).
- 2026-10-17, avatars: an agent reads, groups and keeps a memory of avatars and angles, updated as it reads; no embedding clusters (stage 5).
- 2026-10-17, thresholds: ranking weights, review weights, ad buckets and gap thresholds are judged by an LLM for now, not fixed code.
- 2026-10-17, product images: stored in Neon's object storage for now.
- 2026-10-19, which ads stage 3 studies: as a growth marketer would, in rings. Competitors' own ads; ads for the same problem from any product (counted as supply for the avatars); ads for another problem aimed at the same buyer (kept as formats to borrow, not supply); anything else is dropped. *Changed the same day:* an agent (the scout) finds them, not code. It searches TrendTrack with tools, discovers brands as it goes, and keeps the ads worth studying in those rings; code only checks it kept ads it saw, within the budget and caps.
- 2026-10-20, a fourth ring for stage 3: winning long-form statics from trending shops, in any market. Many fast-growing shops scale on long-form statics, and their structures (hook, story, proof, offer, funnel) can be applied to the client's store whatever the shops sell. The scout gets `find_trending_shops` (TrendTrack's trending feed, filtered to shops actively running Meta ads) and searches a promising shop's ads by domain. Kept as a playbook like same buyer, not counted as supply.
- 2026-10-20, stage order: market awareness and sophistication moves from stage 2 to stage 4 and needs stages 1 to 3; reviews become stage 2 and competitor ads stage 3. Sophistication cannot be judged before competitor ads are read, nor awareness per avatar before avatars exist; the per-avatar part is done by stage 5's judge (`spec-stage4.md`).
