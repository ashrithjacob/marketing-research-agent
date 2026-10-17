# Ads

---

# List ads

`GET /v1/ads`

Returns the lightweight public ads collection. This endpoint stays intentionally small and focuses on text search, brand search, simple filters, sorting, and pagination. The search parameter is required; for advanced filtering without a required text search, use POST /v1/ads/query.

**Tags:** Ads

## Parameters

**Query parameter groups:**

- Pagination: `page`, `limit`
- Search: `search`, `searchType`, `query`
- Sorting: `sortBy`
- Filters: `platform`, `status`, `mediaType`

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `search` | query | Yes | `string` | Canonical text query for the lightweight public ads listing. |
| `searchType` | query | No | `adCopy` \| `brand` | Search mode for this request. Allowed values: `adCopy`, `brand`. |
| `platform` | query | No | `facebook` \| `all` | Enum value accepted by this request. Allowed values: `facebook`, `all`. TikTok is not available in public v1. |
| `page` | query | No | `integer` |  |
| `limit` | query | No | `integer` |  |
| `status` | query | No | `active` \| `inactive` \| `all` | Status filter for this request. Allowed values: `active`, `inactive`, `all`. |
| `mediaType` | query | No | `image` \| `video` \| `carousel` | Creative media type filter for this request. Allowed values: `image`, `video`, `carousel`. `carousel` maps to indexed carousel creatives and is not a DCO filter. |
| `sortBy` | query | No | `relevance` \| `newest` \| `longestRunning` \| `reach` | Sort key for this request. Allowed values: `relevance`, `newest`, `longestRunning`, `reach`. |
| `query` | query | No | `string` | Deprecated alias for search. Use search instead. |

## Responses

### 200 - Paginated ads response using the public ads contract. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": [
    {
      "id": "facebook_123456789",
      "collationId": "3810635369204881",
      "platform": "facebook",
      "status": "active",
      "createdAt": "2026-04-18T12:30:00.000Z",
      "firstSeenAt": "2026-04-10T00:00:00.000Z",
      "lastSeenAt": "2026-04-19T00:00:00.000Z",
      "daysRunning": 9,
      "media": {
        "type": "video",
        "thumbnailUrl": "https://cdn.example.com/ads/ad-1-thumb.jpg",
        "mediaUrl": "https://cdn.example.com/ads/ad-1.mp4"
      },
      "advertiser": {
        "id": "1234567890",
        "name": "Example Brand",
        "logoUrl": "https://cdn.example.com/pages/example-brand.png",
        "facebookPageId": "1234567890",
        "liveAdsCount": 42,
        "reach30d": 152340,
        "totalReach": 842100,
        "countriesCount": 8,
        "facebookLikes": 125000,
        "instagramFollowers": 89000
      },
      "content": {
        "title": "Summer Sale",
        "body": "Up to 30% off selected products.",
        "transcript": "Save 30% on every order.",
        "callToAction": "Shop now",
        "landingPageUrl": "https://example.com/products/summer-sale",
        "landingPageDomain": "example.com",
        "ctaDescription": "Free shipping on orders over $50.",
        "ctaLinkDescription": "Shop the full collection"
      },
      "metrics": {
        "reach": 152340,
        "aggregatedReach": 284100,
        "estimatedSpend": 4262,
        "duplicates": 4,
        "reachDelta1d": 1200,
        "reachDelta7d": 8200,
        "reachDelta30d": 38400
      },
      "audience": {
        "targetedCountries": [
          "US",
          "FR"
        ],
        "mainCountry": "FR",
        "gender": "all",
        "ageMin": 18,
        "ageMax": 65
      },
      "rank": {
        "positionInPage": 3,
        "currentRank": 12,
        "rankDelta": -4,
        "improvementPct": 0.25
      },
      "flags": {
        "isEuAd": true,
        "isLowReach": false,
        "isMediaChanged": false,
        "hasPartnerBadge": true
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 235,
    "totalPages": 10
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
| `collationId` | `string` | No | Creative collation identifier when this result represents a deduplicated group of related Meta ads. Pass this value as scan_ad.collation_id to scan the same combined creative shown by search. |
| `platform` | `facebook` | Yes |  |
| `status` | `active` \| `inactive` \| `unknown` | Yes | For a result with collationId, active means at least one media-backed member ad is active. Without collationId, this is the individual ad status. |
| `createdAt` | `string` | Yes |  |
| `firstSeenAt` | `string` | Yes | For a result with collationId, the earliest first-seen date across the combined creative members. |
| `lastSeenAt` | `string` | Yes | For a result with collationId, null while any media-backed member remains active; otherwise the latest member end date. |
| `daysRunning` | `number` | Yes | Indexed running duration in days. For a result with collationId, this is the creative calendar span from the oldest member start to today while any member is active, or to the latest member end otherwise; it does not imply continuous delivery by one ad. Historical backfill is bounded by the available firstSeenAt floor (currently 2018-01-01), so very old ads can share the same maximum/clamped value. |
| `media` | `object` | Yes |  |
| `advertiser` | `object` | Yes |  |
| `content` | `object` | Yes |  |
| `metrics` | `object` | Yes |  |
| `audience` | `object` | Yes |  |
| `rank` | `object` | Yes |  |
| `flags` | `object` | Yes |  |

**`media` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `image` \| `video` \| `carousel` \| `unknown` | Yes | Creative media type from indexed ad data. `carousel` means carousel creative format and is not a DCO signal. |
| `thumbnailUrl` | `string` | Yes |  |
| `mediaUrl` | `string` | Yes |  |

**`advertiser` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes |  |
| `name` | `string` | Yes |  |
| `logoUrl` | `string` | Yes |  |
| `facebookPageId` | `string` | Yes |  |
| `liveAdsCount` | `number` | Yes |  |
| `reach30d` | `number` | Yes | Advertiser reach for the last 30 days. In Meta Ad Library vocabulary, reach is the public-facing impressions-style metric where available. |
| `totalReach` | `number` | Yes | Advertiser total/current reach. In Meta Ad Library vocabulary, reach is the public-facing impressions-style metric where available. |
| `countriesCount` | `number` | Yes |  |
| `facebookLikes` | `number` | Yes |  |
| `instagramFollowers` | `number` | Yes |  |

**`content` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `title` | `string` | Yes |  |
| `body` | `string` | Yes |  |
| `transcript` | `string` | Yes | Backward-compatible plain transcript text. Rich transcript metadata may also be available on detail responses. |
| `callToAction` | `string` | Yes |  |
| `landingPageUrl` | `string` | Yes |  |
| `landingPageDomain` | `string` | Yes |  |
| `ctaDescription` | `string` | Yes |  |
| `ctaLinkDescription` | `string` | Yes |  |

**`metrics` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `reach` | `number` | Yes | Ad reach where available. In Meta Ad Library vocabulary, reach is the public-facing impressions-style metric. |
| `aggregatedReach` | `number` | Yes | Aggregated ad reach across duplicates where available; reach corresponds to the public impressions-style metric from Meta Ad Library data. |
| `estimatedSpend` | `number` | Yes | Estimated spend in euros. Formula: reach * cpm / 1000, using the request cpm or the default CPM of 9 when cpm is omitted. Rounded to the nearest integer. |
| `duplicates` | `number` | Yes |  |
| `reachDelta1d` | `number` | Yes | One-day reach delta; reach corresponds to the public impressions-style metric from Meta Ad Library data. |
| `reachDelta7d` | `number` | Yes | Seven-day reach delta; reach corresponds to the public impressions-style metric from Meta Ad Library data. |
| `reachDelta30d` | `number` | Yes | Thirty-day reach delta; reach corresponds to the public impressions-style metric from Meta Ad Library data. |

**`audience` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `targetedCountries` | `string`[] | Yes | Full ad targeting country list, including non-EU markets such as US. |
| `mainCountry` | `string` | Yes | Primary audience country from Meta's EU/UK ad transparency reporting. Null for ads outside that scope, even when targetedCountries is populated. |
| `gender` | `men` \| `women` \| `all` | Yes |  |
| `ageMin` | `number` | Yes |  |
| `ageMax` | `number` | Yes |  |

**`rank` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `positionInPage` | `number` | Yes |  |
| `currentRank` | `number` | Yes |  |
| `rankDelta` | `number` | Yes |  |
| `improvementPct` | `number` | Yes |  |

**`flags` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `isEuAd` | `boolean` | Yes |  |
| `isLowReach` | `boolean` | Yes | Whether the ad is flagged as low reach/low impressions in the indexed Meta Ad Library data. |
| `isMediaChanged` | `boolean` | Yes |  |
| `hasPartnerBadge` | `boolean` | Yes |  |

**`pagination` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `page` | `number` | Yes |  |
| `limit` | `number` | Yes |  |
| `total` | `number` | Yes |  |
| `totalPages` | `number` | Yes |  |

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

# Query ads

`POST /v1/ads/query`

Returns the advanced public ads query surface. This endpoint supports the full current ads filtering set through a public camelCase contract with structured JSON for advanced growth, country, market, and ranking filters while keeping the response aligned with the standard public ad summary shape. Search terms are optional in this route.

**Tags:** Ads

## Request Body

**Content-Type:** `application/json`

**Find active high-reach ads without a text search term:**

```json
{
  "sortBy": "newest",
  "order": "desc",
  "status": "active",
  "platforms": [
    "facebook"
  ],
  "minDaysRunning": 7,
  "reachPeriod": "last7d",
  "minReach": 10000,
  "limit": 25
}
```

**Top ads scaling over the last 7 days:**

Use 7-day reach delta sorting for natural-language prompts such as “top ads leggings femme sur les 7 derniers jours”. This does not add first-seen date filters unless createdAfter or adsTimePeriod is supplied.

```json
{
  "search": [
    "leggings femme"
  ],
  "searchType": "adCopy",
  "keywordMode": "all",
  "sortBy": "reachDelta7d",
  "order": "desc",
  "reachPeriod": "last7d",
  "minReach": 1,
  "status": "active",
  "platforms": [
    "facebook"
  ],
  "limit": 20
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `search` | `string`[] | No | Optional list of search terms used by the advanced ads query engine. |
| `searchType` | `adCopy` \| `brand` \| `website` \| `domain` \| `urlContains` | No | Search mode for this request. Public camelCase values map to the same internal /ads fields: `adCopy` → `ad_copy`, `brand` → `brand`, `website` → `website_copy`, `domain` → `domain`, `urlContains` → `url_contains`. |
| `keywordMode` | `any` \| `all` | No | How multiple search keywords are combined. Allowed values: `any`, `all`. |
| `sortBy` | `createdAt` \| `longestRunning` \| `relevance` \| `relevanceScore` \| `newest` \| `mostDuplicates` \| `reach` \| `reachDelta1d` \| `reachDelta7d` \| `reachDelta30d` \| `rankDelta7d` \| `rankDelta14d` \| `rankDelta30d` \| `adOrder` | No | Sort key for this request. Allowed values: `createdAt`, `longestRunning`, `relevance`, `relevanceScore`, `newest`, `mostDuplicates`, `reach`, `reachDelta1d`, `reachDelta7d`, `reachDelta30d`, `adOrder`. |
| `order` | `asc` \| `desc` | No | Sort direction for this request. Allowed values: `asc`, `desc`. |
| `page` | `number` | No |  |
| `limit` | `number` | No |  |
| `platforms` | `facebook`[] | No | Accepted public v1 platform values. TikTok is not available in public v1. |
| `mediaType` | `image` \| `video` \| `carousel` | No | Creative media type filter for this request. Allowed values: `image`, `video`, `carousel`. `carousel` maps to indexed carousel creatives and is not a DCO filter. |
| `createdAfter` | `string` | No |  |
| `createdBefore` | `string` | No |  |
| `minFbPageCreationDate` | `string` | No |  |
| `maxFbPageCreationDate` | `string` | No |  |
| `minLastSeenDate` | `string` | No |  |
| `maxLastSeenDate` | `string` | No |  |
| `minDaysRunning` | `number` | No |  |
| `maxDaysRunning` | `number` | No |  |
| `status` | `active` \| `inactive` \| `all` | No | Status filter for this request. Allowed values: `active`, `inactive`, `all`. |
| `minDuplicates` | `number` | No |  |
| `maxDuplicates` | `number` | No |  |
| `minDescriptionLength` | `number` | No |  |
| `maxDescriptionLength` | `number` | No |  |
| `minVideoDuration` | `number` | No |  |
| `maxVideoDuration` | `number` | No |  |
| `maxAdOrder` | `number` | No |  |
| `adRankMode` | `percentile` \| `rank` | No | Rank interpretation mode. Allowed values: `percentile`, `rank`. |
| `adRankBasis` | `current` \| `alltime` | No | Rank basis used for ad rank filters. Allowed values: `current`, `alltime`. |
| `maxAdRankValue` | `number` | No |  |
| `growthRank` | `object` | No | Advanced rank trend filter. Direction filters are ORed; period selects the rank-delta window when every rule uses the same supported window. minChange/unit are accepted for forward compatibility; use minRankDelta for an enforced absolute minimum rank improvement. |
| `rankDeltaWindow` | `7d` \| `14d` \| `30d` | No | Rank-delta window used by growthRank/minRankDelta. Overrides the window inferred from growthRank.period. |
| `minRankDelta` | `number` | No | Minimum absolute rank improvement for ad-rank mover filters. |
| `adLanguage` | `string`[] | No |  |
| `cta` | `string`[] | No |  |
| `landingPages` | `string`[] | No | Landing page URL/domain filters. Mirrors the app ads table landingPages filter. |
| `adCopyHashes` | `string`[] | No | Ad copy hash filters. Mirrors the app ads table adCopyHashes filter. |
| `minReach` | `number` | No | Minimum reach threshold. Backed by the internal reach/impressions analytics fields. |
| `maxReach` | `number` | No | Maximum reach threshold. Backed by the internal reach/impressions analytics fields. |
| `minAge` | `number` | No |  |
| `maxAge` | `number` | No |  |
| `sex` | `men` \| `women` \| `all` | No | Audience gender filter. Allowed values: `men`, `women`, `all`. |
| `adCountries` | `object` | No | Countries where the ad is distributed. Uses ISO 3166-1 alpha-2 country codes. |
| `mainCountries` | `string`[] | No | Primary audience country filter, backed by Meta's EU/UK ad transparency reporting. Only EU/EEA, UK and French overseas codes exist in that data: US and other non-EU codes match nothing. Use adCountries for those markets. |
| `spender` | `big-spender` \| `rising-star` \| `brandtracker` | No | Spender segment filter. Allowed values: `big-spender`, `rising-star`, `brandtracker`. |
| `partners` | `boolean` | No |  |
| `partnerIds` | `string`[] | No | Partner badge ids to include. Mirrors the app ads table partnerIds filter. |
| `minTraffic` | `number` | No |  |
| `maxTraffic` | `number` | No |  |
| `trafficGrowth` | `object` | No | Traffic growth filter. Uses OR groups (`anyOf`) made of AND-ed rules (`all`). Values are percentage thresholds. |
| `minAds` | `number` | No |  |
| `maxAds` | `number` | No |  |
| `adsGrowth` | `object` | No | Ads growth filter. Uses OR groups (`anyOf`) made of AND-ed rules (`all`). Values are percentage thresholds. |
| `pageReachGrowth` | `object` | No | Page reach growth filter. Uses OR groups (`anyOf`) made of AND-ed rules (`all`). |
| `adReachGrowth` | `object` | No | Ad reach growth filter. Uses OR groups (`anyOf`) made of AND-ed rules (`all`). |
| `categoryIds` | `number`[] | No | Google category facet ids matched against ads/shop google_categories. |
| `minProducts` | `number` | No |  |
| `maxProducts` | `number` | No |  |
| `minBestSellerPrice` | `number` | No |  |
| `maxBestSellerPrice` | `number` | No |  |
| `themes` | `string`[] | No |  |
| `pixels` | `string`[] | No |  |
| `excludePixels` | `string`[] | No |  |
| `languages` | `string`[] | No |  |
| `currencies` | `string`[] | No |  |
| `shopifyApps` | `string`[] | No | Shopify app UUIDs returned by the Shopify Apps facets endpoint. |
| `excludeShopifyApps` | `string`[] | No | Shopify app UUIDs to exclude. Values must not overlap shopifyApps. |
| `adsTimePeriod` | `last24h` \| `last7d` \| `last30d` | No | Relative ad first-seen time window. When createdAfter is omitted, this is converted to an internal first-seen lower bound at the UTC day boundary for the selected period. It also selects the ads metric period used by minAds/maxAds. |
| `minDate` | `string` | No |  |
| `maxDate` | `string` | No |  |
| `creationCountry` | `object` | No | Advertiser creation country filter using ISO 3166-1 alpha-2 country codes. |
| `market` | `object` | No | Market filter grouped by primary markets, secondary markets, and excluded markets. |
| `shopifyPlus` | `plus` \| `non-plus` \| `all` | No | Shopify Plus filter. Allowed values: `plus`, `non-plus`, `all`. |
| `minTrustpilotScore` | `number` | No | Minimum Trustpilot score. |
| `maxTrustpilotScore` | `number` | No | Maximum Trustpilot score. |
| `minTrustpilotReviews` | `number` | No | Minimum Trustpilot review count. |
| `maxTrustpilotReviews` | `number` | No | Maximum Trustpilot review count. |
| `minSpend` | `number` | No | Minimum estimated spend. Uses cpm when provided, otherwise the public API default CPM of 9. |
| `maxSpend` | `number` | No | Maximum estimated spend. Uses cpm when provided, otherwise the public API default CPM of 9. |
| `cpm` | `number` | No | CPM in euros per 1,000 reach used for spend filters and estimatedSpend. Defaults to 9 when omitted. |
| `spendPeriod` | `total` \| `last24h` \| `last7d` \| `last30d` | No | Metric period used by minSpend/maxSpend. By itself this parameter does not filter results. |
| `reachPeriod` | `total` \| `last24h` \| `last7d` \| `last30d` | No | Metric period used by minReach/maxReach. Reach is the public Meta Ad Library vocabulary for impressions where available. Allowed values: `total`, `last24h`, `last7d`, `last30d`. |
| `minSpendPerPage` | `number` | No | Minimum estimated spend per page. Uses cpm when provided, otherwise the public API default CPM of 9. |
| `maxSpendPerPage` | `number` | No | Maximum estimated spend per page. Uses cpm when provided, otherwise the public API default CPM of 9. |
| `spendPerPagePeriod` | `total` \| `last24h` \| `last7d` \| `last30d` | No | Metric period used by minSpendPerPage/maxSpendPerPage. By itself this parameter does not filter results. |
| `minFacebookLikes` | `number` | No |  |
| `maxFacebookLikes` | `number` | No |  |
| `minInstagramFollowers` | `number` | No |  |
| `maxInstagramFollowers` | `number` | No |  |
| `minReachPerPage` | `number` | No | Minimum page reach threshold. Backed by the internal page impressions fields. |
| `maxReachPerPage` | `number` | No | Maximum page reach threshold. Backed by the internal page impressions fields. |
| `reachPerPagePeriod` | `total` \| `last24h` \| `last7d` \| `last30d` | No | Metric period used by minReachPerPage/maxReachPerPage. Reach is the public Meta Ad Library vocabulary for page impressions where available. Allowed values: `total`, `last24h`, `last7d`, `last30d`. |
| `technologies` | `checkoutchamp` \| `clickfunnels` \| `funnelish` \| `gempages` \| `magento` \| `odoo` \| `pagefly` \| `prestashop` \| `shopify` \| `shoplazza` \| `shopline` \| `squarespace` \| `wheelio` \| `wix` \| `woocommerce` \| `wordpress` \| `zipify-pages`[] | No | Technology slugs supported by the current ads index. Supported values: checkoutchamp, clickfunnels, funnelish, gempages, magento, odoo, pagefly, prestashop, shopify, shoplazza, shopline, squarespace, wheelio, wix, woocommerce, wordpress, zipify-pages. |
| `hideLowReach` | `boolean` | No | Exclude low reach ads. Backed by the internal low impressions flag. |
| `hideNonEuUkAds` | `boolean` | No |  |
| `hideSavedAds` | `boolean` | No |  |
| `hideDecliningRankAds` | `boolean` | No |  |
| `trackedPages` | `string`[] | No |  |
| `maxAdsPerBrand` | `number` | No |  |

**`growthRank` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `anyOf` | `object`[] | Yes | Structured rank trend request shape. Current filtering ORs all provided directions and ignores grouping, period, minChange, and unit. |

**`anyOf[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `all` | `object`[] | Yes |  |

**`all[]` item properties:**


**`adCountries` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `include` | `string`[] | No | ISO 3166-1 alpha-2 country codes to include. |
| `exclude` | `string`[] | No | ISO 3166-1 alpha-2 country codes to exclude. |

**`trafficGrowth` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `anyOf` | `object`[] | Yes | OR groups of traffic growth rules. Each group combines its rules with AND. |

**`anyOf[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `all` | `object`[] | Yes |  |

**`all[]` item properties:**


**`adsGrowth` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `anyOf` | `object`[] | Yes | OR groups of ads growth rules. Each group combines its rules with AND. |

**`anyOf[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `all` | `object`[] | Yes |  |

**`all[]` item properties:**


**`pageReachGrowth` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `anyOf` | `object`[] | Yes | OR groups of reach growth rules. Each group combines its rules with AND. |

**`anyOf[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `all` | `object`[] | Yes |  |

**`all[]` item properties:**


**`adReachGrowth` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `anyOf` | `object`[] | Yes | OR groups of reach growth rules. Each group combines its rules with AND. |

**`anyOf[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `all` | `object`[] | Yes |  |

**`all[]` item properties:**


**`creationCountry` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `include` | `string`[] | No | ISO 3166-1 alpha-2 country codes to include. |
| `exclude` | `string`[] | No | ISO 3166-1 alpha-2 country codes to exclude. |

**`market` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `main` | `string`[] | No | Countries that must match the primary market. |
| `among` | `string`[] | No | Countries that can appear among the ad markets. |
| `exclude` | `string`[] | No | Countries to exclude from the ad markets. |

## Responses

### 200 - Paginated advanced ads query response using the public ads contract. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": [
    {
      "id": "facebook_123456789",
      "collationId": "3810635369204881",
      "platform": "facebook",
      "status": "active",
      "createdAt": "2026-04-18T12:30:00.000Z",
      "firstSeenAt": "2026-04-10T00:00:00.000Z",
      "lastSeenAt": "2026-04-19T00:00:00.000Z",
      "daysRunning": 9,
      "media": {
        "type": "video",
        "thumbnailUrl": "https://cdn.example.com/ads/ad-1-thumb.jpg",
        "mediaUrl": "https://cdn.example.com/ads/ad-1.mp4"
      },
      "advertiser": {
        "id": "1234567890",
        "name": "Example Brand",
        "logoUrl": "https://cdn.example.com/pages/example-brand.png",
        "facebookPageId": "1234567890",
        "liveAdsCount": 42,
        "reach30d": 152340,
        "totalReach": 842100,
        "countriesCount": 8,
        "facebookLikes": 125000,
        "instagramFollowers": 89000
      },
      "content": {
        "title": "Summer Sale",
        "body": "Up to 30% off selected products.",
        "transcript": "Save 30% on every order.",
        "callToAction": "Shop now",
        "landingPageUrl": "https://example.com/products/summer-sale",
        "landingPageDomain": "example.com",
        "ctaDescription": "Free shipping on orders over $50.",
        "ctaLinkDescription": "Shop the full collection"
      },
      "metrics": {
        "reach": 152340,
        "aggregatedReach": 284100,
        "estimatedSpend": 4262,
        "duplicates": 4,
        "reachDelta1d": 1200,
        "reachDelta7d": 8200,
        "reachDelta30d": 38400
      },
      "audience": {
        "targetedCountries": [
          "US",
          "FR"
        ],
        "mainCountry": "FR",
        "gender": "all",
        "ageMin": 18,
        "ageMax": 65
      },
      "rank": {
        "positionInPage": 3,
        "currentRank": 12,
        "rankDelta": -4,
        "improvementPct": 0.25
      },
      "flags": {
        "isEuAd": true,
        "isLowReach": false,
        "isMediaChanged": false,
        "hasPartnerBadge": true
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 235,
    "totalPages": 10
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
| `collationId` | `string` | No | Creative collation identifier when this result represents a deduplicated group of related Meta ads. Pass this value as scan_ad.collation_id to scan the same combined creative shown by search. |
| `platform` | `facebook` | Yes |  |
| `status` | `active` \| `inactive` \| `unknown` | Yes | For a result with collationId, active means at least one media-backed member ad is active. Without collationId, this is the individual ad status. |
| `createdAt` | `string` | Yes |  |
| `firstSeenAt` | `string` | Yes | For a result with collationId, the earliest first-seen date across the combined creative members. |
| `lastSeenAt` | `string` | Yes | For a result with collationId, null while any media-backed member remains active; otherwise the latest member end date. |
| `daysRunning` | `number` | Yes | Indexed running duration in days. For a result with collationId, this is the creative calendar span from the oldest member start to today while any member is active, or to the latest member end otherwise; it does not imply continuous delivery by one ad. Historical backfill is bounded by the available firstSeenAt floor (currently 2018-01-01), so very old ads can share the same maximum/clamped value. |
| `media` | `object` | Yes |  |
| `advertiser` | `object` | Yes |  |
| `content` | `object` | Yes |  |
| `metrics` | `object` | Yes |  |
| `audience` | `object` | Yes |  |
| `rank` | `object` | Yes |  |
| `flags` | `object` | Yes |  |

**`media` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `image` \| `video` \| `carousel` \| `unknown` | Yes | Creative media type from indexed ad data. `carousel` means carousel creative format and is not a DCO signal. |
| `thumbnailUrl` | `string` | Yes |  |
| `mediaUrl` | `string` | Yes |  |

**`advertiser` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes |  |
| `name` | `string` | Yes |  |
| `logoUrl` | `string` | Yes |  |
| `facebookPageId` | `string` | Yes |  |
| `liveAdsCount` | `number` | Yes |  |
| `reach30d` | `number` | Yes | Advertiser reach for the last 30 days. In Meta Ad Library vocabulary, reach is the public-facing impressions-style metric where available. |
| `totalReach` | `number` | Yes | Advertiser total/current reach. In Meta Ad Library vocabulary, reach is the public-facing impressions-style metric where available. |
| `countriesCount` | `number` | Yes |  |
| `facebookLikes` | `number` | Yes |  |
| `instagramFollowers` | `number` | Yes |  |

**`content` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `title` | `string` | Yes |  |
| `body` | `string` | Yes |  |
| `transcript` | `string` | Yes | Backward-compatible plain transcript text. Rich transcript metadata may also be available on detail responses. |
| `callToAction` | `string` | Yes |  |
| `landingPageUrl` | `string` | Yes |  |
| `landingPageDomain` | `string` | Yes |  |
| `ctaDescription` | `string` | Yes |  |
| `ctaLinkDescription` | `string` | Yes |  |

**`metrics` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `reach` | `number` | Yes | Ad reach where available. In Meta Ad Library vocabulary, reach is the public-facing impressions-style metric. |
| `aggregatedReach` | `number` | Yes | Aggregated ad reach across duplicates where available; reach corresponds to the public impressions-style metric from Meta Ad Library data. |
| `estimatedSpend` | `number` | Yes | Estimated spend in euros. Formula: reach * cpm / 1000, using the request cpm or the default CPM of 9 when cpm is omitted. Rounded to the nearest integer. |
| `duplicates` | `number` | Yes |  |
| `reachDelta1d` | `number` | Yes | One-day reach delta; reach corresponds to the public impressions-style metric from Meta Ad Library data. |
| `reachDelta7d` | `number` | Yes | Seven-day reach delta; reach corresponds to the public impressions-style metric from Meta Ad Library data. |
| `reachDelta30d` | `number` | Yes | Thirty-day reach delta; reach corresponds to the public impressions-style metric from Meta Ad Library data. |

**`audience` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `targetedCountries` | `string`[] | Yes | Full ad targeting country list, including non-EU markets such as US. |
| `mainCountry` | `string` | Yes | Primary audience country from Meta's EU/UK ad transparency reporting. Null for ads outside that scope, even when targetedCountries is populated. |
| `gender` | `men` \| `women` \| `all` | Yes |  |
| `ageMin` | `number` | Yes |  |
| `ageMax` | `number` | Yes |  |

**`rank` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `positionInPage` | `number` | Yes |  |
| `currentRank` | `number` | Yes |  |
| `rankDelta` | `number` | Yes |  |
| `improvementPct` | `number` | Yes |  |

**`flags` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `isEuAd` | `boolean` | Yes |  |
| `isLowReach` | `boolean` | Yes | Whether the ad is flagged as low reach/low impressions in the indexed Meta Ad Library data. |
| `isMediaChanged` | `boolean` | Yes |  |
| `hasPartnerBadge` | `boolean` | Yes |  |

**`pagination` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `page` | `number` | Yes |  |
| `limit` | `number` | Yes |  |
| `total` | `number` | Yes |  |
| `totalPages` | `number` | Yes |  |

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

# List landing pages

`GET /v1/ads/facets/landing-pages`

Aggregates distinct normalized landing-page URLs for Meta pages or one shop domain. Charges one credit per distinct URL returned and never returns ad rows.

**Tags:** Ads

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `scopeTrackedPages` | query | No | `string`[] | Repeated or comma-separated Meta/Facebook page identifiers. Mutually exclusive with scopeDomain. |
| `scopeDomain` | query | No | `string` | Shop URL or hostname. Mutually exclusive with scopeTrackedPages. |
| `status` | query | No | `active` \| `inactive` \| `all` |  |
| `limit` | query | No | `integer` |  |

## Responses

### 200 - Landing-page URL counts, active-ad counts, scope metadata, and truncation state.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": [
    {
      "url": "https://www.example.com/products/item",
      "usageCount": 8,
      "activeAdsCount": 3
    }
  ],
  "meta": {
    "scopeType": "trackedPages",
    "scopeValueCount": 2,
    "status": "all",
    "limit": 100,
    "isTruncated": false
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `data` | `object`[] | Yes |  |
| `meta` | `object` | Yes |  |

**`data[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `url` | `string` | Yes | Normalized landing-page URL in lowercase, without query parameters or trailing slashes. |
| `usageCount` | `number` | Yes | Number of matching ads using this landing-page URL. |
| `activeAdsCount` | `number` | Yes | Number of matching active ads using this landing-page URL. |

**`meta` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `scopeType` | `trackedPages` \| `domain` | Yes |  |
| `scopeValueCount` | `number` | Yes |  |
| `status` | `active` \| `inactive` \| `all` | Yes |  |
| `limit` | `number` | Yes |  |
| `isTruncated` | `boolean` | Yes | True when more normalized domains matched than the response limit or Elasticsearch omitted buckets. |

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

# Create or return an ad share URL

`POST /v1/ads/{adId}/share`

Creates or returns the existing Trendtrack public webapp share URL for an ad. This is classified as a workspace-scoped write because it creates share state server-side when needed; delegated OAuth/API-key callers must be workspace writers.

**Tags:** Ads

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `adId` | path | Yes | `string` | Trendtrack ad identifier returned as `adId` by the Public API. |

## Responses

### 200 - Public ad share URL response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": {
    "adId": "facebook_123456789",
    "id": "3f8aa146-6f96-46e8-9781-64db5166f9a8",
    "slug": "example-brand-9a8b7c",
    "shareUrl": "https://app.trendtrack.io/share/ads/example-brand-9a8b7c",
    "sharePath": "/share/ads/example-brand-9a8b7c",
    "createdAt": "2026-04-18T12:30:00.000Z"
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
| `adId` | `string` | Yes | Trendtrack ad identifier returned as `adId` by the Public API. |
| `id` | `string` | Yes | Identifier of the share_ads row used by the webapp share page. |
| `slug` | `string` | Yes | Human-readable share slug when available. |
| `shareUrl` | `string` | Yes | Fully qualified Trendtrack webapp URL for this public share. |
| `sharePath` | `string` | Yes | Webapp-relative path for this public share. |
| `createdAt` | `string` | Yes |  |

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

### 404 - No ad matches the requested id.

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

# Delete an ad share URL

`DELETE /v1/ads/{adId}/share`

**Tags:** Ads

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `adId` | path | Yes | `string` |  |

## Responses

### 200

**Content-Type:** `application/json`

```json
{
  "requestId": "string",
  "data": {
    "adId": "facebook_123456789",
    "deleted": true
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
| `adId` | `string` | Yes |  |
| `deleted` | `boolean` | Yes |  |

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

# Get an ad media URL

`GET /v1/ads/{adId}/media-url`

Returns URL metadata for the best available media asset for an ad. This endpoint does not proxy or download the binary media.

**Tags:** Ads

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `adId` | path | Yes | `string` | Trendtrack ad identifier returned as `adId` by the Public API. |

## Responses

### 200 - Public ad media URL response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": {
    "adId": "facebook_123456789",
    "mediaType": "video",
    "url": "https://medias.trendtrack.io/ads/ad-1.mp4",
    "urlType": "public_asset",
    "selectedSource": "media_url",
    "mediaUrl": "https://medias.trendtrack.io/ads/ad-1.mp4",
    "thumbnailUrl": "https://medias.trendtrack.io/ads/ad-1-thumb.jpg",
    "filename": "facebook_123456789.mp4"
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
| `adId` | `string` | Yes | Trendtrack ad identifier returned as `adId` by the Public API. |
| `mediaType` | `image` \| `video` \| `carousel` \| `unknown` | Yes |  |
| `url` | `string` | Yes | Best available media URL for this ad. This endpoint returns metadata only and does not proxy the binary asset. |
| `urlType` | `public_asset` \| `external_direct` | Yes | public_asset is a stable Trendtrack/public URL. external_direct may expire or be subject to upstream access controls. |
| `selectedSource` | `media_url` \| `thumbnail_url` | Yes | Source column selected for url. |
| `mediaUrl` | `string` | Yes |  |
| `thumbnailUrl` | `string` | Yes |  |
| `filename` | `string` | Yes | Suggested filename derived from the ad id and selected URL. |

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

### 404 - No ad matches the requested id, or no media URL is available for it.

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

# Get an ad by id

`GET /v1/ads/{adId}`

Returns a single public ad detail object by ad id. The current backing identifier is the internal composite ad id, but the public contract exposes it as id.

**Tags:** Ads

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `adId` | path | Yes | `string` | Trendtrack ad identifier returned as `adId` by the Public API. |

## Responses

### 200 - Public ad detail response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": {
    "id": "facebook_123456789",
    "collationId": "3810635369204881",
    "platform": "facebook",
    "status": "active",
    "createdAt": "2026-04-18T12:30:00.000Z",
    "firstSeenAt": "2026-04-10T00:00:00.000Z",
    "lastSeenAt": "2026-04-19T00:00:00.000Z",
    "daysRunning": 9,
    "media": {
      "type": "video",
      "thumbnailUrl": "https://cdn.example.com/ads/ad-1-thumb.jpg",
      "mediaUrl": "https://cdn.example.com/ads/ad-1.mp4"
    },
    "advertiser": {
      "id": "1234567890",
      "name": "Example Brand",
      "logoUrl": "https://cdn.example.com/pages/example-brand.png",
      "facebookPageId": "1234567890",
      "liveAdsCount": 42,
      "reach30d": 152340,
      "totalReach": 842100,
      "countriesCount": 8,
      "facebookLikes": 125000,
      "instagramFollowers": 89000
    },
    "content": {
      "title": "Summer Sale",
      "body": "Up to 30% off selected products.",
      "transcript": "Save 30% on every order.",
      "callToAction": "Shop now",
      "landingPageUrl": "https://example.com/products/summer-sale",
      "landingPageDomain": "example.com",
      "ctaDescription": "Free shipping on orders over $50.",
      "ctaLinkDescription": "Shop the full collection"
    },
    "metrics": {
      "reach": 152340,
      "aggregatedReach": 284100,
      "estimatedSpend": 4262,
      "duplicates": 4,
      "reachDelta1d": 1200,
      "reachDelta7d": 8200,
      "reachDelta30d": 38400
    },
    "audience": {
      "targetedCountries": [
        "US",
        "FR"
      ],
      "mainCountry": "FR",
      "gender": "all",
      "ageMin": 18,
      "ageMax": 65
    },
    "rank": {
      "positionInPage": 3,
      "currentRank": 12,
      "rankDelta": -4,
      "improvementPct": 0.25
    },
    "flags": {
      "isEuAd": true,
      "isLowReach": false,
      "isMediaChanged": false,
      "hasPartnerBadge": true
    },
    "transcript": {
      "language": "en",
      "languageConfidence": 0.97,
      "segments": [
        {
          "start": 0.4,
          "end": 3.2,
          "text": "Save 30% on every order."
        }
      ],
      "fullText": "Save 30% on every order."
    },
    "creativeAnalysis": {
      "hook": {
        "text": "Yes, it is pricey. Also, worth it.",
        "source": "ad_transcripts_hook",
        "sourceDescription": "Existing completed ad transcript hook.",
        "isFallback": false
      }
    },
    "links": {
      "adLibraryUrl": "https://www.facebook.com/ads/library/?view_all_page_id=1234567890&id=9876543210",
      "landingPageUrl": "https://example.com/products/summer-sale"
    },
    "shops": [
      {
        "shopId": "3f8aa146-6f96-46e8-9781-64db5166f9a8",
        "domain": "example.com",
        "name": "Example Shop",
        "isPrimary": true,
        "traffic": 45231,
        "categories": [
          "Fashion",
          "Accessories"
        ]
      }
    ],
    "pageAnalytics": {
      "impressionsHistory": [
        {
          "date": "2026-04-18",
          "totalImpressions": 12340
        }
      ],
      "facebookLikesHistory": [
        {
          "date": "2026-04-18",
          "value": 84000
        }
      ],
      "instagramFollowersHistory": [
        {
          "date": "2026-04-18",
          "value": 84000
        }
      ]
    },
    "resolvedFrom": {
      "requestedId": "facebook_2938968053111742",
      "reason": "duplicate_group"
    }
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
| `collationId` | `string` | No | Creative collation identifier when this result represents a deduplicated group of related Meta ads. Pass this value as scan_ad.collation_id to scan the same combined creative shown by search. |
| `platform` | `facebook` | Yes |  |
| `status` | `active` \| `inactive` \| `unknown` | Yes | For a result with collationId, active means at least one media-backed member ad is active. Without collationId, this is the individual ad status. |
| `createdAt` | `string` | Yes |  |
| `firstSeenAt` | `string` | Yes | For a result with collationId, the earliest first-seen date across the combined creative members. |
| `lastSeenAt` | `string` | Yes | For a result with collationId, null while any media-backed member remains active; otherwise the latest member end date. |
| `daysRunning` | `number` | Yes | Indexed running duration in days. For a result with collationId, this is the creative calendar span from the oldest member start to today while any member is active, or to the latest member end otherwise; it does not imply continuous delivery by one ad. Historical backfill is bounded by the available firstSeenAt floor (currently 2018-01-01), so very old ads can share the same maximum/clamped value. |
| `media` | `object` | Yes |  |
| `advertiser` | `object` | Yes |  |
| `content` | `object` | Yes |  |
| `metrics` | `object` | Yes |  |
| `audience` | `object` | Yes |  |
| `rank` | `object` | Yes |  |
| `flags` | `object` | Yes |  |
| `transcript` | `object` | Yes |  |
| `creativeAnalysis` | `object` | Yes |  |
| `links` | `object` | Yes |  |
| `shops` | `object`[] | Yes |  |
| `pageAnalytics` | `object` | Yes |  |
| `resolvedFrom` | `object` | No | Present only when the served ad is not the requested one: `id` is then the ad Trendtrack serves for the requested ad's duplicate group. |

**`media` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `image` \| `video` \| `carousel` \| `unknown` | Yes | Creative media type from indexed ad data. `carousel` means carousel creative format and is not a DCO signal. |
| `thumbnailUrl` | `string` | Yes |  |
| `mediaUrl` | `string` | Yes |  |

**`advertiser` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes |  |
| `name` | `string` | Yes |  |
| `logoUrl` | `string` | Yes |  |
| `facebookPageId` | `string` | Yes |  |
| `liveAdsCount` | `number` | Yes |  |
| `reach30d` | `number` | Yes | Advertiser reach for the last 30 days. In Meta Ad Library vocabulary, reach is the public-facing impressions-style metric where available. |
| `totalReach` | `number` | Yes | Advertiser total/current reach. In Meta Ad Library vocabulary, reach is the public-facing impressions-style metric where available. |
| `countriesCount` | `number` | Yes |  |
| `facebookLikes` | `number` | Yes |  |
| `instagramFollowers` | `number` | Yes |  |

**`content` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `title` | `string` | Yes |  |
| `body` | `string` | Yes |  |
| `transcript` | `string` | Yes | Backward-compatible plain transcript text. Rich transcript metadata may also be available on detail responses. |
| `callToAction` | `string` | Yes |  |
| `landingPageUrl` | `string` | Yes |  |
| `landingPageDomain` | `string` | Yes |  |
| `ctaDescription` | `string` | Yes |  |
| `ctaLinkDescription` | `string` | Yes |  |

**`metrics` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `reach` | `number` | Yes | Ad reach where available. In Meta Ad Library vocabulary, reach is the public-facing impressions-style metric. |
| `aggregatedReach` | `number` | Yes | Aggregated ad reach across duplicates where available; reach corresponds to the public impressions-style metric from Meta Ad Library data. |
| `estimatedSpend` | `number` | Yes | Estimated spend in euros. Formula: reach * cpm / 1000, using the request cpm or the default CPM of 9 when cpm is omitted. Rounded to the nearest integer. |
| `duplicates` | `number` | Yes |  |
| `reachDelta1d` | `number` | Yes | One-day reach delta; reach corresponds to the public impressions-style metric from Meta Ad Library data. |
| `reachDelta7d` | `number` | Yes | Seven-day reach delta; reach corresponds to the public impressions-style metric from Meta Ad Library data. |
| `reachDelta30d` | `number` | Yes | Thirty-day reach delta; reach corresponds to the public impressions-style metric from Meta Ad Library data. |

**`audience` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `targetedCountries` | `string`[] | Yes | Full ad targeting country list, including non-EU markets such as US. |
| `mainCountry` | `string` | Yes | Primary audience country from Meta's EU/UK ad transparency reporting. Null for ads outside that scope, even when targetedCountries is populated. |
| `gender` | `men` \| `women` \| `all` | Yes |  |
| `ageMin` | `number` | Yes |  |
| `ageMax` | `number` | Yes |  |

**`rank` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `positionInPage` | `number` | Yes |  |
| `currentRank` | `number` | Yes |  |
| `rankDelta` | `number` | Yes |  |
| `improvementPct` | `number` | Yes |  |

**`flags` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `isEuAd` | `boolean` | Yes |  |
| `isLowReach` | `boolean` | Yes | Whether the ad is flagged as low reach/low impressions in the indexed Meta Ad Library data. |
| `isMediaChanged` | `boolean` | Yes |  |
| `hasPartnerBadge` | `boolean` | Yes |  |

**`transcript` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `language` | `string` | Yes |  |
| `languageConfidence` | `number` | Yes |  |
| `segments` | `object`[] | Yes |  |
| `fullText` | `string` | Yes |  |

**`segments[]` item properties:**


**`creativeAnalysis` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `hook` | `object` | Yes |  |

**`hook` properties:**


**`links` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `adLibraryUrl` | `string` | Yes |  |
| `landingPageUrl` | `string` | Yes |  |

**`shops[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `shopId` | `string` | Yes |  |
| `domain` | `string` | Yes |  |
| `name` | `string` | Yes |  |
| `isPrimary` | `boolean` | Yes |  |
| `traffic` | `number` | Yes |  |
| `categories` | `string`[] | Yes |  |

**`pageAnalytics` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `impressionsHistory` | `object`[] | Yes | Historical Facebook page impressions when available; ad-level DTOs may expose comparable Meta Ad Library vocabulary as reach. |
| `facebookLikesHistory` | `object`[] | Yes |  |
| `instagramFollowersHistory` | `object`[] | Yes |  |

**`impressionsHistory[]` item properties:**


**`facebookLikesHistory[]` item properties:**


**`instagramFollowersHistory[]` item properties:**


**`resolvedFrom` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `requestedId` | `string` | Yes | The ad id that was requested. |
| `reason` | `duplicate_group` | Yes | duplicate_group: the requested ad is a duplicate of the served ad (same collationId); the served ad carries the group's figures. |

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

### 404 - No ad matches the requested id.

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

# Get ad reach history

`GET /v1/ads/{adId}/reach-history`

Returns the public daily reach history for one ad. The series is intentionally lightweight and keeps reach as the canonical metric term.

**Tags:** Ads

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `adId` | path | Yes | `string` | Trendtrack ad identifier returned as `adId` by the Public API. |
| `limit` | query | No | `integer` |  |

## Responses

### 200 - Public ad reach history response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": [
    {
      "date": "2026-04-18",
      "reach": 152340
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
| `date` | `string` | Yes |  |
| `reach` | `number` | Yes | Daily ad reach. In Meta Ad Library vocabulary, reach is the public-facing impressions-style metric where available. |

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

### 404 - No ad matches the requested id.

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
