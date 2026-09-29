# Firecrawl Shopify API: what each response contains

This file covers two runs of the same six calls:

- **Run 1: magnesium glycinate.** The storefront calls use shop.drberg.com. See the sections below.
- **Run 2: intertrigo.** The storefront calls use www.healora.com. See [Run 2: Intertrigo](#run-2-intertrigo) at the end.

The six calls come from two families of Shopify endpoints behind Firecrawl, and each family has three operations:

| | Search (many products) | Lookup (resolve an ID/URL) | Get (one product in detail) |
|---|---|---|---|
| **Catalog**: Shopify's cross-merchant catalog (all stores) | `1-catalog-search.json` | `2-catalog-lookup.json` | `3-catalog-get.json` |
| **Storefront**: a single store's own catalog | `4-storefront-search.json` | `5-storefront-lookup.json` | `6-storefront-get.json` |

Every call succeeded (`upstreamStatus: 200`) and cost **5 credits**, so each run cost 30 credits.

**How to reproduce:** each call is a `POST https://api.firecrawl.dev/v2/scrape` with body `{"alexandria":[{"provider":"shopify","capability":"<capability>","options":{...}}]}`. Required options:
- Catalog search: `query`
- Catalog lookup: `product_ids` (catalog IDs or product URLs)
- Catalog get: `product_id`
- Storefront calls: all of the above, plus `store_domain`

Discovering the tools and their input options (`provider: "firecrawl", capability: "find-tools"`) is free.

# Run 1: Magnesium glycinate

**Prices are in cents.** `1899` means **$18.99 USD**.

---

## Shared envelope

All six files are wrapped the same way:

```
success            true/false
scrape_id          Firecrawl request ID
data.creditsCost   total credits charged (5)
data.alexandria[0]
  ├─ provider          "shopify"
  ├─ capability        which endpoint ran, e.g. "catalog/search_catalog"
  ├─ creditsCost       5
  ├─ records           number of products returned
  ├─ upstreamStatus    HTTP status from Shopify (200)
  ├─ alexandriaId / providerRequestId   internal trace IDs
  └─ data              the actual payload (products[] or product)
```

---

## 1. `1-catalog-search.json`: Catalog search

This is a Firecrawl Shopify **Catalog** search for **magnesium glycinate**: page 1 of **273** results (5 per page), costing 5 credits. `has_next_page: true`, and a `cursor` is returned for fetching page 2.

| # | Product | Seller | Price | Rating (reviews) | Key spec |
|---|---|---|---|---|---|
| 1 | Pure Encapsulations Magnesium (Glycinate), 90 caps | Supplement First (authorized reseller) | $27.00 | 4.8 (543) | 120 mg Mg per capsule (29% DV), vegan |
| 2 | Dr. Berg Magnesium Glycinate + D3 | Dr. Berg | $18.99 | 4.9 (2,586) | Adds vitamin D3, B6 (P5P) and zinc picolinate |
| 3 | Wholesome Magnesium Glycinate, bottle | We Heart Nutrition® | $29.99 | 4.9 (577) | Unbuffered, flexible dosing |
| 4 | Clean Genuine Magnesium Glycinate, 60 caps | British Supplements (UK) | $19.00 | 4.7 (287) | UK-made, "no fillers or binders" |
| 5 | Pure Magnesium Glycinate, 90 caps | Organics Ocean | $35.00 | 4.7 (3,749) | 275 mg elemental Mg per capsule |

Ratings in the table are **variant-level** (the specific listing). Product-level ratings, which aggregate across sellers and variants, differ: Pure Encapsulations 4.8 (1,379), Dr. Berg 4.9 (2,739), Wholesome 4.9 (597), Clean Genuine 4.8 (560), Organics Ocean 4.6 (3,746).

**Data per product:**
- **Identity:** a universal catalog ID (`gid://shopify/p/...`), title, and a short plain-text description
- **Rating:** value, scale (1–5), and review count, at both product and variant level
- **Options:** the choices a shopper can make, e.g. Pack quantity 90 / 180 / 360 capsules
- **AI-generated metadata:**
  - `unique_selling_points`: one-line pitch
  - `top_features`: 4–5 benefit bullets
  - `tech_specs`: structured "Key: Value" facts such as dose, form, dietary flags and certifications
- **Media:** image URLs with alt text
- **Price range:** min and max
- **Variant:** exactly one "best" variant per product, with:
  - price and availability
  - direct product URL
  - **checkout_url**, a cart link that adds 1 unit
  - condition (`new`)
  - `eligible.native_checkout` (false for all five)
  - **Seller block:** shop name, website, `.myshopify.com` domain, shop ID, and links to the privacy, terms, refund and shipping policies

**Things to watch in this data:** the AI metadata is not always consistent with itself. Organics Ocean's USP says "400 mg elemental magnesium", but its specs say 275 mg. Clean Genuine is listed as "Form: Powder" while its options are capsule counts. Dr. Berg's capsules list "Net Weight: 500 g".

---

## 2. `2-catalog-lookup.json`: Catalog lookup

This call resolves a **known product URL** (`allbirds.com/products/mens-tree-runners`) to its catalog entry. It returns 1 record, and the variant's `inputs` field shows which input it matched (`match: "featured"`).

| Product | Seller | Price | Rating (reviews) | Key spec |
|---|---|---|---|---|
| Men's Tree Runner, Jet Black (White Sole), size 8 | Allbirds | $100.00 | 4.6 (830 variant / **69,657** product) | Eucalyptus tree-fiber upper, lightweight, neutral fit |

- **Options:** Color (Jet Black / Mist / Wheat) × Size (8 / 9 / 10)
- **Fields:** identical in shape to catalog search, plus `inputs[]` (what you looked up and how it matched)
- **Use case:** turn a URL you already have into structured data (price, rating, seller, specs) without running a search

---

## 3. `3-catalog-get.json`: Catalog get product

This call fetches one catalog product by ID: the Dr. Berg Magnesium Glycinate (`gid://shopify/p/mFbS8K0gfSwR36uJFSB9u`), with the **Size: 90 Capsules** option selected.

| Product | Seller | Price | Rating (reviews) | Images |
|---|---|---|---|---|
| Magnesium Glycinate with Naturally Sourced Vitamin D3, 90 caps | Dr. Berg | $18.99 | 4.9 (2,586 variant / 2,739 product) | **11** |

- Same fields as the search result for this product. The difference is the full image gallery (11 images, compared with 2 in search) and a `selected[]` array showing which option combination the variant represents.
- **Use case:** drill into one search hit for full detail.

---

## 4. `4-storefront-search.json`: Storefront search (single store)

This search runs **inside one merchant's store** (Dr. Berg, `shop.drberg.com`) for a magnesium query. It returns 5 products; there is a next page, but there is **no total count**.

| # | Product | Price | List price (MSRP) | Variants | Notes |
|---|---|---|---|---|---|
| 1 | Magnesium Glycinate + D3 (90 / 150 caps) | $18.99–$27.99 | $22.79–$33.59 | 2 | best-seller |
| 2 | Magnesium Powder Drink, Raspberry Lemon, 50 servings | $32.99 | $40.25 | 1 | 325 mg Mg glycinate/serving, best-seller |
| 3 | Electrolyte Capsules w/ Potassium & Magnesium, 160 caps | $24.99 | $30.74 | 1 | uses magnesium citrate |
| 4 | Electrolyte Powder, 1000 mg Potassium + Mg | $35.99–$46.99 | $48.65–$58.38 | 10 | 8 flavors × 50/100 servings |
| 5 | Zinc w/ Magnesium, D3 & Selenium, 60 caps | $19.99 | $23.99 | 1 | best-seller |

Every price is roughly **17–26% below list price**, a permanent "sale" framing.

**What storefront returns that catalog doesn't:**
- **`list_price` / `list_price_range`:** compare-at price (MSRP), so you can see discount depth
- **All variants**, each with its **SKU** (e.g. `mg-90-c-V2`), rather than one "best" variant
- **Merchant tags** (19–37 per product): internal SKUs, ingredients, and marketing flags such as `best-seller`, `Buy with Prime`, `Halal certified`, `In Stock`, and Amazon FBA SKUs (`mg-90-c-FBA`)
- **Collections:** how the store merchandises the product (Health Interest, Minerals, Sleep Support, Immune Support, Keto…)
- **Shopify taxonomy category** (`hb-1-9-6-6`, which is Health & Beauty > vitamins/supplements)
- **Full HTML description:** the merchant's own copy, not an AI summary
- `requires.shipping`, `gift_card`, product `handle`, and a canonical product URL

**What storefront lacks compared with catalog:** ratings/reviews, the seller block, and AI metadata (USPs, features, specs).

---

## 5. `5-storefront-lookup.json`: Storefront lookup

This call resolves a store product ID (`gid://shopify/Product/6923967299656`) within Dr. Berg's store. It returns 1 product, with `inputs[].match: "featured"`.

| Product | Variant | SKU | Price | List | Available |
|---|---|---|---|---|---|
| Magnesium Glycinate + D3 | 90 Capsules | mg-90-c-V2 | $18.99 | $22.79 | Yes |

- Returns only the matched variant, but `options` still lists both sizes (90 / 150).
- Includes all **10 collections** the product belongs to, each with a URL. Search showed only 5.
- Tags are **not** returned here, unlike search.

---

## 6. `6-storefront-get.json`: Storefront get product

This is the full detail for the same Dr. Berg product with **Size: 90 Capsules** selected. It is the only response that includes **subscription (selling plan) data**:

| Plan | Discount | Recurring | Recharge plan ID |
|---|---|---|---|
| Every 1 month, 10% off + free shipping | 10% | Yes | 18795746 |
| Every 2 months, 10% off + free shipping | 10% | Yes | 18795745 |
| Every 3 months, 10% off + free shipping | 10% | Yes | 18795744 |

- `requires.selling_plan: false` means one-time purchase is also allowed.
- The "Recharge Plan ID" option shows the store uses **Recharge** for subscriptions, which is useful tech-stack intel.
- Everything else matches storefront lookup: SKU, price vs. list price, 10 collections, category, and the HTML description.

---

## Catalog vs. Storefront at a glance

| Data point | Catalog (1–3) | Storefront (4–6) |
|---|---|---|
| Scope | All Shopify merchants | One store |
| Product ID | `gid://shopify/p/...` (universal) | `gid://shopify/Product/...` (store-specific) |
| Ratings & review counts | ✅ product + variant | ❌ |
| Seller info + policy links | ✅ | ❌ (implied by store) |
| AI summary: USPs, features, tech specs | ✅ | ❌ |
| Description | short plain text (AI) | full merchant HTML |
| Price | ✅ | ✅ |
| List/compare-at price (discount) | ❌ | ✅ |
| Variants | 1 best-match variant | all variants (search) / selected (lookup, get) |
| SKUs | ❌ | ✅ |
| Tags | ❌ | ✅ (search only) |
| Collections & taxonomy | ❌ | ✅ |
| Subscription plans | ❌ | ✅ (get only) |
| Total result count | ✅ (273) | ❌ |
| Checkout link | branded domain + UTM/`_gsid` tracking | raw `.myshopify.com/cart/...` |
| Image gallery | 1–2 in search, full in get (11) | 1 per product |

**Rule of thumb for market research:** use **Catalog** to scan a category across competitors (price, ratings, sellers, positioning). Then use **Storefront** on a specific competitor to get their full line-up, discount strategy, SKUs, merchandising, and subscription offer.

---

# Run 2: Intertrigo

This run uses the same six calls with the query **"intertrigo"** (a rash in skin folds) and `country: "US"`. Healora is used for the storefront calls because it held 2 of the top 5 catalog results. All six calls succeeded; the run cost 30 credits.

| File | Call | Input |
|---|---|---|
| `1-catalog-search.json` | catalog/search_catalog | `query: "intertrigo"`, `limit: 5` |
| `2-catalog-lookup.json` | catalog/lookup_catalog | `https://eloracircle.com/products/elora-intertrigo-relief` |
| `3-catalog-get.json` | catalog/get_product | `gid://shopify/p/3dD4OTxB1ZPj9t5sNqYDqV` (Healora, from search) |
| `4-storefront-search.json` | storefront/search_catalog | `store_domain: www.healora.com`, `query: "intertrigo"`, `limit: 5` |
| `5-storefront-lookup.json` | storefront/lookup_catalog | `gid://shopify/Product/7940704763983` (from storefront search) |
| `6-storefront-get.json` | storefront/get_product | same product ID |

## 1. Catalog search: "intertrigo"

This is page 1 of **358** results (5 per page). `has_next_page: true`, and a cursor is returned.

| # | Product | Seller | Price | Rating (reviews) | Key spec / claim |
|---|---|---|---|---|---|
| 1 | Elora Intertrigo Relief Cream | Elora (eloracircle.com) | $34.00 | 3.8 (127) | "Free from harsh chemicals", non-greasy |
| 2 | Intertrigo Relief Cream By Healora V1, 1 tube | Healora™ (healora.com) | $29.95 | 5.0 (1) | Steroid-free, "science-backed", for sensitive skin |
| 3 | 3x Intertrigo Relief Cream | Healora™ | $54.95 | 5.0 (8) | Fast-drying, "clinically-backed", tube |
| 4 | PureCrest Intertrigo Relief Cream, 1 tube | PureCrest (trypurecrest.com) | $29.95 | 4.0 (1) | "Clinically proven", non-greasy, non-staining |
| 5 | Asolla Intertrigo Relief Cream | Asolla (exx10b-dr.myshopify.com) | $34.95 | 4.3 (30) | Topical, for adults |

Product-level ratings differ from the variant-level ones in the table:
- Healora V1: 4.2 (13)
- Healora 3x: 5.0 (5)
- Elora, PureCrest and Asolla: no product-level rating returned

**What stands out:**
- **The market is a cluster of small DTC brands** selling nearly the same product: an "intertrigo relief cream" priced at $29.95–$34.95 for one tube, with 2x and 3x bundles.
- **None of the five names an active ingredient.** In the AI tech specs, Healora 3x says "Active Ingredient: Not specified", and Asolla's reads `Active ingredient: []`.
- **Positioning claims** repeat across brands: steroid-free, clinically backed or proven, and non-greasy.
- **Review counts are tiny** except for Elora (127), which is also the lowest rated at 3.8.
- **Asolla has no custom domain.** Its seller URL is the raw `.myshopify.com` address, which is typical of a new or test store.

## 2. Catalog lookup: Elora by product URL

| Product | Seller | Price | Rating (reviews) | Options |
|---|---|---|---|---|
| Elora Intertrigo Relief Cream | Elora | $34.00 | 3.8 (127, variant) | none (single SKU) |

- The URL resolved to the same catalog ID as in search (`gid://shopify/p/P2t4V92FU8XstdhRTWO2D`), with `inputs[].match: "featured"`.
- There is no product-level rating and no bundle options. Elora sells only a single tube.

## 3. Catalog get: Healora Intertrigo Relief Cream

The catalog **merges several separate Healora store listings into one universal product** (`3dD4OTxB1ZPj9t5sNqYDqV`). It has 5 images, a rating of 4.2 (13), and 4 variants:

| Variant | Price | Rating (reviews) |
|---|---|---|
| Healora Intertrigo Relief Cream | $29.95 | 5.0 (1) |
| 2x Healora Intertrigo Relief Cream | $39.95 | 4.4 (9) |
| Intertrigo Relief Cream By Healora 2x | $39.95 | — |
| Healora Intertrigo Relief Cream, 1pc | $29.95 | — |

The merged option list is messy: `Package: 2x / 6x / 2x cream / 1x… / 2x… / 3x…` and `Quantity: 3x Intertrigo Relief + 1x FREE`. That mess is a clue that the store runs many duplicate funnel listings, which storefront search confirms below.

## 4. Storefront search: healora.com, "intertrigo"

This returned 5 products and has a next page.

| # | Product (handle) | Price | List price | Discount | Collection |
|---|---|---|---|---|---|
| 1 | Intertrigo Relief Cream By Healora V1 (`healora-intertrigo-cream-sub1`) | $29.95–$49.95 | $59.90–$99.90 | ~50% | Home page, Healora Treatments, Featured Treatments |
| 2 | 3x Intertrigo Relief Cream (`3x-intertrigo-relief-cream`) | $54.95 | $99.90 | 45% | Healora Intertrigo Bundles |
| 3 | Intertrigo Relief Cream By Healora 2x (`healora-intertrigo-cream-sub2`) | $39.95 | $99.90 | 60% | none |
| 4 | 2x Healora Intertrigo Relief Creams (`2x-healora-intertrigo-relief-creams`) | $44.95 | $99.90 | 55% | Healora Intertrigo Bundles |
| 5 | 3x Intertrigo Relief Creams (`3x-intertrigo-relief-cream-monthly`) | $54.95 | $99.95 | 45% | none (tag: `1 unit upsell`) |

Variants of the main product (#1):

| Variant | SKU | Price | List | Discount |
|---|---|---|---|---|
| 1x tube | 43936348569679 | $29.95 | $59.90 | 50% |
| 2x tubes | 43936348569680 | $39.95 | $79.90 | 50% |
| 3x tubes | 43936348569681 | $49.95 | $99.90 | 50% |
| 3x + 1 FREE | 45080452595791 | $49.95 | $59.90 | 17% |

**What stands out:**
- **One cream, five listings, several prices.** A 2-tube bundle costs $39.95 on one listing and $44.95 on another. A 3-tube bundle costs $49.95 on one and $54.95 on another. Handles such as `sub1`, `sub2` and `…-monthly`, plus the `1 unit upsell` tag, point to landing-page or ad-funnel variants and post-purchase upsells.
- **List prices are inflated anchors.** Everything shows 45–60% off against a flat $99.90 "list price".
- **The product descriptions are empty** (`description.html: ""`). The sales copy lives on the landing pages, not in the product record.
- **Taxonomy:** bundles are categorised as `hb-1-16` (Health & Beauty). The main product is uncategorised (`na`).
- **The checkout goes to `un8d6v-ri.myshopify.com/cart/...`.**
- **Missing compared with the Dr. Berg run:** no merchant tags beyond the single upsell tag, and no ratings, which storefront calls never return.

## 5. Storefront lookup: Healora V1

| Product | Variant | SKU | Price | List | Available |
|---|---|---|---|---|---|
| Intertrigo Relief Cream By Healora V1 | 1x tube | 43936348569679 | $29.95 | $59.90 | Yes |

- `inputs[].match: "featured"`. The response returns only the matched variant, but `options` lists all 4 quantity choices.
- It shows the same 3 collections as search.

## 6. Storefront get: Healora V1 (1x tube selected)

This is the only response with subscription data. The store runs a **"Prevention Plan"** subscription: buyers keep ordering the cream to prevent the rash coming back, not only to treat it. Every plan is `recurring: true` and priced as a fixed amount off in cents (500 = **$5 off**).

| Plan group | Frequencies | Discount |
|---|---|---|
| Prevention Plan Intertrigo Relief Cream (1x) | monthly | $5 off |
| | every 2 or 3 months | $0 |
| Prevention Plan 2x Intertrigo Relief Cream | monthly | $5 off |
| | every 2 or 3 months | $0 |
| Prevention Plan 3x Intertrigo Relief Cream | every 1, 2, 3, 4, 5 or 6 months | $5 off |

- `requires.selling_plan: false` means one-time purchase is still allowed.
- The Dr. Berg run's plans carried a "Recharge Plan ID" option. These plans have only a "Frequency" option, so there's no sign of Recharge here; the subscription app can't be identified from this data.
- The incentive pushes buyers toward **monthly** or the **3-tube** plan. Choosing less often than monthly on the 1x or 2x plan gets no discount.

## Intertrigo takeaways for research

- **Competitive set:** Elora, Healora, PureCrest and Asolla, all Shopify DTC brands selling look-alike creams at about $30–35 per tube. Scanning pages 2+ via the cursor would widen this list; there are 358 results in total.
- **Healora's playbook, fully visible from the API:**
  - an anchor price with 50% off
  - 2x and 3x bundles
  - duplicate funnel product pages with price tests
  - a "3 + 1 free" offer
  - a post-purchase upsell SKU
  - a "Prevention Plan" subscription
- **Gaps to exploit:** no competitor names an active ingredient, and review volume is very low (under 30 reviews for everyone except Elora). Transparency about ingredients and social proof are open positioning angles.
