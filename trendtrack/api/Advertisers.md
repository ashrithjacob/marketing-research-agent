# Advertisers

---

# List advertisers

`GET /v1/advertisers`

Returns the lightweight public advertisers collection. This endpoint stays intentionally simple and focuses on brand/domain search, pagination, ordering, and stable scalar filters. Use POST /v1/advertisers/query for the advanced discovery surface.

**Tags:** Advertisers

## Parameters

**Query parameter groups:**

- Pagination: `offset`, `limit`
- Search: `search`, `searchType`, `keywordMode`
- Time and snapshots: `minFbPageCreationDate`, `maxFbPageCreationDate`, `adsTimePeriod`, `adsLaunchedPeriod`, `reachPeriod`
- Sorting: `sortBy`, `order`
- Filters: `minActiveAds`, `maxActiveAds`, `minFacebookLikes`, `maxFacebookLikes`, `minInstagramFollowers`, `maxInstagramFollowers`, `minAdsLaunched`, `maxAdsLaunched`, `minReach`, `maxReach`, `pageType`, `categoryIds`, `shopifyLinked`, `gender`

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `search` | query | No | `string`[] | Optional advertiser search keywords. Repeated query params and comma-separated values are both accepted. |
| `searchType` | query | No | `brand` \| `domain` | Simple search strategy for the advertisers collection. Use POST /v1/advertisers/query for advanced text resolution modes. |
| `keywordMode` | query | No | `any` \| `all` | How multiple search keywords should combine. Defaults to any. |
| `sortBy` | query | No | `relevance` \| `newest` \| `activeAds` \| `newAds` \| `euAdsShare` \| `reach` \| `reach14d` \| `followers` | Primary sort key for advertiser discovery. Defaults to relevance. |
| `order` | query | No | `asc` \| `desc` | Sort order. Ignored when sortBy=relevance because relevance is always ranked descending. |
| `offset` | query | No | `integer` | Pagination offset. Defaults to 0. |
| `limit` | query | No | `integer` | Maximum number of advertisers to return. Defaults to 20. |
| `minFbPageCreationDate` | query | No | `string` | Inclusive lower bound for the Facebook page creation date filter. |
| `maxFbPageCreationDate` | query | No | `string` | Inclusive upper bound for the Facebook page creation date filter. |
| `minActiveAds` | query | No | `integer` |  |
| `maxActiveAds` | query | No | `integer` |  |
| `adsTimePeriod` | query | No | `current` \| `last24h` \| `last7d` \| `last14d` \| `last30d` | Enum value accepted by this request. Allowed values: `current`, `last24h`, `last7d`, `last14d`, `last30d`. |
| `minFacebookLikes` | query | No | `integer` |  |
| `maxFacebookLikes` | query | No | `integer` |  |
| `minInstagramFollowers` | query | No | `integer` |  |
| `maxInstagramFollowers` | query | No | `integer` |  |
| `minAdsLaunched` | query | No | `integer` |  |
| `maxAdsLaunched` | query | No | `integer` |  |
| `adsLaunchedPeriod` | query | No | `last24h` \| `last7d` \| `last14d` \| `last30d` \| `last90d` | Time window accepted by this request. Allowed values: `last24h`, `last7d`, `last14d`, `last30d`, `last90d`. |
| `minReach` | query | No | `integer` | Minimum advertiser reach threshold. In Meta Ad Library vocabulary, reach is the public-facing impressions-style metric where available. |
| `maxReach` | query | No | `integer` | Maximum advertiser reach threshold. In Meta Ad Library vocabulary, reach is the public-facing impressions-style metric where available. |
| `reachPeriod` | query | No | `last24h` \| `last7d` \| `last14d` \| `last30d` \| `last90d` \| `total` | Reach/impressions metric window. In Meta Ad Library vocabulary, reach is the public-facing impressions-style metric where available. Allowed values: `last24h`, `last7d`, `last14d`, `last30d`, `last90d`, `total`. |
| `pageType` | query | No | `influencer` \| `brand`[] | Enum value accepted by this request. Allowed values: `influencer`, `brand`. |
| `categoryIds` | query | No | `integer`[] | Google category facet ids matched through linked websites' website_overview.google_categories. Repeated query params and comma-separated values are both accepted. |
| `shopifyLinked` | query | No | `yes` \| `no` \| `all` | Filter by indexed linked-site Shopify technology. `no` means no indexed Shopify technology is present for the advertiser. |
| `gender` | query | No | `male` \| `female` \| `all` | Enum value accepted by this request. Allowed values: `male`, `female`, `all`. |

## Responses

### 200 - Paginated advertisers response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": [
    {
      "id": "61554990830184",
      "platform": "facebook",
      "facebookPageId": "61554990830184",
      "name": "Example Brand",
      "logoUrl": "https://medias.trendtrack.io/profile_picture/61554990830184.jpg",
      "profile": {
        "likes": 125000,
        "instagramFollowers": 89000,
        "createdAt": "2019-01-04T00:00:00.000Z"
      },
      "advertising": {
        "activeAds": 12,
        "reach30d": 452000
      },
      "lastAds": [
        {
          "id": "facebook:123456789",
          "mediaUrl": "https://medias.trendtrack.io/facebook/media/ad-1.mp4",
          "thumbnailUrl": "https://medias.trendtrack.io/facebook/thumb/ad-1.jpg"
        }
      ],
      "mainLandingPages": [
        {
          "landingPage": "https://example.com/products/summer",
          "screenshotUrl": "https://medias.trendtrack.io/landing-pages/summer.jpg"
        }
      ]
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 128
  },
  "meta": {
    "isTruncated": false
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
| `id` | `string` | Yes | Current public advertiser identifier. This MVP uses the Facebook page id directly. |
| `platform` | `facebook` | Yes |  |
| `facebookPageId` | `string` | Yes |  |
| `name` | `string` | Yes |  |
| `logoUrl` | `string` | Yes |  |
| `profile` | `object` | Yes |  |
| `advertising` | `object` | Yes |  |
| `lastAds` | `object`[] | Yes |  |
| `mainLandingPages` | `object`[] | Yes |  |

**`profile` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `likes` | `number` | Yes |  |
| `instagramFollowers` | `number` | Yes |  |
| `createdAt` | `string` | Yes | Facebook/page-explorer page creation date, aligned with minFbPageCreationDate and maxFbPageCreationDate filters. This is not the internal database ingestion timestamp. |

**`advertising` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `activeAds` | `number` | Yes | Active ads count, preferring page-explorer running_ads_count with relational fallback when unavailable. |
| `reach30d` | `number` | Yes | Advertiser reach over the last 30 days, preferring page-explorer eu_reach_30d with fb_page fallback when unavailable. In Meta Ad Library vocabulary, reach is the public-facing impressions-style metric where available. |

**`lastAds[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes |  |
| `mediaUrl` | `string` | Yes |  |
| `thumbnailUrl` | `string` | Yes |  |

**`mainLandingPages[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `landingPage` | `string` | Yes |  |
| `screenshotUrl` | `string` | Yes |  |

**`pagination` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `limit` | `number` | Yes |  |
| `offset` | `number` | Yes |  |
| `total` | `number` | Yes |  |

**`meta` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `isTruncated` | `boolean` | Yes | True when an intermediary aggregation-based search stage truncated the intermediate id set before the final advertiser query. |

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

# Query advertisers

`POST /v1/advertisers/query`

Returns the advanced public advertisers query surface. This endpoint supports the current richer advertiser discovery filters through a structured public camelCase contract while keeping the response aligned with the standard public advertiser summary shape. categoryIds uses linked websites' google_categories; pageNiches remains an advanced legacy page-niche filter. Empty JSON bodies are valid and use defaults.

**Tags:** Advertisers

## Request Body

**Content-Type:** `application/json`

**Find active brand advertisers with strong recent reach:**

```json
{
  "search": [
    "athleisure"
  ],
  "searchType": "brand",
  "sortBy": "reach",
  "order": "desc",
  "adsTimePeriod": "last7d",
  "minActiveAds": 10,
  "reachPeriod": "last14d",
  "minReach": 50000,
  "categoryIds": [
    254
  ],
  "pageType": [
    "brand"
  ],
  "limit": 20,
  "offset": 0
}
```

**Empty object body is valid and uses default pagination/sort behavior:**

```json
{}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `search` | `string`[] | No |  |
| `searchType` | `brand` \| `domain` \| `adCopy` \| `websiteCopy` \| `urlContains` | No | Advanced search strategy for advertiser discovery. Supports content and URL resolution modes in addition to simple brand/domain search. |
| `keywordMode` | `any` \| `all` | No | Enum value accepted by this request. Allowed values: `any`, `all`. |
| `sortBy` | `relevance` \| `newest` \| `activeAds` \| `newAds` \| `euAdsShare` \| `reach` \| `reach14d` \| `followers` | No | Sort key for this request. Allowed values: `relevance`, `newest`, `activeAds`, `newAds`, `euAdsShare`, `reach`, `reach14d`, `followers`. |
| `order` | `asc` \| `desc` | No | Sort order. Ignored when sortBy=relevance because relevance is always ranked descending. |
| `offset` | `number` | No |  |
| `limit` | `number` | No |  |
| `minFbPageCreationDate` | `string` | No |  |
| `maxFbPageCreationDate` | `string` | No |  |
| `minActiveAds` | `number` | No |  |
| `maxActiveAds` | `number` | No |  |
| `adsTimePeriod` | `current` \| `last24h` \| `last7d` \| `last14d` \| `last30d` | No | Enum value accepted by this request. Allowed values: `current`, `last24h`, `last7d`, `last14d`, `last30d`. |
| `minFacebookLikes` | `number` | No |  |
| `maxFacebookLikes` | `number` | No |  |
| `minInstagramFollowers` | `number` | No |  |
| `maxInstagramFollowers` | `number` | No |  |
| `minAdsLaunched` | `number` | No |  |
| `maxAdsLaunched` | `number` | No |  |
| `adsLaunchedPeriod` | `last24h` \| `last7d` \| `last14d` \| `last30d` \| `last90d` | No | Time window accepted by this request. Allowed values: `last24h`, `last7d`, `last14d`, `last30d`, `last90d`. |
| `minReach` | `number` | No | Minimum advertiser reach threshold. In Meta Ad Library vocabulary, reach is the public-facing impressions-style metric where available. |
| `maxReach` | `number` | No | Maximum advertiser reach threshold. In Meta Ad Library vocabulary, reach is the public-facing impressions-style metric where available. |
| `reachPeriod` | `last24h` \| `last7d` \| `last14d` \| `last30d` \| `last90d` \| `total` | No | Reach/impressions metric window. In Meta Ad Library vocabulary, reach is the public-facing impressions-style metric where available. Allowed values: `last24h`, `last7d`, `last14d`, `last30d`, `last90d`, `total`. |
| `minSpendPerPage` | `number` | No | Minimum estimated spend per page. Converted internally through CPM and reach/impressions fields. |
| `maxSpendPerPage` | `number` | No | Maximum estimated spend per page. Converted internally through CPM and reach/impressions fields. |
| `spendPerPagePeriod` | `last24h` \| `last7d` \| `last14d` \| `last30d` \| `last90d` \| `total` | No | Reach/impressions metric window. In Meta Ad Library vocabulary, reach is the public-facing impressions-style metric where available. Allowed values: `last24h`, `last7d`, `last14d`, `last30d`, `last90d`, `total`. |
| `cpm` | `number` | No | CPM used to convert spend filters into reach/impressions-based ES ranges. |
| `minReachPerPage` | `number` | No | Minimum reach-per-page filter. Reach corresponds to the public impressions-style metric from Meta Ad Library data. |
| `maxReachPerPage` | `number` | No | Maximum reach-per-page filter. Reach corresponds to the public impressions-style metric from Meta Ad Library data. |
| `reachPerPagePeriod` | `last24h` \| `last7d` \| `last14d` \| `last30d` \| `last90d` \| `total` | No | Reach/impressions metric window. In Meta Ad Library vocabulary, reach is the public-facing impressions-style metric where available. Allowed values: `last24h`, `last7d`, `last14d`, `last30d`, `last90d`, `total`. |
| `adLanguage` | `string`[] | No |  |
| `technologies` | `string`[] | No |  |
| `adCountries` | `object` | No | Countries where the advertiser is distributing ads. Uses ISO 3166-1 alpha-2 country codes. |
| `mainCountries` | `string`[] | No | Primary countries to match. |
| `countryFilterMode` | `reach` \| `adCount` | No | Enum value accepted by this request. Allowed values: `reach`, `adCount`. |
| `adsGrowth` | `object` | No | Ads growth filter. Uses OR groups (`anyOf`) made of AND-ed rules (`all`), with rule fields `period`, `operator`, and `value`. |
| `pageReachGrowth` | `object` | No | Page reach growth filter. Uses OR groups (`anyOf`) made of AND-ed rules (`all`), with rule fields `period`, `operator`, and `value`. |
| `ageRanges` | `string`[] | No |  |
| `pageType` | `influencer` \| `brand`[] | No | Enum value accepted by this request. Allowed values: `influencer`, `brand`. |
| `categoryIds` | `number`[] | No | Google category facet ids matched through linked websites' website_overview.google_categories. |
| `pageNiches` | `object` | No | Not supported: advertiser page niches are not indexed, so any non-empty selection is rejected with 400 unsupported_filter. Use categoryIds, which matches linked websites via google_categories. |
| `minPartnershipPercentage` | `number` | No |  |
| `shopifyLinked` | `yes` \| `no` \| `all` | No | Filter by indexed linked-site Shopify technology. `no` means no indexed Shopify technology is present for the advertiser. |
| `gender` | `male` \| `female` \| `all` | No | Enum value accepted by this request. Allowed values: `male`, `female`, `all`. |

**`adCountries` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `include` | `string`[] | No | ISO 3166-1 alpha-2 country codes to include. |
| `exclude` | `string`[] | No | ISO 3166-1 alpha-2 country codes to exclude. |

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
| `anyOf` | `object`[] | Yes | OR groups of page reach growth rules. Each group combines its rules with AND. |

**`anyOf[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `all` | `object`[] | Yes |  |

**`all[]` item properties:**


**`pageNiches` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `main` | `number`[] | No | Advanced legacy page-niche categories that must match the main advertiser page niche. |
| `among` | `number`[] | No | Advanced legacy page-niche categories that may appear among advertiser page niches. |
| `exclude` | `number`[] | No | Advanced legacy page-niche categories to exclude from advertiser page niches. |

## Responses

### 200 - Paginated advertisers query response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": [
    {
      "id": "61554990830184",
      "platform": "facebook",
      "facebookPageId": "61554990830184",
      "name": "Example Brand",
      "logoUrl": "https://medias.trendtrack.io/profile_picture/61554990830184.jpg",
      "profile": {
        "likes": 125000,
        "instagramFollowers": 89000,
        "createdAt": "2019-01-04T00:00:00.000Z"
      },
      "advertising": {
        "activeAds": 12,
        "reach30d": 452000
      },
      "lastAds": [
        {
          "id": "facebook:123456789",
          "mediaUrl": "https://medias.trendtrack.io/facebook/media/ad-1.mp4",
          "thumbnailUrl": "https://medias.trendtrack.io/facebook/thumb/ad-1.jpg"
        }
      ],
      "mainLandingPages": [
        {
          "landingPage": "https://example.com/products/summer",
          "screenshotUrl": "https://medias.trendtrack.io/landing-pages/summer.jpg"
        }
      ]
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 128
  },
  "meta": {
    "isTruncated": false
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
| `id` | `string` | Yes | Current public advertiser identifier. This MVP uses the Facebook page id directly. |
| `platform` | `facebook` | Yes |  |
| `facebookPageId` | `string` | Yes |  |
| `name` | `string` | Yes |  |
| `logoUrl` | `string` | Yes |  |
| `profile` | `object` | Yes |  |
| `advertising` | `object` | Yes |  |
| `lastAds` | `object`[] | Yes |  |
| `mainLandingPages` | `object`[] | Yes |  |

**`profile` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `likes` | `number` | Yes |  |
| `instagramFollowers` | `number` | Yes |  |
| `createdAt` | `string` | Yes | Facebook/page-explorer page creation date, aligned with minFbPageCreationDate and maxFbPageCreationDate filters. This is not the internal database ingestion timestamp. |

**`advertising` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `activeAds` | `number` | Yes | Active ads count, preferring page-explorer running_ads_count with relational fallback when unavailable. |
| `reach30d` | `number` | Yes | Advertiser reach over the last 30 days, preferring page-explorer eu_reach_30d with fb_page fallback when unavailable. In Meta Ad Library vocabulary, reach is the public-facing impressions-style metric where available. |

**`lastAds[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes |  |
| `mediaUrl` | `string` | Yes |  |
| `thumbnailUrl` | `string` | Yes |  |

**`mainLandingPages[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `landingPage` | `string` | Yes |  |
| `screenshotUrl` | `string` | Yes |  |

**`pagination` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `limit` | `number` | Yes |  |
| `offset` | `number` | Yes |  |
| `total` | `number` | Yes |  |

**`meta` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `isTruncated` | `boolean` | Yes | True when an intermediary aggregation-based search stage truncated the intermediate id set before the final advertiser query. |

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

# List ads for an advertiser

`GET /v1/advertisers/{advertiserId}/ads`

Returns a paginated list of ads for the requested page-centric advertiser. In this first MVP iteration, advertiserId resolves directly from the Facebook page id.

**Tags:** Advertisers

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `advertiserId` | path | Yes | `string` | Public advertiser identifier. Current MVP uses the Facebook page id directly. |
| `limit` | query | No | `integer` |  |
| `offset` | query | No | `integer` |  |
| `status` | query | No | `all` \| `active` \| `inactive` | Filter ads by activity status. Allowed values: `all`, `active`, `inactive`. |
| `mediaType` | query | No | `all` \| `image` \| `video` | Filter ads by creative media type. Allowed values: `all`, `image`, `video`. |
| `sortBy` | query | No | `newest` \| `createdAt` \| `longestRunning` \| `reach` \| `duplicates` | Sort key for advertiser ads. `reach` uses the public reach/impressions metric; no `impressions` alias is accepted on this endpoint. |
| `order` | query | No | `asc` \| `desc` | Sort direction. Allowed values: `asc`, `desc`. |
| `cpm` | query | No | `integer` | Optional CPM override used to compute estimated spend in the ads response. |

## Responses

### 200 - Paginated advertiser ads response. The response also includes the X-Request-Id header.

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
    "limit": 25,
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

### 404 - Advertiser not found. Possible error code: not_found.

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

# Get advertiser detail

`GET /v1/advertisers/{advertiserId}`

Returns the page-centric advertiser detail. In this first MVP iteration, advertiserId resolves directly from the Facebook page id.

**Tags:** Advertisers

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `advertiserId` | path | Yes | `string` | Public advertiser identifier. Current MVP uses the Facebook page id directly. |

## Responses

### 200 - Advertiser detail response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": {
    "id": "61554990830184",
    "platform": "facebook",
    "facebookPageId": "61554990830184",
    "name": "Example Brand",
    "logoUrl": "https://medias.trendtrack.io/profile_picture/61554990830184.jpg",
    "profile": {
      "likes": 125000,
      "instagramFollowers": 89000,
      "createdAt": "2019-01-04T00:00:00.000Z"
    },
    "linkedShops": [
      {
        "shopId": "3f8aa146-6f96-46e8-9781-64db5166f9a8",
        "domain": "example.com",
        "name": "Example Shop",
        "isPrimary": true
      }
    ],
    "advertising": {
      "activeAds": 12,
      "reach30d": 452000,
      "countryDistribution": [
        {
          "countryCode": "US",
          "share": 0.42
        }
      ]
    },
    "lastAds": [
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
| `id` | `string` | Yes | Current MVP uses the Facebook page id directly as the public advertiser id. |
| `platform` | `facebook` | Yes |  |
| `facebookPageId` | `string` | Yes |  |
| `name` | `string` | Yes |  |
| `logoUrl` | `string` | Yes |  |
| `profile` | `object` | Yes |  |
| `linkedShops` | `object`[] | Yes |  |
| `advertising` | `object` | Yes |  |
| `lastAds` | `object`[] | Yes | Most recent advertiser ads using the shared public ad summary contract. |

**`profile` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `likes` | `number` | Yes |  |
| `instagramFollowers` | `number` | Yes |  |
| `createdAt` | `string` | Yes | Facebook/page-explorer page creation date, aligned with minFbPageCreationDate and maxFbPageCreationDate filters. This is not the internal database ingestion timestamp. |

**`linkedShops[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `shopId` | `string` | Yes |  |
| `domain` | `string` | Yes |  |
| `name` | `string` | Yes |  |
| `isPrimary` | `boolean` | Yes |  |

**`advertising` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `activeAds` | `number` | Yes | Active ads count, preferring page-explorer running_ads_count with relational fallback when unavailable. |
| `reach30d` | `number` | Yes | Advertiser reach over the last 30 days, preferring page-explorer eu_reach_30d with fb_page.impressions_last_month fallback when unavailable. In Meta Ad Library vocabulary, reach is the public-facing impressions-style metric where available. |
| `countryDistribution` | `object`[] | Yes |  |

**`countryDistribution[]` item properties:**


**`lastAds[]` item properties:**


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


**`advertiser` properties:**


**`content` properties:**


**`metrics` properties:**


**`audience` properties:**


**`rank` properties:**


**`flags` properties:**


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

### 404 - Advertiser not found. Possible error code: not_found.

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
