# Shops

---

# List shops

`GET /v1/shops`

Returns the lightweight public shops browse surface. This endpoint stays intentionally simple and covers the default discovery path through search, pagination, sorting, and a small stable subset of filters. For the full advanced filtering contract, use POST /v1/shops/query.

**Tags:** Shops

## Parameters

**Query parameter groups:**

- Pagination: `offset`, `limit`
- Search: `search`
- Time and snapshots: `adsTimePeriod`, `createdAfter`, `createdBefore`
- Sorting: `sortBy`, `order`
- Filters: `minMonthlyVisits`, `maxMonthlyVisits`, `minActiveAds`, `maxActiveAds`, `hasTikTok`, `minTikTokFollowers`, `maxTikTokFollowers`, `minTikTokActiveAds`, `maxTikTokActiveAds`, `minTikTokTotalPosts`, `maxTikTokTotalPosts`, `minProductsCount`, `maxProductsCount`, `isShopifyPlus`, `categoryIds`, `pixelIds`, `excludePixelIds`, `shopifyAppIds`, `excludeShopifyAppIds`, `languages`, `currencies`, `minTrustpilotRating`, `maxTrustpilotRating`, `minTrustpilotReviewCount`, `maxTrustpilotReviewCount`, `minMonthlySales`, `maxMonthlySales`, `minUnitsSold`, `maxUnitsSold`

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `search` | query | No | `string` | Optional broad shop identity search term matched against domain, related domains, and shop name. This GET browse search remains broad; use POST /v1/shops/query with searchType="domain" for exact domain matching. |
| `sortBy` | query | No | `monthlyVisits` \| `activeAds` \| `growth30d` \| `productsCount` \| `createdAt` \| `tiktokFollowers` \| `tiktokActiveAds` \| `tiktokTotalPosts` \| `tiktokAvgActiveAds7d` \| `tiktokAvgActiveAds30d` \| `estMonthlySales` \| `unitsSold` | Optional sort key for the shops list. Defaults to monthlyVisits. |
| `order` | query | No | `asc` \| `desc` | Optional sort order. Defaults to desc. |
| `offset` | query | No | `integer` | Pagination offset. Defaults to 0. |
| `limit` | query | No | `integer` | Maximum number of shops to return. Defaults to 32. |
| `minMonthlyVisits` | query | No | `integer` | Optional minimum monthly visits filter. |
| `maxMonthlyVisits` | query | No | `integer` | Optional maximum monthly visits filter. |
| `minActiveAds` | query | No | `number` | Optional minimum active ads filter. The metric follows adsTimePeriod. |
| `maxActiveAds` | query | No | `number` | Optional maximum active ads filter. The metric follows adsTimePeriod. |
| `adsTimePeriod` | query | No | `last24h` \| `last7d` \| `last30d` | Optional time period used by active ads filters and sorting. Defaults to last24h. |
| `hasTikTok` | query | No | `boolean` | Optional TikTok presence filter backed by the legacy flat shop index. true requires an indexed TikTok page or handle; false excludes shops with one. |
| `minTikTokFollowers` | query | No | `number` |  |
| `maxTikTokFollowers` | query | No | `number` |  |
| `minTikTokActiveAds` | query | No | `number` |  |
| `maxTikTokActiveAds` | query | No | `number` |  |
| `minTikTokTotalPosts` | query | No | `number` |  |
| `maxTikTokTotalPosts` | query | No | `number` |  |
| `minProductsCount` | query | No | `integer` | Optional minimum products count filter. |
| `maxProductsCount` | query | No | `integer` | Optional maximum products count filter. |
| `createdAfter` | query | No | `string` | Optional inclusive lower bound for shop creation date. |
| `createdBefore` | query | No | `string` | Optional inclusive upper bound for shop creation date. |
| `isShopifyPlus` | query | No | `boolean` | Optional Shopify Plus filter. |
| `categoryIds` | query | No | `integer`[] | Optional category ids. Uses the same index field as POST /v1/shops/query categoryIds. |
| `pixelIds` | query | No | `string`[] | Optional canonical pixel UUIDs. Uses the same index fields as POST /v1/shops/query pixelIds. Resolve display names through /v1/facets/pixels. |
| `excludePixelIds` | query | No | `string`[] | Optional canonical pixel UUIDs to exclude. Uses the same index fields as POST /v1/shops/query excludePixelIds. |
| `shopifyAppIds` | query | No | `string`[] | Optional canonical Shopify app UUIDs. Uses the same index field as POST /v1/shops/query shopifyAppIds. |
| `excludeShopifyAppIds` | query | No | `string`[] | Optional canonical Shopify app UUIDs to exclude. Uses the same index field as POST /v1/shops/query excludeShopifyAppIds. |
| `languages` | query | No | `string`[] | Optional default language filters. Accepts repeated query params or a comma-separated list. |
| `currencies` | query | No | `string`[] | Optional default currency filters. Accepts repeated query params or a comma-separated list. |
| `minTrustpilotRating` | query | No | `number` | Optional minimum Trustpilot rating filter. |
| `maxTrustpilotRating` | query | No | `number` | Optional maximum Trustpilot rating filter. |
| `minTrustpilotReviewCount` | query | No | `integer` | Optional minimum Trustpilot reviews filter. |
| `maxTrustpilotReviewCount` | query | No | `integer` | Optional maximum Trustpilot reviews filter. |
| `minMonthlySales` | query | No | `integer` | Minimum estimated revenue over the last 30 days, in USD (sales tracker). Shops the tracker does not follow are excluded. |
| `maxMonthlySales` | query | No | `integer` | Maximum estimated revenue over the last 30 days, in USD (sales tracker). |
| `minUnitsSold` | query | No | `integer` | Minimum units sold over the last 30 days (sales tracker). Shops the tracker does not follow are excluded. |
| `maxUnitsSold` | query | No | `integer` | Maximum units sold over the last 30 days (sales tracker). |

## Responses

### 200 - Paginated shops response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": [
    {
      "id": "3f8aa146-6f96-46e8-9781-64db5166f9a8",
      "domain": "example.com",
      "name": "Example Shop",
      "screenshotUrl": "https://cdn.example.com/screenshots/example.com.png",
      "createdAt": "2024-01-15T00:00:00.000Z",
      "profile": {
        "countryCode": "US",
        "currency": "USD",
        "isShopifyPlus": true
      },
      "catalog": {
        "productsCount": 124,
        "mainCategory": "Fashion",
        "bestSellers": [
          {
            "imageUrl": "https://cdn.shopify.com/s/files/1/1442/3288/files/PDP_QUIET_WHITE_01-805740.png",
            "title": "Loop Quiet™ 2",
            "price": 19.95,
            "currency": "EUR"
          }
        ]
      },
      "traffic": {
        "monthlyVisits": 45231,
        "growth30d": 0.18,
        "history": [
          {
            "period": "2026-03-01",
            "value": 2942350
          }
        ],
        "topCountries": [
          {
            "countryCode": "US",
            "share": 0.64
          }
        ]
      },
      "sales": {
        "currency": "USD",
        "estMonthlySales": 222540,
        "unitsSold": 1823
      },
      "advertising": {
        "activeAds": 12,
        "linkedAdvertisersCount": 2,
        "history": [
          {
            "period": "2026-03-01",
            "value": 2942350
          }
        ],
        "topCountries": [
          {
            "countryCode": "US",
            "share": 0.64
          }
        ]
      },
      "tiktok": {
        "hasTikTok": true,
        "pageId": "6802334614847603717",
        "handle": "examplebrand",
        "profileMetrics": {
          "followers": 128430,
          "totalPosts": 342,
          "newPosts": 12,
          "totalViews": 9823431,
          "totalLikes": 456789
        },
        "activity": {
          "activeAds": 7,
          "totalAds": 33,
          "avgActiveAds7d": 5.5,
          "avgActiveAds30d": 4.25
        },
        "lastUpdatedAt": "2026-06-05T08:30:00.000Z"
      },
      "googleAds": {
        "status": "available",
        "liveAds": 14,
        "adsLaunched30d": 5,
        "reach": {
          "value": 245000,
          "label": "Google reported reach",
          "euUkOnly": false
        },
        "topCountries": [
          {
            "code": "FR",
            "ads": 12,
            "reach": 185000
          }
        ],
        "platformMix": [
          {
            "platform": "SEARCH",
            "ads": 8
          }
        ]
      },
      "latestAds": [
        {
          "id": "facebook_1059447873925448",
          "mediaType": "video",
          "mediaUrl": "https://medias.trendtrack.io/video/facebook/1317841346869775.mp4",
          "thumbnailUrl": "https://medias.trendtrack.io/thumbnails/facebook/1317841346869775.jpg"
        }
      ]
    }
  ],
  "pagination": {
    "limit": 32,
    "offset": 0,
    "total": 128
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `data` | `object`[] | Yes |  |
| `pagination` | `object` | Yes |  |

**`data[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes |  |
| `domain` | `string` | Yes |  |
| `name` | `string` | Yes |  |
| `screenshotUrl` | `string` | Yes |  |
| `createdAt` | `string` | Yes |  |
| `profile` | `object` | Yes |  |
| `catalog` | `object` | Yes |  |
| `traffic` | `object` | Yes |  |
| `sales` | `object` | No | Current sales estimate. Null when the sales tracker does not follow the shop. Present on shop-search rows; omitted by the deprecated favorites endpoints. |
| `advertising` | `object` | Yes |  |
| `tiktok` | `object` | Yes |  |
| `googleAds` | `object` | No | Compact best-effort Google Ads summary hydrated for returned shop-search pages. When aggregation fails, status is unavailable and metric values are null. Present on shop-search rows; omitted by older summary producers that do not run Google Ads hydration. |
| `latestAds` | `object`[] | Yes | Up to 3 most recent Meta ads published by the shop. |

**`profile` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `countryCode` | `string` | Yes |  |
| `currency` | `string` | Yes |  |
| `isShopifyPlus` | `boolean` | Yes |  |

**`catalog` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `productsCount` | `number` | Yes |  |
| `mainCategory` | `string` | Yes |  |
| `bestSellers` | `object`[] | Yes | Top best-selling products for this shop. Capped at 3 items. Sourced from `shopify_best_selling` when available, with fallback to `best_sellers_object` then `best_sellers` image URLs. |

**`bestSellers[]` item properties:**


**`traffic` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `monthlyVisits` | `number` | Yes |  |
| `growth30d` | `number` | Yes |  |
| `history` | `object`[] | Yes | Monthly visits time-series, sorted ascending by period. Capped at the 6 most recent months. |
| `topCountries` | `object`[] | Yes | Top markets by traffic share (country code + share in [0, 1]). Derived from SimilarWeb geography breakdown when available, otherwise from the `countries` list with null shares. |

**`history[]` item properties:**


**`topCountries[]` item properties:**


**`sales` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `currency` | `USD` | Yes | The tracker converts every product price to USD. |
| `estMonthlySales` | `number` | Yes | Estimated revenue over the last 30 days, in whole USD. An estimate from the sales tracker; 0 means the tracker measured no sales. |
| `unitsSold` | `number` | Yes | Units sold over the same 30 days. A floor: the shop sold at least this many. |

**`advertising` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `activeAds` | `number` | Yes |  |
| `linkedAdvertisersCount` | `number` | Yes |  |
| `history` | `object`[] | Yes | Weekly active-ads time-series, sorted ascending by period. Capped at the 26 most recent weekly points (~6 months). |
| `topCountries` | `object`[] | Yes | Top countries by Meta ads volume (share in [0, 1]). Derived from the shop-level `ads_country_stats` aggregate across all linked advertisers. |

**`history[]` item properties:**


**`topCountries[]` item properties:**


**`tiktok` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `hasTikTok` | `boolean` | Yes | True when the shop has an indexed TikTok page/handle or TikTok rollup activity. This is independent from Meta advertising fields. |
| `pageId` | `string` | Yes |  |
| `handle` | `string` | Yes |  |
| `profileMetrics` | `object` | Yes |  |
| `activity` | `object` | Yes |  |
| `lastUpdatedAt` | `string` | Yes |  |

**`profileMetrics` properties:**


**`activity` properties:**


**`googleAds` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `status` | `available` \| `unavailable` | Yes | available when the Google Ads aggregation succeeded; unavailable when enrichment failed or was intentionally skipped. Shop search still succeeds when unavailable. |
| `liveAds` | `number` | Yes |  |
| `adsLaunched30d` | `number` | Yes | Google Ads first seen in the most recent 30 days. |
| `reach` | `object` | Yes |  |
| `topCountries` | `object`[] | Yes | Top Google Ads audience countries. Distinct from shop.profile.countryCode and traffic.topCountries. |
| `platformMix` | `object`[] | Yes |  |

**`reach` properties:**


**`topCountries[]` item properties:**


**`platformMix[]` item properties:**


**`latestAds[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes |  |
| `mediaType` | `image` \| `video` | Yes |  |
| `mediaUrl` | `string` | Yes |  |
| `thumbnailUrl` | `string` | Yes |  |

**`pagination` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `limit` | `number` | Yes |  |
| `offset` | `number` | Yes |  |
| `total` | `number` | Yes |  |

### 401 - Authentication failed. Possible error codes: missing_api_key, invalid_api_key, credential_not_found, credential_revoked, credential_expired.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |

### 403 - Workspace or delegated access rejected. Possible error codes: workspace_public_api_disabled, workspace_public_api_suspended, delegated_user_access_revoked.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |

### 500 - Unexpected public API failure. Possible error code: internal_error.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |

### 503 - Public auth provider is temporarily unavailable. Possible error code: auth_provider_unavailable.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |


---

# Query shops

`POST /v1/shops/query`

Returns the advanced public shops discovery surface. This endpoint is the canonical public route for complex filtering and sorting, while keeping the response aligned with the standard public ShopSummary contract. searchType=domain performs exact domain/related-domain matching from a domain or URL and does not fall back to broad wildcard/text matching.

**Tags:** Shops

## Request Body

**Content-Type:** `application/json`

**Find one shop by exact domain or URL (domain/related-domain exact matching):**

```json
{
  "search": "https://www.allbirds.com/products",
  "searchType": "domain",
  "limit": 10,
  "offset": 0
}
```

**Find growing shops by product text in the US market:**

```json
{
  "search": "pet products",
  "searchType": "productName",
  "sortBy": "monthlyVisits",
  "order": "desc",
  "adsTimePeriod": "last7d",
  "minActiveAds": 10,
  "minMonthlyVisits": 5000,
  "mainMarketCountries": [
    "US"
  ],
  "limit": 25,
  "offset": 0
}
```

**Find shops with broad website text search:**

```json
{
  "search": "organic cotton",
  "searchType": "shopContains",
  "limit": 25,
  "offset": 0
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `search` | `string` | No | Optional search string. For searchType="domain", send a domain or URL for exact domain/related-domain matching. For broad website text search, use shopContains. For product text, use productName. Do not send unsupported legacy keys name, domain, or domains. |
| `searchType` | `domain` \| `productName` \| `shopContains` | No | Search mode. domain performs exact domain/related-domain matching from a domain or URL, productName searches indexed product text, and shopContains matches website text, keeping the 10,000 most relevant shops before filters and sorting are applied. |
| `sortBy` | `relevance` \| `monthlyVisits` \| `activeAds` \| `growth30d` \| `productsCount` \| `createdAt` \| `tiktokFollowers` \| `tiktokActiveAds` \| `tiktokTotalPosts` \| `tiktokAvgActiveAds7d` \| `tiktokAvgActiveAds30d` \| `estMonthlySales` \| `unitsSold` | No | Sort key for the advanced shops query surface. relevance orders by monthlyVisits, as in the Trendtrack app: the search text filters shops but does not rank them. |
| `order` | `asc` \| `desc` | No | Enum value accepted by this request. Allowed values: `asc`, `desc`. |
| `offset` | `number` | No |  |
| `limit` | `number` | No |  |
| `categoryIds` | `number`[] | No | Optional category ids used by the current shop discovery index. |
| `minEstimatedRevenue` | `number` | No | Deprecated and rejected with 400: use minMonthlySales, read from the sales tracker. |
| `maxEstimatedRevenue` | `number` | No | Deprecated and rejected with 400: use maxMonthlySales, read from the sales tracker. |
| `minMonthlySales` | `number` | No | Minimum estimated revenue over the last 30 days, in USD (sales tracker). Shops the tracker does not follow are excluded. |
| `maxMonthlySales` | `number` | No | Maximum estimated revenue over the last 30 days, in USD (sales tracker). |
| `minUnitsSold` | `number` | No | Minimum units sold over the last 30 days (sales tracker). Shops the tracker does not follow are excluded. |
| `maxUnitsSold` | `number` | No | Maximum units sold over the last 30 days (sales tracker). |
| `minMonthlyVisits` | `number` | No |  |
| `maxMonthlyVisits` | `number` | No |  |
| `minProductsCount` | `number` | No |  |
| `maxProductsCount` | `number` | No |  |
| `createdAfter` | `string` | No |  |
| `createdBefore` | `string` | No |  |
| `mainMarketCountries` | `string`[] | No | Optional main audience-market filter using uppercase ISO 3166-1 alpha-2 country codes matched against the indexed main_market field. |
| `marketCountries` | `string`[] | No | Optional audience-market filter for shops where these countries appear among the indexed traffic markets. |
| `excludeMarketCountries` | `string`[] | No |  |
| `minBestSellerPrice` | `number` | No |  |
| `maxBestSellerPrice` | `number` | No |  |
| `minActiveAds` | `number` | No | Optional minimum active ads filter. The metric follows adsTimePeriod. |
| `maxActiveAds` | `number` | No | Optional maximum active ads filter. The metric follows adsTimePeriod. |
| `adsTimePeriod` | `last24h` \| `last7d` \| `last30d` | No | Time window accepted by this request. Allowed values: `last24h`, `last7d`, `last30d`. |
| `hasTikTok` | `boolean` | No | Optional TikTok presence filter backed by the legacy flat shop index. true requires an indexed TikTok page or handle; false excludes shops with one. |
| `minTikTokFollowers` | `number` | No |  |
| `maxTikTokFollowers` | `number` | No |  |
| `minTikTokActiveAds` | `number` | No |  |
| `maxTikTokActiveAds` | `number` | No |  |
| `minTikTokTotalPosts` | `number` | No |  |
| `maxTikTokTotalPosts` | `number` | No |  |
| `isShopifyPlus` | `boolean` | No |  |
| `trafficGrowth` | `object`[] | No | Traffic growth filters. Each condition uses `period`, `comparison`, and `value`; optional `operator` links the condition to the next one. |
| `adsGrowth` | `object`[] | No | Ads growth filters. Each condition uses `period`, `comparison`, and `value`; optional `operator` links the condition to the next one. |
| `pageReachGrowth` | `object`[] | No | Page reach growth filters. Each condition uses `period`, `comparison`, and `value`; optional `operator` links the condition to the next one. |
| `adReachGrowth` | `object`[] | No | Ad reach growth filters. Each condition uses `period`, `comparison`, and `value`; optional `operator` links the condition to the next one. |
| `creationCountries` | `string`[] | No |  |
| `excludeCreationCountries` | `string`[] | No |  |
| `displayInTrending` | `boolean` | No | When true, restricts results to shops visible in the Trendtrack trending shops feed. |
| `themeIds` | `string`[] | No | Optional canonical Shopify theme UUIDs backed by the current website discovery index. Use /v1/facets/themes to resolve display names. |
| `pixelIds` | `string`[] | No | Optional canonical pixel UUIDs backed by the current website discovery index. Use /v1/facets/pixels to resolve display names. |
| `excludePixelIds` | `string`[] | No | Optional canonical pixel UUIDs to exclude. Use /v1/facets/pixels to resolve display names. |
| `shopifyAppIds` | `string`[] | No | Optional canonical Shopify app UUIDs backed by the current website discovery index. Use /v1/facets/shopify-apps to resolve names to ids. |
| `excludeShopifyAppIds` | `string`[] | No | Optional canonical Shopify app UUIDs to exclude. Use /v1/facets/shopify-apps to resolve names to ids. |
| `minTrustpilotRating` | `number` | No |  |
| `maxTrustpilotRating` | `number` | No |  |
| `minTrustpilotReviewCount` | `number` | No |  |
| `maxTrustpilotReviewCount` | `number` | No |  |
| `languages` | `string`[] | No |  |
| `currencies` | `string`[] | No |  |
| `dtcRegion` | `all` \| `us` \| `eu` | No | Optional DTC preset. all means any indexed DTC shop, while us and eu also apply the corresponding creation-country subset used by the app. |

**`trafficGrowth[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `period` | `last30d` \| `last90d` \| `last180d` | Yes | Indexed traffic growth window. |
| `value` | `number` | No | Minimum or maximum growth threshold, expressed as a percentage. |
| `comparison` | `greater` \| `lower` | Yes | Comparison applied to the growth threshold. Use `greater` for gte and `lower` for lte semantics. |
| `operator` | `and` \| `or` | No | Logical operator linking this condition to the next one in the array. |

**`adsGrowth[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `period` | `last7d` \| `last30d` \| `last90d` | Yes | Indexed ads growth window. |
| `value` | `number` | No | Minimum or maximum growth threshold, expressed as a percentage. |
| `comparison` | `greater` \| `lower` | Yes | Comparison applied to the growth threshold. Use `greater` for gte and `lower` for lte semantics. |
| `operator` | `and` \| `or` | No | Comparison operator for this rule. Allowed values: `and`, `or`. |

**`pageReachGrowth[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `period` | `last7d` \| `last14d` \| `last30d` \| `last60d` \| `last90d` | Yes | Indexed reach growth window. |
| `value` | `number` | No | Minimum or maximum growth threshold, expressed as a percentage. |
| `comparison` | `greater` \| `lower` | Yes | Comparison applied to the growth threshold. Use `greater` for gte and `lower` for lte semantics. |
| `operator` | `and` \| `or` | No | Comparison operator for this rule. Allowed values: `and`, `or`. |

**`adReachGrowth[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `period` | `last7d` \| `last14d` \| `last30d` \| `last60d` \| `last90d` | Yes | Indexed reach growth window. |
| `value` | `number` | No | Minimum or maximum growth threshold, expressed as a percentage. |
| `comparison` | `greater` \| `lower` | Yes | Comparison applied to the growth threshold. Use `greater` for gte and `lower` for lte semantics. |
| `operator` | `and` \| `or` | No | Comparison operator for this rule. Allowed values: `and`, `or`. |

## Responses

### 200 - Paginated advanced shops query response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": [
    {
      "id": "3f8aa146-6f96-46e8-9781-64db5166f9a8",
      "domain": "example.com",
      "name": "Example Shop",
      "screenshotUrl": "https://cdn.example.com/screenshots/example.com.png",
      "createdAt": "2024-01-15T00:00:00.000Z",
      "profile": {
        "countryCode": "US",
        "currency": "USD",
        "isShopifyPlus": true
      },
      "catalog": {
        "productsCount": 124,
        "mainCategory": "Fashion",
        "bestSellers": [
          {
            "imageUrl": "https://cdn.shopify.com/s/files/1/1442/3288/files/PDP_QUIET_WHITE_01-805740.png",
            "title": "Loop Quiet™ 2",
            "price": 19.95,
            "currency": "EUR"
          }
        ]
      },
      "traffic": {
        "monthlyVisits": 45231,
        "growth30d": 0.18,
        "history": [
          {
            "period": "2026-03-01",
            "value": 2942350
          }
        ],
        "topCountries": [
          {
            "countryCode": "US",
            "share": 0.64
          }
        ]
      },
      "sales": {
        "currency": "USD",
        "estMonthlySales": 222540,
        "unitsSold": 1823
      },
      "advertising": {
        "activeAds": 12,
        "linkedAdvertisersCount": 2,
        "history": [
          {
            "period": "2026-03-01",
            "value": 2942350
          }
        ],
        "topCountries": [
          {
            "countryCode": "US",
            "share": 0.64
          }
        ]
      },
      "tiktok": {
        "hasTikTok": true,
        "pageId": "6802334614847603717",
        "handle": "examplebrand",
        "profileMetrics": {
          "followers": 128430,
          "totalPosts": 342,
          "newPosts": 12,
          "totalViews": 9823431,
          "totalLikes": 456789
        },
        "activity": {
          "activeAds": 7,
          "totalAds": 33,
          "avgActiveAds7d": 5.5,
          "avgActiveAds30d": 4.25
        },
        "lastUpdatedAt": "2026-06-05T08:30:00.000Z"
      },
      "googleAds": {
        "status": "available",
        "liveAds": 14,
        "adsLaunched30d": 5,
        "reach": {
          "value": 245000,
          "label": "Google reported reach",
          "euUkOnly": false
        },
        "topCountries": [
          {
            "code": "FR",
            "ads": 12,
            "reach": 185000
          }
        ],
        "platformMix": [
          {
            "platform": "SEARCH",
            "ads": 8
          }
        ]
      },
      "latestAds": [
        {
          "id": "facebook_1059447873925448",
          "mediaType": "video",
          "mediaUrl": "https://medias.trendtrack.io/video/facebook/1317841346869775.mp4",
          "thumbnailUrl": "https://medias.trendtrack.io/thumbnails/facebook/1317841346869775.jpg"
        }
      ]
    }
  ],
  "pagination": {
    "limit": 32,
    "offset": 0,
    "total": 128
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `data` | `object`[] | Yes |  |
| `pagination` | `object` | Yes |  |

**`data[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes |  |
| `domain` | `string` | Yes |  |
| `name` | `string` | Yes |  |
| `screenshotUrl` | `string` | Yes |  |
| `createdAt` | `string` | Yes |  |
| `profile` | `object` | Yes |  |
| `catalog` | `object` | Yes |  |
| `traffic` | `object` | Yes |  |
| `sales` | `object` | No | Current sales estimate. Null when the sales tracker does not follow the shop. Present on shop-search rows; omitted by the deprecated favorites endpoints. |
| `advertising` | `object` | Yes |  |
| `tiktok` | `object` | Yes |  |
| `googleAds` | `object` | No | Compact best-effort Google Ads summary hydrated for returned shop-search pages. When aggregation fails, status is unavailable and metric values are null. Present on shop-search rows; omitted by older summary producers that do not run Google Ads hydration. |
| `latestAds` | `object`[] | Yes | Up to 3 most recent Meta ads published by the shop. |

**`profile` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `countryCode` | `string` | Yes |  |
| `currency` | `string` | Yes |  |
| `isShopifyPlus` | `boolean` | Yes |  |

**`catalog` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `productsCount` | `number` | Yes |  |
| `mainCategory` | `string` | Yes |  |
| `bestSellers` | `object`[] | Yes | Top best-selling products for this shop. Capped at 3 items. Sourced from `shopify_best_selling` when available, with fallback to `best_sellers_object` then `best_sellers` image URLs. |

**`bestSellers[]` item properties:**


**`traffic` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `monthlyVisits` | `number` | Yes |  |
| `growth30d` | `number` | Yes |  |
| `history` | `object`[] | Yes | Monthly visits time-series, sorted ascending by period. Capped at the 6 most recent months. |
| `topCountries` | `object`[] | Yes | Top markets by traffic share (country code + share in [0, 1]). Derived from SimilarWeb geography breakdown when available, otherwise from the `countries` list with null shares. |

**`history[]` item properties:**


**`topCountries[]` item properties:**


**`sales` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `currency` | `USD` | Yes | The tracker converts every product price to USD. |
| `estMonthlySales` | `number` | Yes | Estimated revenue over the last 30 days, in whole USD. An estimate from the sales tracker; 0 means the tracker measured no sales. |
| `unitsSold` | `number` | Yes | Units sold over the same 30 days. A floor: the shop sold at least this many. |

**`advertising` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `activeAds` | `number` | Yes |  |
| `linkedAdvertisersCount` | `number` | Yes |  |
| `history` | `object`[] | Yes | Weekly active-ads time-series, sorted ascending by period. Capped at the 26 most recent weekly points (~6 months). |
| `topCountries` | `object`[] | Yes | Top countries by Meta ads volume (share in [0, 1]). Derived from the shop-level `ads_country_stats` aggregate across all linked advertisers. |

**`history[]` item properties:**


**`topCountries[]` item properties:**


**`tiktok` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `hasTikTok` | `boolean` | Yes | True when the shop has an indexed TikTok page/handle or TikTok rollup activity. This is independent from Meta advertising fields. |
| `pageId` | `string` | Yes |  |
| `handle` | `string` | Yes |  |
| `profileMetrics` | `object` | Yes |  |
| `activity` | `object` | Yes |  |
| `lastUpdatedAt` | `string` | Yes |  |

**`profileMetrics` properties:**


**`activity` properties:**


**`googleAds` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `status` | `available` \| `unavailable` | Yes | available when the Google Ads aggregation succeeded; unavailable when enrichment failed or was intentionally skipped. Shop search still succeeds when unavailable. |
| `liveAds` | `number` | Yes |  |
| `adsLaunched30d` | `number` | Yes | Google Ads first seen in the most recent 30 days. |
| `reach` | `object` | Yes |  |
| `topCountries` | `object`[] | Yes | Top Google Ads audience countries. Distinct from shop.profile.countryCode and traffic.topCountries. |
| `platformMix` | `object`[] | Yes |  |

**`reach` properties:**


**`topCountries[]` item properties:**


**`platformMix[]` item properties:**


**`latestAds[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes |  |
| `mediaType` | `image` \| `video` | Yes |  |
| `mediaUrl` | `string` | Yes |  |
| `thumbnailUrl` | `string` | Yes |  |

**`pagination` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `limit` | `number` | Yes |  |
| `offset` | `number` | Yes |  |
| `total` | `number` | Yes |  |

### 401 - Authentication failed. Possible error codes: missing_api_key, invalid_api_key, credential_not_found, credential_revoked, credential_expired.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |

### 403 - Workspace or delegated access rejected. Possible error codes: workspace_public_api_disabled, workspace_public_api_suspended, delegated_user_access_revoked.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |

### 500 - Unexpected public API failure. Possible error code: internal_error.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |

### 503 - Public auth provider is temporarily unavailable. Possible error code: auth_provider_unavailable.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |


---

# List shops similar to a domain or shop id

`GET /v1/shops/{identifier}/similar`

Returns a paginated list of similar shops using the public hybrid shops contract. The identifier can be a canonical domain or a public shop id / website UUID. When the resolved shop is not present in the similar shops engine, the endpoint still returns 200 with an empty data array and meta.shopExists=false.

**Tags:** Shops

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `identifier` | path | Yes | `string` | Canonical shop domain or stable public shop id / website UUID used to resolve similar shops. |
| `sortBy` | query | No | `relevance` \| `monthlyVisits` \| `activeAds` \| `growth30d` \| `productsCount` \| `createdAt` | Sort key for similar shops. createdAt uses request-time normalization while the backing creation_date field remains keyword-mapped; native date sorting requires an Elasticsearch mapping/reindex update. |
| `order` | query | No | `asc` \| `desc` | Optional sort order. Defaults to desc. |
| `offset` | query | No | `integer` | Pagination offset. Defaults to 0. |
| `limit` | query | No | `integer` | Maximum number of similar shops to return. Defaults to 32. |

## Responses

### 200 - Paginated similar shops response for the requested identifier. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": [
    {
      "shop": {
        "id": "3f8aa146-6f96-46e8-9781-64db5166f9a8",
        "domain": "example.com",
        "name": "Example Shop",
        "screenshotUrl": "https://cdn.example.com/screenshots/example.com.png",
        "createdAt": "2024-01-15T00:00:00.000Z",
        "profile": {
          "countryCode": "US",
          "currency": "USD",
          "isShopifyPlus": true
        },
        "catalog": {
          "productsCount": 124,
          "mainCategory": "Fashion",
          "bestSellers": [
            {
              "imageUrl": "https://cdn.shopify.com/s/files/1/1442/3288/files/PDP_QUIET_WHITE_01-805740.png",
              "title": "Loop Quiet™ 2",
              "price": 19.95,
              "currency": "EUR"
            }
          ]
        },
        "traffic": {
          "monthlyVisits": 45231,
          "growth30d": 0.18,
          "history": [
            {
              "period": "2026-03-01",
              "value": 2942350
            }
          ],
          "topCountries": [
            {
              "countryCode": "US",
              "share": 0.64
            }
          ]
        },
        "sales": {
          "currency": "USD",
          "estMonthlySales": 222540,
          "unitsSold": 1823
        },
        "advertising": {
          "activeAds": 12,
          "linkedAdvertisersCount": 2,
          "history": [
            {
              "period": "2026-03-01",
              "value": 2942350
            }
          ],
          "topCountries": [
            {
              "countryCode": "US",
              "share": 0.64
            }
          ]
        },
        "tiktok": {
          "hasTikTok": true,
          "pageId": "6802334614847603717",
          "handle": "examplebrand",
          "profileMetrics": {
            "followers": 128430,
            "totalPosts": 342,
            "newPosts": 12,
            "totalViews": 9823431,
            "totalLikes": 456789
          },
          "activity": {
            "activeAds": 7,
            "totalAds": 33,
            "avgActiveAds7d": 5.5,
            "avgActiveAds30d": 4.25
          },
          "lastUpdatedAt": "2026-06-05T08:30:00.000Z"
        },
        "googleAds": {
          "status": "available",
          "liveAds": 14,
          "adsLaunched30d": 5,
          "reach": {
            "value": 245000,
            "label": "Google reported reach",
            "euUkOnly": false
          },
          "topCountries": [
            {
              "code": "FR",
              "ads": 12,
              "reach": 185000
            }
          ],
          "platformMix": [
            {
              "platform": "SEARCH",
              "ads": 8
            }
          ]
        },
        "latestAds": [
          {
            "id": "facebook_1059447873925448",
            "mediaType": "video",
            "mediaUrl": "https://medias.trendtrack.io/video/facebook/1317841346869775.mp4",
            "thumbnailUrl": "https://medias.trendtrack.io/thumbnails/facebook/1317841346869775.jpg"
          }
        ]
      },
      "similarityScore": 0.9137
    }
  ],
  "pagination": {
    "limit": 32,
    "offset": 0,
    "total": 128
  },
  "meta": {
    "shopExists": true
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `data` | `object`[] | Yes |  |
| `pagination` | `object` | Yes |  |
| `meta` | `object` | Yes |  |

**`data[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `shop` | `object` | Yes |  |
| `similarityScore` | `number` | Yes |  |

**`shop` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes |  |
| `domain` | `string` | Yes |  |
| `name` | `string` | Yes |  |
| `screenshotUrl` | `string` | Yes |  |
| `createdAt` | `string` | Yes |  |
| `profile` | `object` | Yes |  |
| `catalog` | `object` | Yes |  |
| `traffic` | `object` | Yes |  |
| `sales` | `object` | No | Current sales estimate. Null when the sales tracker does not follow the shop. Present on shop-search rows; omitted by the deprecated favorites endpoints. |
| `advertising` | `object` | Yes |  |
| `tiktok` | `object` | Yes |  |
| `googleAds` | `object` | No | Compact best-effort Google Ads summary hydrated for returned shop-search pages. When aggregation fails, status is unavailable and metric values are null. Present on shop-search rows; omitted by older summary producers that do not run Google Ads hydration. |
| `latestAds` | `object`[] | Yes | Up to 3 most recent Meta ads published by the shop. |

**`profile` properties:**


**`catalog` properties:**


**`traffic` properties:**


**`sales` properties:**


**`advertising` properties:**


**`tiktok` properties:**


**`googleAds` properties:**


**`latestAds[]` item properties:**


**`pagination` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `limit` | `number` | Yes |  |
| `offset` | `number` | Yes |  |
| `total` | `number` | Yes |  |

**`meta` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `shopExists` | `boolean` | Yes | False when the resolved shop/domain does not exist in the similar shops engine. |

### 401 - Authentication failed. Possible error codes: missing_api_key, invalid_api_key, credential_not_found, credential_revoked, credential_expired.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |

### 403 - Workspace or delegated access rejected. Possible error codes: workspace_public_api_disabled, workspace_public_api_suspended, delegated_user_access_revoked.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |

### 404 - A UUID-shaped shop identifier was provided but no matching shop was found. Possible error code: not_found.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |

### 500 - Unexpected public API failure. Possible error code: internal_error.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |

### 503 - Public auth provider is temporarily unavailable. Possible error code: auth_provider_unavailable.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |


---

# Search products by image

`POST /v1/products/image-search`

Finds the store products that look like an image, most similar first, one per shop by default (maxPerShop) and with the storefronts of one brand counted as one shop (groupBrands). Send the image as a multipart file or as a public URL; read the next pages with the returned searchId. Costs 4 credits per product returned.

**Tags:** Shops

## Request Body

**Content-Type:** `multipart/form-data`

```json
{
  "image": "string",
  "imageUrl": "https://cdn.shopify.com/s/files/1/0000/products/lamp.jpg",
  "searchId": "string",
  "offset": 0,
  "limit": 20,
  "groupBrands": true,
  "maxPerShop": 1
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `image` | `string` | No | Image file (JPEG, PNG or WEBP, 10 MB max), sent as multipart/form-data. Provide exactly one of image, imageUrl or searchId. |
| `imageUrl` | `string` | No | Public http(s) URL of the image. The server downloads it (10 MB max). |
| `searchId` | `string` | No | searchId returned by a previous image search of this workspace. Replays the same image to read its next pages without sending it again. |
| `offset` | `number` | No |  |
| `limit` | `number` | No |  |
| `groupBrands` | `boolean` | No | Count the storefronts of one brand (same root domain across countries, or the same Shopify store on several domains) as one shop. False keeps every storefront apart; the same store on several domains always counts once. |
| `maxPerShop` | `number` | No | Products returned per shop (or brand), most similar first; 0 = no cap. A product repeated in one shop (variants, duplicate photos) is always returned once. |

**Content-Type:** `application/json`

```json
{
  "image": "string",
  "imageUrl": "https://cdn.shopify.com/s/files/1/0000/products/lamp.jpg",
  "searchId": "string",
  "offset": 0,
  "limit": 20,
  "groupBrands": true,
  "maxPerShop": 1
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `image` | `string` | No | Image file (JPEG, PNG or WEBP, 10 MB max), sent as multipart/form-data. Provide exactly one of image, imageUrl or searchId. |
| `imageUrl` | `string` | No | Public http(s) URL of the image. The server downloads it (10 MB max). |
| `searchId` | `string` | No | searchId returned by a previous image search of this workspace. Replays the same image to read its next pages without sending it again. |
| `offset` | `number` | No |  |
| `limit` | `number` | No |  |
| `groupBrands` | `boolean` | No | Count the storefronts of one brand (same root domain across countries, or the same Shopify store on several domains) as one shop. False keeps every storefront apart; the same store on several domains always counts once. |
| `maxPerShop` | `number` | No | Products returned per shop (or brand), most similar first; 0 = no cap. A product repeated in one shop (variants, duplicate photos) is always returned once. |

## Responses

### 200

**Content-Type:** `application/json`

```json
{
  "requestId": "string",
  "data": [
    {
      "product": {
        "shopifyId": 7429183447215,
        "title": "Moon lamp",
        "imageUrl": "string",
        "price": 29.9,
        "currency": "USD",
        "similarityScore": 0.91
      },
      "shop": {
        "id": "3f8aa146-6f96-46e8-9781-64db5166f9a8",
        "domain": "example.com",
        "name": "Example Shop",
        "screenshotUrl": "https://cdn.example.com/screenshots/example.com.png",
        "createdAt": "2024-01-15T00:00:00.000Z",
        "profile": {
          "countryCode": "US",
          "currency": "USD",
          "isShopifyPlus": true
        },
        "catalog": {
          "productsCount": 124,
          "mainCategory": "Fashion",
          "bestSellers": [
            {
              "imageUrl": "https://cdn.shopify.com/s/files/1/1442/3288/files/PDP_QUIET_WHITE_01-805740.png",
              "title": "Loop Quiet™ 2",
              "price": 19.95,
              "currency": "EUR"
            }
          ]
        },
        "traffic": {
          "monthlyVisits": 45231,
          "growth30d": 0.18,
          "history": [
            {
              "period": "2026-03-01",
              "value": 2942350
            }
          ],
          "topCountries": [
            {
              "countryCode": "US",
              "share": 0.64
            }
          ]
        },
        "sales": {
          "currency": "USD",
          "estMonthlySales": 222540,
          "unitsSold": 1823
        },
        "advertising": {
          "activeAds": 12,
          "linkedAdvertisersCount": 2,
          "history": [
            {
              "period": "2026-03-01",
              "value": 2942350
            }
          ],
          "topCountries": [
            {
              "countryCode": "US",
              "share": 0.64
            }
          ]
        },
        "tiktok": {
          "hasTikTok": true,
          "pageId": "6802334614847603717",
          "handle": "examplebrand",
          "profileMetrics": {
            "followers": 128430,
            "totalPosts": 342,
            "newPosts": 12,
            "totalViews": 9823431,
            "totalLikes": 456789
          },
          "activity": {
            "activeAds": 7,
            "totalAds": 33,
            "avgActiveAds7d": 5.5,
            "avgActiveAds30d": 4.25
          },
          "lastUpdatedAt": "2026-06-05T08:30:00.000Z"
        },
        "googleAds": {
          "status": "available",
          "liveAds": 14,
          "adsLaunched30d": 5,
          "reach": {
            "value": 245000,
            "label": "Google reported reach",
            "euUkOnly": false
          },
          "topCountries": [
            {
              "code": "FR",
              "ads": 12,
              "reach": 185000
            }
          ],
          "platformMix": [
            {
              "platform": "SEARCH",
              "ads": 8
            }
          ]
        },
        "latestAds": [
          {
            "id": "facebook_1059447873925448",
            "mediaType": "video",
            "mediaUrl": "https://medias.trendtrack.io/video/facebook/1317841346869775.mp4",
            "thumbnailUrl": "https://medias.trendtrack.io/thumbnails/facebook/1317841346869775.jpg"
          }
        ]
      }
    }
  ],
  "pagination": {
    "limit": 32,
    "offset": 0,
    "total": 128
  },
  "meta": {
    "searchId": "string"
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `requestId` | `string` | Yes |  |
| `data` | `object`[] | Yes |  |
| `pagination` | `object` | Yes |  |
| `meta` | `object` | Yes |  |

**`data[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `product` | `object` | Yes |  |
| `shop` | `object` | Yes |  |

**`product` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `shopifyId` | `number` | Yes |  |
| `title` | `string` | Yes |  |
| `imageUrl` | `string` | Yes |  |
| `price` | `number` | Yes |  |
| `currency` | `string` | Yes |  |
| `similarityScore` | `number` | Yes | Cosine similarity between the query image and the product image (0.7 to 1). |

**`shop` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes |  |
| `domain` | `string` | Yes |  |
| `name` | `string` | Yes |  |
| `screenshotUrl` | `string` | Yes |  |
| `createdAt` | `string` | Yes |  |
| `profile` | `object` | Yes |  |
| `catalog` | `object` | Yes |  |
| `traffic` | `object` | Yes |  |
| `sales` | `object` | No | Current sales estimate. Null when the sales tracker does not follow the shop. Present on shop-search rows; omitted by the deprecated favorites endpoints. |
| `advertising` | `object` | Yes |  |
| `tiktok` | `object` | Yes |  |
| `googleAds` | `object` | No | Compact best-effort Google Ads summary hydrated for returned shop-search pages. When aggregation fails, status is unavailable and metric values are null. Present on shop-search rows; omitted by older summary producers that do not run Google Ads hydration. |
| `latestAds` | `object`[] | Yes | Up to 3 most recent Meta ads published by the shop. |

**`profile` properties:**


**`catalog` properties:**


**`traffic` properties:**


**`sales` properties:**


**`advertising` properties:**


**`tiktok` properties:**


**`googleAds` properties:**


**`latestAds[]` item properties:**


**`pagination` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `limit` | `number` | Yes |  |
| `offset` | `number` | Yes |  |
| `total` | `number` | Yes |  |

**`meta` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `searchId` | `string` | Yes | Send it back instead of the image to read the next pages. Null when the search could not be kept. |

### 400 - No image, more than one image, an unsupported file type, or an image that cannot be read.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |

### 401

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |

### 403

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |

### 404 - The searchId is unknown to this workspace.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |

### 413 - The image file is larger than 10 MB.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |

### 503

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |


---

# Search shops by image

`POST /v1/shops/image-search`

Finds the shops selling products that look like an image, the most active advertisers (Meta active ads) first, each with its most similar products. The storefronts of one brand come back as one row with otherStorefronts, billed once (groupBrands). Send the image as a multipart file or as a public URL; read the next pages with the returned searchId. Costs 4 credits per shop returned.

**Tags:** Shops

## Request Body

**Content-Type:** `multipart/form-data`

```json
{
  "image": "string",
  "imageUrl": "https://cdn.shopify.com/s/files/1/0000/products/lamp.jpg",
  "searchId": "string",
  "offset": 0,
  "limit": 20,
  "groupBrands": true,
  "productsPerShop": 3
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `image` | `string` | No | Image file (JPEG, PNG or WEBP, 10 MB max), sent as multipart/form-data. Provide exactly one of image, imageUrl or searchId. |
| `imageUrl` | `string` | No | Public http(s) URL of the image. The server downloads it (10 MB max). |
| `searchId` | `string` | No | searchId returned by a previous image search of this workspace. Replays the same image to read its next pages without sending it again. |
| `offset` | `number` | No |  |
| `limit` | `number` | No |  |
| `groupBrands` | `boolean` | No | Count the storefronts of one brand (same root domain across countries, or the same Shopify store on several domains) as one shop. False keeps every storefront apart; the same store on several domains always counts once. |
| `productsPerShop` | `number` | No | Most similar matching products returned with each shop. |

**Content-Type:** `application/json`

```json
{
  "image": "string",
  "imageUrl": "https://cdn.shopify.com/s/files/1/0000/products/lamp.jpg",
  "searchId": "string",
  "offset": 0,
  "limit": 20,
  "groupBrands": true,
  "productsPerShop": 3
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `image` | `string` | No | Image file (JPEG, PNG or WEBP, 10 MB max), sent as multipart/form-data. Provide exactly one of image, imageUrl or searchId. |
| `imageUrl` | `string` | No | Public http(s) URL of the image. The server downloads it (10 MB max). |
| `searchId` | `string` | No | searchId returned by a previous image search of this workspace. Replays the same image to read its next pages without sending it again. |
| `offset` | `number` | No |  |
| `limit` | `number` | No |  |
| `groupBrands` | `boolean` | No | Count the storefronts of one brand (same root domain across countries, or the same Shopify store on several domains) as one shop. False keeps every storefront apart; the same store on several domains always counts once. |
| `productsPerShop` | `number` | No | Most similar matching products returned with each shop. |

## Responses

### 200

**Content-Type:** `application/json`

```json
{
  "requestId": "string",
  "data": [
    {
      "shop": {
        "id": "3f8aa146-6f96-46e8-9781-64db5166f9a8",
        "domain": "example.com",
        "name": "Example Shop",
        "screenshotUrl": "https://cdn.example.com/screenshots/example.com.png",
        "createdAt": "2024-01-15T00:00:00.000Z",
        "profile": {
          "countryCode": "US",
          "currency": "USD",
          "isShopifyPlus": true
        },
        "catalog": {
          "productsCount": 124,
          "mainCategory": "Fashion",
          "bestSellers": [
            {
              "imageUrl": "https://cdn.shopify.com/s/files/1/1442/3288/files/PDP_QUIET_WHITE_01-805740.png",
              "title": "Loop Quiet™ 2",
              "price": 19.95,
              "currency": "EUR"
            }
          ]
        },
        "traffic": {
          "monthlyVisits": 45231,
          "growth30d": 0.18,
          "history": [
            {
              "period": "2026-03-01",
              "value": 2942350
            }
          ],
          "topCountries": [
            {
              "countryCode": "US",
              "share": 0.64
            }
          ]
        },
        "sales": {
          "currency": "USD",
          "estMonthlySales": 222540,
          "unitsSold": 1823
        },
        "advertising": {
          "activeAds": 12,
          "linkedAdvertisersCount": 2,
          "history": [
            {
              "period": "2026-03-01",
              "value": 2942350
            }
          ],
          "topCountries": [
            {
              "countryCode": "US",
              "share": 0.64
            }
          ]
        },
        "tiktok": {
          "hasTikTok": true,
          "pageId": "6802334614847603717",
          "handle": "examplebrand",
          "profileMetrics": {
            "followers": 128430,
            "totalPosts": 342,
            "newPosts": 12,
            "totalViews": 9823431,
            "totalLikes": 456789
          },
          "activity": {
            "activeAds": 7,
            "totalAds": 33,
            "avgActiveAds7d": 5.5,
            "avgActiveAds30d": 4.25
          },
          "lastUpdatedAt": "2026-06-05T08:30:00.000Z"
        },
        "googleAds": {
          "status": "available",
          "liveAds": 14,
          "adsLaunched30d": 5,
          "reach": {
            "value": 245000,
            "label": "Google reported reach",
            "euUkOnly": false
          },
          "topCountries": [
            {
              "code": "FR",
              "ads": 12,
              "reach": 185000
            }
          ],
          "platformMix": [
            {
              "platform": "SEARCH",
              "ads": 8
            }
          ]
        },
        "latestAds": [
          {
            "id": "facebook_1059447873925448",
            "mediaType": "video",
            "mediaUrl": "https://medias.trendtrack.io/video/facebook/1317841346869775.mp4",
            "thumbnailUrl": "https://medias.trendtrack.io/thumbnails/facebook/1317841346869775.jpg"
          }
        ]
      },
      "otherStorefronts": [
        {
          "id": "string",
          "domain": "fridoorthotics.com",
          "name": "string",
          "monthlyVisits": 0,
          "activeAds": 0
        }
      ],
      "bestSimilarityScore": 0.93,
      "matchingProducts": 4,
      "products": [
        {
          "shopifyId": 7429183447215,
          "title": "Moon lamp",
          "imageUrl": "string",
          "price": 29.9,
          "currency": "USD",
          "similarityScore": 0.91
        }
      ]
    }
  ],
  "pagination": {
    "limit": 32,
    "offset": 0,
    "total": 128
  },
  "meta": {
    "searchId": "string"
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `requestId` | `string` | Yes |  |
| `data` | `object`[] | Yes |  |
| `pagination` | `object` | Yes |  |
| `meta` | `object` | Yes |  |

**`data[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `shop` | `object` | Yes | The storefront of the brand with the most active ads. |
| `otherStorefronts` | `object`[] | Yes | The brand's other storefronts selling matching products (other countries or domains). Empty when groupBrands is false, unless one store is served on several domains. |
| `bestSimilarityScore` | `number` | Yes |  |
| `matchingProducts` | `number` | Yes | Distinct products of the shop (or brand) that look like the image. |
| `products` | `object`[] | Yes |  |

**`shop` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes |  |
| `domain` | `string` | Yes |  |
| `name` | `string` | Yes |  |
| `screenshotUrl` | `string` | Yes |  |
| `createdAt` | `string` | Yes |  |
| `profile` | `object` | Yes |  |
| `catalog` | `object` | Yes |  |
| `traffic` | `object` | Yes |  |
| `sales` | `object` | No | Current sales estimate. Null when the sales tracker does not follow the shop. Present on shop-search rows; omitted by the deprecated favorites endpoints. |
| `advertising` | `object` | Yes |  |
| `tiktok` | `object` | Yes |  |
| `googleAds` | `object` | No | Compact best-effort Google Ads summary hydrated for returned shop-search pages. When aggregation fails, status is unavailable and metric values are null. Present on shop-search rows; omitted by older summary producers that do not run Google Ads hydration. |
| `latestAds` | `object`[] | Yes | Up to 3 most recent Meta ads published by the shop. |

**`profile` properties:**


**`catalog` properties:**


**`traffic` properties:**


**`sales` properties:**


**`advertising` properties:**


**`tiktok` properties:**


**`googleAds` properties:**


**`latestAds[]` item properties:**


**`otherStorefronts[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes |  |
| `domain` | `string` | Yes |  |
| `name` | `string` | Yes |  |
| `monthlyVisits` | `number` | Yes |  |
| `activeAds` | `number` | Yes |  |

**`products[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `shopifyId` | `number` | Yes |  |
| `title` | `string` | Yes |  |
| `imageUrl` | `string` | Yes |  |
| `price` | `number` | Yes |  |
| `currency` | `string` | Yes |  |
| `similarityScore` | `number` | Yes | Cosine similarity between the query image and the product image (0.7 to 1). |

**`pagination` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `limit` | `number` | Yes |  |
| `offset` | `number` | Yes |  |
| `total` | `number` | Yes |  |

**`meta` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `searchId` | `string` | Yes | Send it back instead of the image to read the next pages. Null when the search could not be kept. |

### 400 - No image, more than one image, an unsupported file type, or an image that cannot be read.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |

### 401

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |

### 403

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |

### 404 - The searchId is unknown to this workspace.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |

### 413 - The image file is larger than 10 MB.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |

### 503

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |


---

# List advertisers linked to a shop

`GET /v1/shops/{shopId}/advertisers`

Returns the linked advertiser summaries for a single shop identifier.

**Tags:** Shops

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `shopId` | path | Yes | `string` | Stable public shop identifier. |
| `limit` | query | No | `integer` |  |

## Responses

### 200 - Linked advertisers response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": [
    {
      "id": "1234567890",
      "platform": "facebook",
      "facebookPageId": "1234567890",
      "name": "Acme Brand",
      "isPrimary": true,
      "activeAds": 12
    }
  ]
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `data` | `object`[] | Yes |  |

**`data[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes |  |
| `platform` | `facebook` | Yes |  |
| `facebookPageId` | `string` | Yes |  |
| `name` | `string` | Yes |  |
| `isPrimary` | `boolean` | Yes |  |
| `activeAds` | `number` | Yes |  |

### 400 - The shopId path parameter is not a canonical UUID. Possible error code: bad_request.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |

### 401 - Authentication failed. Possible error codes: missing_api_key, invalid_api_key, credential_not_found, credential_revoked, credential_expired.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |

### 403 - Workspace or delegated access rejected. Possible error codes: workspace_public_api_disabled, workspace_public_api_suspended, delegated_user_access_revoked.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |

### 404 - The requested shop was not found. Possible error code: not_found.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |

### 500 - Unexpected public API failure. Possible error code: internal_error.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |

### 503 - Public auth provider is temporarily unavailable. Possible error code: auth_provider_unavailable.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |


---

# Get shop social follower history

`GET /v1/shops/{shopId}/socials/history`

Returns follower time-series for Facebook and Instagram for the linked advertiser page of the shop. Other networks are handle-only today and not exposed here.

**Tags:** Shops

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `shopId` | path | Yes | `string` | Stable public shop identifier. |
| `period` | query | No | `day` \| `week` \| `month` | Aggregation bucket for the follower time series. Week and month pick the last raw snapshot of each bucket. |
| `days` | query | No | `integer` | Rolling lookback window, in days, ending at the latest snapshot. |

## Responses

### 200 - Follower time-series response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "req_01JN3C9Q2K5X9Y6V7W8Z1A2B3C",
  "data": {
    "facebook": [
      {
        "period": "2026-03-01",
        "value": 2942350
      }
    ],
    "instagram": [
      {
        "period": "2026-03-01",
        "value": 2942350
      }
    ]
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `requestId` | `string` | Yes |  |
| `data` | `object` | Yes |  |

**`data` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `facebook` | `object`[] | Yes | Facebook follower snapshots ordered ascending by period. Empty when no Facebook page is linked to the shop. |
| `instagram` | `object`[] | Yes | Instagram follower snapshots ordered ascending by period. Empty when the linked Facebook page has no connected Instagram account. |

**`facebook[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `period` | `string` | Yes | ISO date string representing the period start. Month-first (YYYY-MM-DD) for monthly series, week-first for weekly series. |
| `value` | `number` | Yes |  |

**`instagram[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `period` | `string` | Yes | ISO date string representing the period start. Month-first (YYYY-MM-DD) for monthly series, week-first for weekly series. |
| `value` | `number` | Yes |  |

### 400 - The shopId path parameter is not a canonical UUID. Possible error code: bad_request.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |

### 401 - Authentication failed. Possible error codes: missing_api_key, invalid_api_key, credential_not_found, credential_revoked, credential_expired.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |

### 403 - Workspace or delegated access rejected. Possible error codes: workspace_public_api_disabled, workspace_public_api_suspended, delegated_user_access_revoked.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |

### 404 - The requested shop was not found. Possible error code: not_found.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |

### 500 - Unexpected public API failure. Possible error code: internal_error.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |

### 503 - Public auth provider is temporarily unavailable. Possible error code: auth_provider_unavailable.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |


---

# Get shop sales history

`GET /v1/shops/{shopId}/sales/history`

Returns the daily readings of the sales tracker for a shop: estimated revenue and units sold, each over the 30 days before the reading. Estimates, in USD. Costs 4 credits per call.

**Tags:** Shops

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `shopId` | path | Yes | `string` | Stable public shop identifier. |
| `period` | query | No | `day` \| `week` \| `month` | One reading per day, week or month. Week and month keep the last daily reading of each bucket; readings are never summed, since each one already covers the 30 days before it. |
| `days` | query | No | `integer` | Rolling lookback window, in days, ending at the latest reading. |

## Responses

### 200

**Content-Type:** `application/json`

```json
{
  "requestId": "req_01JN3C9Q2K5X9Y6V7W8Z1A2B3C",
  "data": {
    "currency": "USD",
    "history": [
      {
        "date": "2026-09-29",
        "estMonthlySales": 222540,
        "estMonthlySalesMin": 170450,
        "estMonthlySalesMax": 274103,
        "unitsSold": 1823
      }
    ]
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `requestId` | `string` | Yes |  |
| `data` | `object` | Yes |  |

**`data` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `currency` | `USD` | Yes |  |
| `history` | `object`[] | Yes | Readings ordered ascending by date, ending on the current estimate. Empty when the sales tracker does not follow the shop. The history starts on 2026-09-18. |

**`history[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `date` | `string` | Yes | UTC day of the reading (YYYY-MM-DD). |
| `estMonthlySales` | `number` | Yes | Estimated revenue over the 30 days before `date`, in whole USD. Not the revenue of that single day. |
| `estMonthlySalesMin` | `number` | Yes |  |
| `estMonthlySalesMax` | `number` | Yes |  |
| `unitsSold` | `number` | Yes | Units sold over the same 30 days, as a floor. |

### 400

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |

### 401

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |

### 403

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |

### 404

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |

### 500

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |

### 503

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |


---

# List shop products

`GET /v1/shops/{shopId}/products`

Returns the paginated list of Shopify best-selling products for a single shop. Products come from the shop’s Shopify best-seller feed and can be sorted by rank, price, or creation date.

**Tags:** Shops

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `shopId` | path | Yes | `string` | Stable public shop identifier. |
| `limit` | query | No | `integer` | Maximum number of products to return per page. |
| `offset` | query | No | `integer` | Offset into the products list. |
| `sortBy` | query | No | `popularity` \| `price` \| `createdAt` | Sort key. `popularity` orders by Shopify best-seller rank; `price` by product price; `createdAt` by Shopify product creation date. |
| `order` | query | No | `asc` \| `desc` | Sort direction. Defaults to `asc` for `popularity` and `desc` otherwise. |

## Responses

### 200 - Paginated shop products response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "req_01JN3C9Q2K5X9Y6V7W8Z1A2B3C",
  "data": [
    {
      "id": "7869034926321",
      "title": "Loop Quiet™ 2",
      "handle": "loop-quiet-2",
      "imageUrl": "https://cdn.shopify.com/s/files/1/1442/3288/files/PDP_QUIET_WHITE_01-805740.png",
      "productUrl": "https://loopearplugs.com/products/loop-quiet-2",
      "price": 19.95,
      "currency": "EUR",
      "rank": 1,
      "createdAt": "2024-08-20T00:00:00.000Z",
      "publishedAt": "2024-08-22T00:00:00.000Z"
    }
  ],
  "pagination": {
    "limit": 32,
    "offset": 0,
    "total": 128
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `requestId` | `string` | Yes |  |
| `data` | `object`[] | Yes |  |
| `pagination` | `object` | Yes |  |

**`data[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes | Upstream Shopify numeric product id (as a string). |
| `title` | `string` | Yes |  |
| `handle` | `string` | Yes | Shopify product handle (URL slug). |
| `imageUrl` | `string` | Yes |  |
| `productUrl` | `string` | Yes |  |
| `price` | `number` | Yes |  |
| `currency` | `string` | Yes |  |
| `rank` | `number` | Yes | Position of the product in the shop’s best-seller list, with 1 being the best seller. |
| `createdAt` | `string` | Yes | Shopify product creation date. |
| `publishedAt` | `string` | Yes | Shopify product publication date. |

**`pagination` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `limit` | `number` | Yes |  |
| `offset` | `number` | Yes |  |
| `total` | `number` | Yes |  |

### 400 - The shopId path parameter is not a canonical UUID. Possible error code: bad_request.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |

### 401 - Authentication failed. Possible error codes: missing_api_key, invalid_api_key, credential_not_found, credential_revoked, credential_expired.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |

### 403 - Workspace or delegated access rejected. Possible error codes: workspace_public_api_disabled, workspace_public_api_suspended, delegated_user_access_revoked.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |

### 404 - The requested shop was not found. Possible error code: not_found.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |

### 500 - Unexpected public API failure. Possible error code: internal_error.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |

### 503 - Public auth provider is temporarily unavailable. Possible error code: auth_provider_unavailable.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |


---

# Get a shop by id

`GET /v1/shops/{shopId}`

Returns the public hybrid shop detail read model for a single shop identifier.

**Tags:** Shops

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `shopId` | path | Yes | `string` | Stable public shop identifier. |

## Responses

### 200 - Detailed public shop response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": {
    "id": "3f8aa146-6f96-46e8-9781-64db5166f9a8",
    "domain": "example.com",
    "name": "Example Shop",
    "screenshotUrl": "https://cdn.example.com/screenshots/example.com.png",
    "createdAt": "2024-01-15T00:00:00.000Z",
    "profile": {
      "countryCode": "US",
      "currency": "USD",
      "isShopifyPlus": true,
      "defaultLanguage": "en"
    },
    "trustpilot": {
      "rating": 4.7,
      "reviewCount": 1834,
      "brandName": "Loop Earplugs",
      "brandLogo": "https://s3-eu-west-1.amazonaws.com/tpd/logos/...png",
      "url": "https://www.trustpilot.com/review/loopearplugs.com"
    },
    "socials": {
      "facebook": {
        "handle": "loopearplugs",
        "followers": 12843,
        "growth30d": 0.042
      },
      "instagram": {
        "handle": "loopearplugs",
        "followers": 12843,
        "growth30d": 0.042
      },
      "tiktok": {
        "handle": "loopearplugs",
        "followers": 12843,
        "growth30d": 0.042
      },
      "youtube": {
        "handle": "loopearplugs",
        "followers": 12843,
        "growth30d": 0.042
      },
      "pinterest": {
        "handle": "loopearplugs",
        "followers": 12843,
        "growth30d": 0.042
      },
      "linkedin": {
        "handle": "loopearplugs",
        "followers": 12843,
        "growth30d": 0.042
      },
      "twitter": {
        "handle": "loopearplugs",
        "followers": 12843,
        "growth30d": 0.042
      }
    },
    "catalog": {
      "productsCount": 124,
      "mainCategory": "Fashion",
      "bestSellers": [
        {
          "imageUrl": "https://cdn.shopify.com/s/files/1/1442/3288/files/PDP_QUIET_WHITE_01-805740.png",
          "title": "Loop Quiet™ 2",
          "price": 19.95,
          "currency": "EUR"
        }
      ],
      "categories": [
        "Fashion",
        "Accessories"
      ],
      "myShopifyDomain": "loopearplugs.myshopify.com"
    },
    "traffic": {
      "monthlyVisits": 45231,
      "growth30d": 0.18,
      "history": [
        {
          "period": "2026-03-01",
          "value": 2942350
        }
      ],
      "topCountries": [
        {
          "countryCode": "US",
          "share": 0.64
        }
      ],
      "growth90d": 0.32,
      "growth180d": 0.41,
      "mainMarkets": [
        {
          "countryCode": "US",
          "share": 0.64
        }
      ]
    },
    "sales": {
      "currency": "USD",
      "estMonthlySales": 222540,
      "unitsSold": 1823,
      "estMonthlySalesMin": 170450,
      "estMonthlySalesMax": 274103
    },
    "advertising": {
      "activeAds": 12,
      "linkedAdvertisersCount": 2,
      "history": [
        {
          "period": "2026-03-01",
          "value": 2942350
        }
      ],
      "topCountries": [
        {
          "countryCode": "US",
          "share": 0.64
        }
      ],
      "linkedAdvertisers": [
        {
          "id": "1234567890",
          "platform": "facebook",
          "facebookPageId": "1234567890",
          "name": "Acme Brand",
          "isPrimary": true,
          "activeAds": 12
        }
      ],
      "summary": {
        "activeAds": 12,
        "avgActiveAds30d": 9.4,
        "reach30d": 102300,
        "countryDistribution": [
          {
            "countryCode": "US",
            "share": 0.64
          }
        ]
      },
      "adsCountryStats": [
        {
          "countryCode": "US",
          "share": 0.64
        }
      ]
    },
    "technology": {
      "theme": "Prestige",
      "apps": [
        {
          "id": "41c143a7-0000-4000-8000-000000000000",
          "label": "Judge.me",
          "iconUrl": "https://cdn.shopify.com/app-store/listing_images/abc/icon.png"
        }
      ],
      "pixels": [
        {
          "id": "002d1031-2a33-42c6-9b4a-c5db2349ecec",
          "name": "Meta Pixel",
          "iconUrl": "https://trendtrack.r2.cloudflarestorage.com/technology_icons/MetaPixel.png?...signature",
          "categories": []
        }
      ]
    },
    "tiktok": {
      "hasTikTok": true,
      "pageId": "6802334614847603717",
      "handle": "examplebrand",
      "profileMetrics": {
        "followers": 128430,
        "totalPosts": 342,
        "newPosts": 12,
        "totalViews": 9823431,
        "totalLikes": 456789
      },
      "activity": {
        "activeAds": 7,
        "totalAds": 33,
        "avgActiveAds7d": 5.5,
        "avgActiveAds30d": 4.25
      },
      "lastUpdatedAt": "2026-06-05T08:30:00.000Z"
    },
    "latestAds": [
      {
        "id": "facebook_1059447873925448",
        "mediaType": "video",
        "mediaUrl": "https://medias.trendtrack.io/video/facebook/1317841346869775.mp4",
        "thumbnailUrl": "https://medias.trendtrack.io/thumbnails/facebook/1317841346869775.jpg"
      }
    ],
    "similarShops": [
      {
        "shop": {
          "id": "3f8aa146-6f96-46e8-9781-64db5166f9a8",
          "domain": "example.com",
          "name": "Example Shop",
          "screenshotUrl": "https://cdn.example.com/screenshots/example.com.png",
          "createdAt": "2024-01-15T00:00:00.000Z",
          "profile": {
            "countryCode": "US",
            "currency": "USD",
            "isShopifyPlus": true
          },
          "catalog": {
            "productsCount": 124,
            "mainCategory": "Fashion",
            "bestSellers": [
              {
                "imageUrl": "https://cdn.shopify.com/s/files/1/1442/3288/files/PDP_QUIET_WHITE_01-805740.png",
                "title": "Loop Quiet™ 2",
                "price": 19.95,
                "currency": "EUR"
              }
            ]
          },
          "traffic": {
            "monthlyVisits": 45231,
            "growth30d": 0.18,
            "history": [
              {
                "period": "2026-03-01",
                "value": 2942350
              }
            ],
            "topCountries": [
              {
                "countryCode": "US",
                "share": 0.64
              }
            ]
          },
          "sales": {
            "currency": "USD",
            "estMonthlySales": 222540,
            "unitsSold": 1823
          },
          "advertising": {
            "activeAds": 12,
            "linkedAdvertisersCount": 2,
            "history": [
              {
                "period": "2026-03-01",
                "value": 2942350
              }
            ],
            "topCountries": [
              {
                "countryCode": "US",
                "share": 0.64
              }
            ]
          },
          "tiktok": {
            "hasTikTok": true,
            "pageId": "6802334614847603717",
            "handle": "examplebrand",
            "profileMetrics": {
              "followers": 128430,
              "totalPosts": 342,
              "newPosts": 12,
              "totalViews": 9823431,
              "totalLikes": 456789
            },
            "activity": {
              "activeAds": 7,
              "totalAds": 33,
              "avgActiveAds7d": 5.5,
              "avgActiveAds30d": 4.25
            },
            "lastUpdatedAt": "2026-06-05T08:30:00.000Z"
          },
          "googleAds": {
            "status": "available",
            "liveAds": 14,
            "adsLaunched30d": 5,
            "reach": {
              "value": 245000,
              "label": "Google reported reach",
              "euUkOnly": false
            },
            "topCountries": [
              {
                "code": "FR",
                "ads": 12,
                "reach": 185000
              }
            ],
            "platformMix": [
              {
                "platform": "SEARCH",
                "ads": 8
              }
            ]
          },
          "latestAds": [
            {
              "id": "facebook_1059447873925448",
              "mediaType": "video",
              "mediaUrl": "https://medias.trendtrack.io/video/facebook/1317841346869775.mp4",
              "thumbnailUrl": "https://medias.trendtrack.io/thumbnails/facebook/1317841346869775.jpg"
            }
          ]
        },
        "similarityScore": 0.9137
      }
    ]
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `data` | `object` | Yes |  |

**`data` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes |  |
| `domain` | `string` | Yes |  |
| `name` | `string` | Yes |  |
| `screenshotUrl` | `string` | Yes |  |
| `createdAt` | `string` | Yes |  |
| `profile` | `object` | Yes |  |
| `trustpilot` | `object` | Yes |  |
| `socials` | `object` | Yes |  |
| `catalog` | `object` | Yes |  |
| `traffic` | `object` | Yes |  |
| `sales` | `object` | Yes | Current sales estimate. Null when the sales tracker does not follow the shop. For the daily history, call GET /v1/shops/{shopId}/sales/history. |
| `advertising` | `object` | Yes |  |
| `technology` | `object` | Yes |  |
| `tiktok` | `object` | Yes |  |
| `latestAds` | `object`[] | Yes | Up to 3 most recent Meta ads published by the shop. |
| `similarShops` | `object`[] | Yes | Preview of up to 6 shops ranked by similarity (relevance desc). For the full paginated list, call GET /v1/shops/{identifier}/similar using either the domain or public shop id. |

**`profile` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `countryCode` | `string` | Yes |  |
| `currency` | `string` | Yes |  |
| `isShopifyPlus` | `boolean` | Yes |  |
| `defaultLanguage` | `string` | Yes |  |

**`trustpilot` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `rating` | `number` | Yes |  |
| `reviewCount` | `number` | Yes |  |
| `brandName` | `string` | Yes |  |
| `brandLogo` | `string` | Yes |  |
| `url` | `string` | Yes |  |

**`socials` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `facebook` | `object` | Yes |  |
| `instagram` | `object` | Yes |  |
| `tiktok` | `object` | Yes |  |
| `youtube` | `object` | Yes |  |
| `pinterest` | `object` | Yes |  |
| `linkedin` | `object` | Yes |  |
| `twitter` | `object` | Yes |  |

**`facebook` properties:**


**`instagram` properties:**


**`tiktok` properties:**


**`youtube` properties:**


**`pinterest` properties:**


**`linkedin` properties:**


**`twitter` properties:**


**`catalog` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `productsCount` | `number` | Yes |  |
| `mainCategory` | `string` | Yes |  |
| `bestSellers` | `object`[] | Yes | Top best-selling products for this shop. Capped at 3 items. Sourced from `shopify_best_selling` when available, with fallback to `best_sellers_object` then `best_sellers` image URLs. |
| `categories` | `string`[] | Yes |  |
| `myShopifyDomain` | `string` | Yes |  |

**`bestSellers[]` item properties:**


**`traffic` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `monthlyVisits` | `number` | Yes |  |
| `growth30d` | `number` | Yes |  |
| `history` | `object`[] | Yes | Monthly visits time-series, sorted ascending by period. Capped at the 6 most recent months. |
| `topCountries` | `object`[] | Yes | Top markets by traffic share (country code + share in [0, 1]). Derived from SimilarWeb geography breakdown when available, otherwise from the `countries` list with null shares. |
| `growth90d` | `number` | Yes |  |
| `growth180d` | `number` | Yes |  |
| `mainMarkets` | `object`[] | Yes | Alias of `topCountries` kept for backwards compatibility with the detail endpoint. |

**`history[]` item properties:**


**`topCountries[]` item properties:**


**`mainMarkets[]` item properties:**


**`sales` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `currency` | `USD` | Yes | The tracker converts every product price to USD. |
| `estMonthlySales` | `number` | Yes | Estimated revenue over the last 30 days, in whole USD. An estimate from the sales tracker; 0 means the tracker measured no sales. |
| `unitsSold` | `number` | Yes | Units sold over the same 30 days. A floor: the shop sold at least this many. |
| `estMonthlySalesMin` | `number` | Yes | Low end of the 30-day revenue estimate, in whole USD. |
| `estMonthlySalesMax` | `number` | Yes | High end of the 30-day revenue estimate, in whole USD. |

**`advertising` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `activeAds` | `number` | Yes |  |
| `linkedAdvertisersCount` | `number` | Yes |  |
| `history` | `object`[] | Yes | Weekly active-ads time-series, sorted ascending by period. Capped at the 26 most recent weekly points (~6 months). |
| `topCountries` | `object`[] | Yes | Top countries by Meta ads volume (share in [0, 1]). Derived from the shop-level `ads_country_stats` aggregate across all linked advertisers. |
| `linkedAdvertisers` | `object`[] | Yes |  |
| `summary` | `object` | Yes |  |
| `adsCountryStats` | `object`[] | Yes | Shop-level Meta ads country distribution from `ads_country_stats`. Distinct from `summary.countryDistribution`, which is derived from linked Facebook page reach. |

**`history[]` item properties:**


**`topCountries[]` item properties:**


**`linkedAdvertisers[]` item properties:**


**`summary` properties:**


**`adsCountryStats[]` item properties:**


**`technology` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `theme` | `string` | Yes | Canonical Shopify theme display name from the shop technology profile. |
| `apps` | `object`[] | Yes | Shopify apps detected on the shop, with vendor icons. |
| `pixels` | `object`[] | Yes | Pixels detected on the shop, resolved to human-readable names and icons via the public technologies vocabulary. |

**`apps[]` item properties:**


**`pixels[]` item properties:**


**`tiktok` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `hasTikTok` | `boolean` | Yes | True when the shop has an indexed TikTok page/handle or TikTok rollup activity. This is independent from Meta advertising fields. |
| `pageId` | `string` | Yes |  |
| `handle` | `string` | Yes |  |
| `profileMetrics` | `object` | Yes |  |
| `activity` | `object` | Yes |  |
| `lastUpdatedAt` | `string` | Yes |  |

**`profileMetrics` properties:**


**`activity` properties:**


**`latestAds[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes |  |
| `mediaType` | `image` \| `video` | Yes |  |
| `mediaUrl` | `string` | Yes |  |
| `thumbnailUrl` | `string` | Yes |  |

**`similarShops[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `shop` | `object` | Yes |  |
| `similarityScore` | `number` | Yes |  |

**`shop` properties:**


### 400 - The shopId path parameter is not a canonical UUID. Possible error code: bad_request.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |

### 401 - Authentication failed. Possible error codes: missing_api_key, invalid_api_key, credential_not_found, credential_revoked, credential_expired.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |

### 403 - Workspace or delegated access rejected. Possible error codes: workspace_public_api_disabled, workspace_public_api_suspended, delegated_user_access_revoked.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |

### 404 - The requested shop was not found. Possible error code: not_found.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |

### 500 - Unexpected public API failure. Possible error code: internal_error.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |

### 503 - Public auth provider is temporarily unavailable. Possible error code: auth_provider_unavailable.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |
