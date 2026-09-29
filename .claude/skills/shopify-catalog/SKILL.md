---
name: shopify-catalog
description: Firecrawl Alexandria — the catalog of data providers callable through Firecrawl — with Shopify as the worked example. Use when asked to connect to a Shopify store, pull product catalog data (title, price, variants, rating, media, features) from a Shopify product URL or id, or find and call any other Alexandria data provider. Discovery is free; calls cost Firecrawl credits (Shopify lookup is 5), not Apify.
---

# Shopify catalog via Firecrawl

Shopify is reached through Firecrawl, not a Shopify API key. Firecrawl's
`/v2/scrape` endpoint takes an `alexandria` request naming a provider
(`shopify`) and a capability (`catalog/lookup_catalog`), and returns structured
product records instead of scraped HTML. The key is `FIRECRAWL_API_KEY` from
this repo's `.env`, the same one the app uses (`server/src/config/settings.ts`).

The script is `.claude/skills/shopify-catalog/bin/shopify`. It reads the key
itself and never prints it.

```bash
S=.claude/skills/shopify-catalog/bin/shopify

$S discover "look up shopify product details by url"     # free
$S lookup https://www.allbirds.com/products/mens-tree-runners --country US
$S lookup <url-or-id> <url-or-id> ... --currency GBP --language en
$S call shopify catalog/search_catalog '{"query":"running shoes"}'
```

## The three rules

1. **Discover before you retrieve.** `discover "<what you are trying to do>"`
   calls `POST /v2/search` with `sources: ["alexandria"]`. It is free
   (`creditsUsed: 0`) and returns `.data.tools[]`, each with a `provider`, a
   `capability` and a sentence on when to use it.
2. **Call only a capability that discovery returned.** `call <provider>
   <capability> '<options>'` sends `POST /v2/scrape` with
   `{alexandria: {provider, capability, options}}`. This one spends credits.
3. **Tell the user what each call cost.** Every paid call prints
   `==> <provider> <capability> cost: N credits` to stderr, read from
   `.data.alexandria[].creditsCost`. Quote that line.

Firecrawl's setup text says discovery returns each capability's price. As
measured on 2026-09-29 it does not: `.data.tools[]` has only `provider`,
`capability`, `description`. Learn the price from the capability's page
(below) before calling, or from the cost line after.

The Firecrawl CLI (`firecrawl-cli`) and the Firecrawl MCP server do the same
thing through different front ends. Neither is installed here and neither is
needed: this script uses the existing `FIRECRAWL_API_KEY`.

## Cost

`discover` is free. A Shopify `lookup` is 5 Firecrawl credits per call,
whether it asks for 1 or 50 products, so batch ids into one call. This is
Firecrawl billing, not Apify, so the "ask before Apify" rule does not cover
it — but do not loop it.

## lookup — `catalog/lookup_catalog`

- positional args: 1–50 product ids (from a search) or product URLs. Required.
- `--country` two-letter (US, GB), `--currency` three-letter (USD, GBP),
  `--language` (en, en-US), `--region` (state/province), `--postal_code`,
  `--intent` (free-text shopping preference), `--view` (leave unset).
- `--filters '<json>'`, e.g. `{"available":true,"price":{"max":15000}}`.
  Prices are in **minor units**: 15000 is USD 150.00.

## Reading the response

Firecrawl's published docs show products at `.data.products`. **The live
response nests them one level deeper**, measured 2026-09-29:

```
.success                                     true
.data.alexandria[0].creditsCost              5
.data.alexandria[0].data.products[]          the records
.data.alexandria[0].data.messages            unmatched ids are reported here
```

Each product has `id` (`gid://shopify/p/...`), `title`, `description.plain`,
`price_range.{min,max}.{amount,currency}` (minor units), `variants[]`,
`media[]`, `rating.{value,count,scale_min,scale_max}`, `options[]` (e.g.
Color, size) and `metadata.{unique_selling_points,top_features,tech_specs}`.

```bash
$S lookup <url> | jq '.data.alexandria[0].data.products[]
  | {title, price: (.price_range.min.amount/100), currency: .price_range.min.currency,
     rating: .rating.value, reviews: .rating.count}'
```

An empty `products` with `success: true` means the id or URL did not match —
check `messages`, not the HTTP status.

## Other capabilities

`call` sends any capability, for any provider. To see a capability's options,
response fields and price, use find-tools. It is free (measured: 0 credits):

```bash
$S call firecrawl find-tools '{"providers":["shopify"],"level":"tools","expand":["options","response"]}' \
  | jq '.data.alexandria[0].data.items[] | {capability, creditsCost, options: [.options[].name]}'
```

The per-capability pages on firecrawl.dev return 404 (checked 2026-09-29).

All six Shopify capabilities cost 5 credits per call:

| capability | input | returns |
|---|---|---|
| `catalog/search_catalog` | `query` (a product name), `limit` ≤50, `cursor`, `like` (similar to an id or image) | products across all Shopify merchants, `pagination.total_count` |
| `catalog/lookup_catalog` | 1–50 ids or product URLs | products |
| `catalog/get_product` | one id, `selected` variant options | one product |
| `storefront/search_catalog` | `store_domain`, optional `query`, `limit` ≤250 | one store's products, plus `url`, `tags`, `categories`, `collections` |
| `storefront/lookup_catalog` | `store_domain`, 1–10 ids from that store | products |
| `storefront/get_product` | `store_domain`, one id | one product |

Search results page with `pagination.cursor` / `has_next_page`: repeat the
same query with the cursor. Each result's `variants[].seller` names the shop
(`name`, `url`, `domain`, policy links).
