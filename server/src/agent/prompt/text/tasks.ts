export const CHAMPION_GENRE_TASK = `## Your task: find the champion

The brief names a genre, not a product. The **champion** is the genre's
most-bought product on Amazon. The other agents all measure against it.

1. \`amazon_find_product\` with the genre name. The listing with the highest
   \`reviewsCount\` is the champion; the next one is the runner-up.
2. \`web_fetch\` the champion's Amazon url. If it cannot be read, find the
   brand's own page for that product with \`web_search\` and fetch that.
3. \`record_source\` the page you read. Then \`record_reference\`: name, \`form\` (one of {forms}),
   actives (\`name_normalised\` lowercase, one accepted synonym), \`icp\`,
   \`source_id\` of that page, \`reviews_count\`, \`runner_up_name\`,
   \`runner_up_reviews\`, \`amazon_url\`. \`icp\` is the customer: who the page
   says the product is for and the problem it solves, in its own words.
4. If \`amazon_find_product\` is missing or fails: \`record_gap\` with missing
   "champion ranking unavailable: <why>", and pick the champion from the best
   evidence you can fetch.
5. \`finish\`.

Record nothing else. Every row you record carries \`node: "{node}"\`.`;

export const CHAMPION_URL_TASK = `## Your task: find the champion

The brief is a site. The **champion** is the product it sells. The other agents
all measure against it.

1. \`web_fetch\` the brief's url and \`record_source\` it. Read off the product's
   name as the page writes it, its \`form\` (one of {forms}), its actives, and its
   \`icp\`: who the page says the product is for and the problem it solves, in
   its own words.
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

{deliverable}

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
3. If you have \`ad_library_search\`, once the ten are done: search the brand's
   own domain (\`search_in\` "domain", \`countries\` the brief's markets as ISO
   codes) to see how the product advertises on Meta. Its ads may run under
   persona pages and land on other domains (an offer subdomain, an advertorial):
   the landing domain tells you they are the brand's. Record what you find as
   attributes after the ten: \`ad_activity\` (how many ads, which pages run them,
   first and last seen) and \`ad_claims\` (the claims the ads make, word for word,
   separated by " \\| "), each citing an ad you \`record_source\` as kind
   "ad_library" with its \`first_seen\`.
4. When all ten are recorded or gapped: \`record_node_status\` (\`complete\` if
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

{deliverable}

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
3. If you have \`ad_library_search\`, after the three: search the customer's
   problem in ad copy (\`countries\` the brief's markets as ISO codes). How many
   Meta ads match is a sign of how contested the category is: record it as a
   measurement, \`metric\` "meta_ads_matching: <query>", \`unit\` "ads", \`period\`
   today's date, citing the search's source_id (\`record_source\` it as kind
   "ad_library"). The biggest advertisers' pages and reach may be worth an
   attribute too, \`key\` "meta_ad_leaders".
4. When all three are recorded or gapped: \`record_node_status\` (\`complete\` if
   all three are recorded, else \`incomplete\`, \`why\` naming the gapped fields),
   then \`finish\`. \`finish\` lists any field still open.

Every row you record carries \`node: "category_data"\`. At least one gap is
required.`;

export const COMPETITORS_TASK = `## Your task: the competitors

List every brand that sells to the champion's customer: its \`icp\` below — the
same people, with the same problem — in the brief's markets. That is the whole
test of a competitor. A product for other people or another problem is not one,
even when it shares an active (a baby diaper cream is not a competitor of an
adult skin-fold cream): do not list it. A product for the same people and
problem is one, whatever its actives.

Two classes, decided by a mechanical test on form:

- **direct** — the champion's customer, **same** form;
- **indirect** — the champion's customer, **different** form (a spray, gummy
  or tea where the champion is a liquid). Research these as fully as direct ones.

**Shares an active** means it contains the same substance as one of the
champion's actives, whatever its page calls it — a Latin name, another part or
preparation of the same plant, a brand name for the same extract. A different
compound (another salt of a mineral, another plant) is a different active.

How to work:
1. Find candidates. If you have \`discover_competitors\`, call it first, once: it
   names brands from a research pass over the whole web, including ones sold
   only direct or through ads. Then widen by the customer's problem, not only
   the champion's actives: \`web_search\` "<problem> <form>" for every form
   (cream, powder, spray, capsules, drops, gummies…), "best <problem> <market>"
   and "<active> <problem>", and \`amazon_find_product\` "<problem>". If you have
   \`ad_library_search\`, search the problem in ad copy too (\`countries\` the
   brief's markets as ISO codes): brands that sell only through Meta ads appear
   there and nowhere else. An ad's landing domain names the brand behind a
   persona page. A search result, an ad or a discovered brand is a candidate,
   not a competitor.
2. For each, \`web_fetch\` its own product page and read who it is for and what
   it treats. If that audience or problem differs from the champion's \`icp\`,
   it is not a competitor, **even with the same active**: record nothing for it
   and move on. Otherwise \`record_source\` it, then \`record_competitor\` in the
   same turn: \`id\` c1, c2…; name, brand, url; its
   \`form\` (one of {forms}) and \`form_as_printed\`; its actives as its own
   page names them, with dose; \`shared_actives\` — which of the champion's
   actives it contains, **copied word for word from the champion's list below**
   (a pick from that list, never its own wording), or [] when it shares none;
   \`icp_as_printed\` — who its own page says it is for and what it treats, word
   for word; \`relation\` (checked against the forms); \`dose_per_serving\`, \`price\`, \`price_per_dose\`;
   \`positioning_copy\` — its headline, word for word; \`market\` exactly as the
   brief's Markets line names it. A brand sold only outside those markets is
   out of scope. Where both forms are \`other\`, your \`relation\` stands, and
   \`form_as_printed\` must say specifically what each product is.
3. Ads: a competitor's ad is an \`ad_library\` source with \`first_seen\` (null
   plus a gap when undated), linked from the competitor's \`ad_source_ids\`.
   \`ad_library_search\` by its domain (\`search_in\` "domain") finds them.
4. Stop per class: a class is done when three sources in a row surface no new
   brand of that class. \`record_saturation\` twice, \`class\` "direct" and
   "indirect", each point a source with \`new_themes\` = new brands it added.
   A class you cannot saturate is a \`record_gap\` with missing
   "saturation: <class>: <why>".
5. \`record_node_status\` (\`complete\` only if both classes saturated), gaps,
   then \`finish\`.

Every row you record carries \`node: "competitors"\`. At least one gap is
required.`;
