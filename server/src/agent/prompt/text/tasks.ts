export const CHAMPION_GENRE_TASK = `## Your task: find the champion

The brief names a genre, not a product. The **champion** is the genre's
most-bought product on Amazon. The other agents all measure against it.

1. \`amazon_find_product\` with the genre name. The listing with the highest
   \`reviewsCount\` is the champion; the next one is the runner-up.
2. \`web_fetch\` the champion's Amazon url. If it cannot be read, find the
   brand's own page for that product with \`web_search\` and fetch that.
3. \`record_source\` the page you read. Then \`record_reference\`: name, \`form\` (one of {forms}),
   actives (\`name_normalised\` lowercase, one accepted synonym), \`source_id\` of
   that page, \`reviews_count\`, \`runner_up_name\`, \`runner_up_reviews\`,
   \`amazon_url\`.
4. If \`amazon_find_product\` is missing or fails: \`record_gap\` with missing
   "champion ranking unavailable: <why>", and pick the champion from the best
   evidence you can fetch.
5. \`finish\`.

Record nothing else. Every row you record carries \`node: "{node}"\`.`;

export const CHAMPION_URL_TASK = `## Your task: find the champion

The brief is a site. The **champion** is the product it sells. The other agents
all measure against it.

1. \`web_fetch\` the brief's url and \`record_source\` it. Read off the product's
   name as the page writes it, its \`form\` (one of {forms}) and its actives.
2. \`amazon_find_product\` with the brand and product name. A listing that is the
   same product (same brand, same form) gives \`amazon_url\` and \`reviews_count\`.
   If none is, \`amazon_url\` is "" and \`reviews_count\` is 0.
3. \`record_reference\` citing the site's page, \`runner_up_name\` and
   \`runner_up_reviews\` null. Then \`finish\`.

Record nothing else. Every row you record carries \`node: "{node}"\`.`;

export const PRODUCT_TASK = `## Your task: the product's fact sheet

Fill in these ten fields for the product below. They come first. A fact worth
keeping that none of the ten covers may be recorded too, as an attribute with a
key you name — after the ten, never instead of them. No quotes, no market figures.

| key | value |
|---|---|
| \`name\` | the name as the product's own page writes it, nothing appended |
| \`brand\` | the brand |
| \`form\` | the form as the page states it (drops, capsules, gummies…) |
| \`dose_per_serving\` | the active amount per serving, with its unit |
| \`servings_per_container\` | servings per pack |
| \`full_ingredient_panel\` | every ingredient as listed, in order |
| \`price\` | price and currency for each pack size sold |
| \`subscription_terms\` | subscribe price, frequency, minimum orders, how to cancel — or "none offered" |
| \`claims_made_on_own_site\` | the claims the product page makes, word for word, separated by " \\| " |
| \`coa_present\` | "yes — <where>" if a certificate of analysis is published, else "no" |

Where to look, in order: the product page; the same page's Shopify \`.json\`
(\`<product url>.json\`) for prices and variants; the site's FAQ, refund and
subscription policy pages; other retailers only for a field the brand's site
does not state.

How to work:
1. Record as you read: in the same turn as a fetch you use, \`record_source\` it
   and \`record_attribute\` every field that page gives (\`key\` exactly as in the
   table, \`source_id\` = that page). A better source for a field later replaces
   your row: record it again.
2. Search only for fields still missing. A field you cannot find on its likely
   pages is a \`record_gap\` with missing "<key>: <why>", not a guess.
3. When all ten are recorded or gapped: \`record_node_status\` (\`complete\` if
   all ten are recorded, else \`incomplete\`, \`why\` naming the gapped keys), then
   \`finish\`. \`finish\` lists any field still open.

Every row you record carries \`node: "product_data"\`. At least one gap is
required: something is always unpublished — say what.`;

export const CATEGORY_TASK = `## Your task: the category's numbers

The category is the product's genre. Record these three fields first, each
exactly as a source states it, never estimated. Another number or fact about the
category worth keeping may be recorded too — a measurement with a \`metric\` you
name, or an attribute with a \`key\` you name — after the three, never instead
of them.

| field | record as |
|---|---|
| \`search_volume\` | \`record_measurement\`, \`metric\` "search_volume" (or "search_volume: <keyword>"), \`unit\` "searches", \`period\` the year or month ("2023", "2024-11"). One row per period. Rows for **at least three different years** make the trend. |
| \`category_size\` | \`record_measurement\`, \`metric\` "category_size: <segment the source names>", \`value\` as stated, \`unit\` currency and scale ("USD billion"), \`period\` the year it is for |
| \`seasonality\` | \`record_attribute\`, \`key\` "seasonality", the months or season demand peaks, in the source's words |

Where to look: keyword and trend pages that publish history (Exploding Topics
topic pages, Glimpse), articles that reprint a trend chart with dates;
market-research report pages (Grand View Research, Fortune Business Insights,
Fact.MR) for size; retailer or industry reports for seasonality. Google Trends
blocks automated reads: try it once at most.

How to work:
1. Record as you read: in the same turn as a fetch you use, \`record_source\` it
   and record every number it gives for these fields.
2. Two failed routes to a field is enough: \`record_gap\` with missing
   "<field>: <why>" and move on.
3. When all three are recorded or gapped: \`record_node_status\` (\`complete\` if
   all three are recorded, else \`incomplete\`, \`why\` naming the gapped fields),
   then \`finish\`. \`finish\` lists any field still open.

Every row you record carries \`node: "category_data"\`. At least one gap is
required.`;

export const COMPETITORS_TASK = `## Your task: the competitors

List every brand that sells the champion's active ingredient, measured against
the champion below. Two classes, decided by a mechanical test:

- **direct** — shares an active with the champion **and** has the same form;
- **indirect** — shares an active, **different** form (a spray, gummy or tea
  where the champion is a liquid). Research these as fully as direct ones.

**Shares an active** means it contains the same substance as one of the
champion's actives, whatever its page calls it — a Latin name, another part or
preparation of the same plant, a brand name for the same extract. A different
compound (another salt of a mineral, another plant) is a different active. A
brand solving the same problem with a **different** active is neither class: do
not list it; \`record_gap\` "same problem, different active: <brand> (<active>)".

How to work:
1. Find candidates: \`web_search\` "<active> <form>" for every form (capsules,
   drops, spray, gummies, tea) and "best <active> <market>", and
   \`amazon_find_product\` "<active>". A search result is not a competitor.
2. For each, \`web_fetch\` its own product page, \`record_source\` it, then
   \`record_competitor\` in the same turn: \`id\` c1, c2…; name, brand, url; its
   \`form\` (one of {forms}) and \`form_as_printed\`; its actives as its own
   page names them, with dose; \`shared_actives\` — which of the champion's
   actives it contains, **copied word for word from the champion's list below**
   (a pick from that list, never its own wording); \`relation\` (checked against the
   forms); \`dose_per_serving\`, \`price\`, \`price_per_dose\`;
   \`positioning_copy\` — its headline, word for word; \`market\` exactly as the
   brief's Markets line names it. A brand sold only outside those markets is
   out of scope. Where both forms are \`other\`, your \`relation\` stands, and
   \`form_as_printed\` must say specifically what each product is.
3. Ads: a competitor's ad-library page is an \`ad_library\` source with
   \`first_seen\` (null plus a gap when undated), linked from the competitor's
   \`ad_source_ids\`.
4. Stop per class: a class is done when three sources in a row surface no new
   brand of that class. \`record_saturation\` twice, \`class\` "direct" and
   "indirect", each point a source with \`new_themes\` = new brands it added.
5. \`record_node_status\` (\`complete\` only if both classes saturated), gaps,
   then \`finish\`.

Every row you record carries \`node: "competitors"\`. At least one gap is
required.`;
