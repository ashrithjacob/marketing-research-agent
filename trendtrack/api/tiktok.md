# TikTok

---

# List TikTok library items

`GET /v1/tiktok/library`

Returns TikTok ads and organic videos from the Public API TikTok library. This namespace is separate from the Meta-only /v1/ads endpoints and is backed by the tiktoks-search Elasticsearch alias.

**Tags:** TikTok

## Parameters

**Query parameter groups:**

- Pagination: `page`, `limit`
- Search: `search`, `searchArea`
- Sorting: `sortBy`, `order`
- Filters: `type`, `status`, `mediaTypes`, `languages`, `countries`, `hashtags`, `tiktokPageId`, `domain`, `handle`, `publishedAfter`, `publishedBefore`, `minViews`, `maxViews`, `minEngagementRate`, `maxEngagementRate`

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `search` | query | No | `string` |  |
| `searchArea` | query | No | `all` \| `caption` \| `profile` \| `hashtag` \| `music` |  |
| `type` | query | No | `all` \| `ad` \| `organic` |  |
| `status` | query | No | `all` \| `active` \| `inactive` |  |
| `mediaTypes` | query | No | `image` \| `video` \| `carousel`[] |  |
| `languages` | query | No | `string`[] | ISO 639-1 codes (en, fr) or English language names (English, french), case-insensitive. |
| `countries` | query | No | `string`[] |  |
| `hashtags` | query | No | `string`[] | Hashtags with or without #, case-insensitive. |
| `tiktokPageId` | query | No | `string` |  |
| `domain` | query | No | `string` |  |
| `handle` | query | No | `string` |  |
| `publishedAfter` | query | No | `string` |  |
| `publishedBefore` | query | No | `string` |  |
| `minViews` | query | No | `integer` |  |
| `maxViews` | query | No | `integer` |  |
| `minEngagementRate` | query | No | `number` |  |
| `maxEngagementRate` | query | No | `number` |  |
| `sortBy` | query | No | `relevance` \| `newest` \| `updatedAt` \| `views` \| `likes` \| `comments` \| `shares` \| `saves` \| `engagementRate` \| `daysRunning` \| `followers` |  |
| `order` | query | No | `asc` \| `desc` |  |
| `page` | query | No | `object` |  |
| `limit` | query | No | `object` |  |

## Responses

### 200 - Paginated TikTok library response. One returned TikTok item is one billable ads credit.

**Content-Type:** `application/json`

```json
{
  "requestId": "req_123",
  "data": [
    {
      "id": "tiktok_7078586231734521093",
      "tiktokId": "string",
      "type": "ad",
      "status": "active",
      "isPinned": true,
      "publishedAt": "string",
      "createdAt": "string",
      "updatedAt": "string",
      "daysRunning": 0,
      "media": {
        "type": "video",
        "thumbnailUrl": "string",
        "mediaUrl": "string",
        "videoUrl": "string",
        "imageUrls": [
          "string"
        ],
        "medias": [
          {
            "type": "video",
            "url": "string",
            "order": 0
          }
        ],
        "durationSec": 0,
        "mediaCount": 0,
        "imageCount": 0
      },
      "content": {
        "description": "string",
        "language": "string",
        "category": "string",
        "hashtags": [
          "string"
        ],
        "music": {
          "id": "string",
          "title": "string",
          "author": "string"
        }
      },
      "metrics": {
        "views": 0,
        "likes": 0,
        "comments": 0,
        "saves": 0,
        "shares": 0,
        "reposts": 0,
        "engagementRate": 0,
        "rank": 0,
        "rankPercent": 0,
        "relevanceScore": 0,
        "deltaRank3d": 0,
        "deltaRank7d": 0,
        "deltaRank14d": 0,
        "deltaRank30d": 0
      },
      "profile": {
        "id": "string",
        "handle": "string",
        "name": "string",
        "avatarUrl": "string",
        "bio": "string",
        "bioUrl": "string",
        "accountType": "string",
        "secUid": "string",
        "followers": 0,
        "following": 0,
        "totalTikToks": 0,
        "newTikToks": 0,
        "percentAds": 0,
        "views": 0,
        "likes": 0,
        "pageCreation": "string"
      },
      "shop": {
        "id": "string",
        "domain": "string",
        "name": "string",
        "logoUrl": "string",
        "faviconUrl": "string",
        "countryCode": "string",
        "monthlyVisits": 0,
        "trafficGrowth30d": 0,
        "productsCount": 0,
        "googleCategoryIds": [
          0
        ]
      },
      "pin": {
        "isCurrent": true,
        "firstPinnedAt": "string",
        "lastPinnedAt": "string",
        "lastUnpinnedAt": "string"
      },
      "pageSnapshot": {
        "recordedAt": "string",
        "adsCount": 0,
        "organicCount": 0,
        "totalTikToks": 0,
        "dailyViews": 0,
        "dailyLikes": 0,
        "dailyFollowers": 0
      },
      "indexedAt": "string"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 250,
    "totalPages": 10
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
| `id` | `string` | Yes |  |
| `tiktokId` | `string` | Yes |  |
| `type` | `ad` \| `organic` | Yes |  |
| `status` | `active` \| `inactive` \| `unknown` | Yes |  |
| `isPinned` | `boolean` | Yes |  |
| `publishedAt` | `string` | Yes |  |
| `createdAt` | `string` | Yes |  |
| `updatedAt` | `string` | Yes |  |
| `daysRunning` | `number` | Yes |  |
| `media` | `object` | Yes |  |
| `content` | `object` | Yes |  |
| `metrics` | `object` | Yes |  |
| `profile` | `object` | Yes |  |
| `shop` | `object` | Yes |  |
| `pin` | `object` | Yes |  |
| `pageSnapshot` | `object` | Yes |  |
| `indexedAt` | `string` | Yes |  |

**`media` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `image` \| `video` \| `carousel` \| `unknown` | Yes |  |
| `thumbnailUrl` | `string` | Yes |  |
| `mediaUrl` | `string` | Yes |  |
| `videoUrl` | `string` | Yes |  |
| `imageUrls` | `string`[] | Yes |  |
| `medias` | `object`[] | Yes |  |
| `durationSec` | `number` | Yes |  |
| `mediaCount` | `number` | Yes |  |
| `imageCount` | `number` | Yes |  |

**`medias[]` item properties:**


**`content` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `description` | `string` | Yes |  |
| `language` | `string` | Yes |  |
| `category` | `string` | Yes |  |
| `hashtags` | `string`[] | Yes |  |
| `music` | `object` | Yes |  |

**`music` properties:**


**`metrics` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `views` | `number` | Yes |  |
| `likes` | `number` | Yes |  |
| `comments` | `number` | Yes |  |
| `saves` | `number` | Yes |  |
| `shares` | `number` | Yes |  |
| `reposts` | `number` | Yes |  |
| `engagementRate` | `number` | Yes | Percentage, not fraction. |
| `rank` | `number` | Yes |  |
| `rankPercent` | `number` | Yes |  |
| `relevanceScore` | `number` | Yes |  |
| `deltaRank3d` | `number` | Yes |  |
| `deltaRank7d` | `number` | Yes |  |
| `deltaRank14d` | `number` | Yes |  |
| `deltaRank30d` | `number` | Yes |  |

**`profile` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes |  |
| `handle` | `string` | Yes |  |
| `name` | `string` | Yes |  |
| `avatarUrl` | `string` | Yes |  |
| `bio` | `string` | Yes |  |
| `bioUrl` | `string` | Yes |  |
| `accountType` | `string` | Yes |  |
| `secUid` | `string` | Yes |  |
| `followers` | `number` | Yes |  |
| `following` | `number` | Yes |  |
| `totalTikToks` | `number` | Yes |  |
| `newTikToks` | `number` | Yes |  |
| `percentAds` | `number` | Yes |  |
| `views` | `number` | Yes |  |
| `likes` | `number` | Yes |  |
| `pageCreation` | `string` | Yes |  |

**`shop` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes |  |
| `domain` | `string` | Yes |  |
| `name` | `string` | Yes |  |
| `logoUrl` | `string` | Yes |  |
| `faviconUrl` | `string` | Yes |  |
| `countryCode` | `string` | Yes |  |
| `monthlyVisits` | `number` | Yes |  |
| `trafficGrowth30d` | `number` | Yes |  |
| `productsCount` | `number` | Yes |  |
| `googleCategoryIds` | `number`[] | Yes |  |

**`pin` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `isCurrent` | `boolean` | Yes |  |
| `firstPinnedAt` | `string` | Yes |  |
| `lastPinnedAt` | `string` | Yes |  |
| `lastUnpinnedAt` | `string` | Yes |  |

**`pageSnapshot` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `recordedAt` | `string` | Yes |  |
| `adsCount` | `number` | Yes |  |
| `organicCount` | `number` | Yes |  |
| `totalTikToks` | `number` | Yes |  |
| `dailyViews` | `number` | Yes |  |
| `dailyLikes` | `number` | Yes |  |
| `dailyFollowers` | `number` | Yes |  |

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

# Query TikTok library items

`POST /v1/tiktok/library/query`

Advanced TikTok library query over ES-backed fields only. It intentionally does not use the internal Next /api/tiktok-ads route or per-request Postgres hydration.

**Tags:** TikTok

## Request Body

**Content-Type:** `application/json`

**Find active TikTok ads by caption text:**

```json
{
  "search": [
    "protein gummies"
  ],
  "searchArea": "caption",
  "type": "ad",
  "status": "active",
  "minViews": 10000,
  "sortBy": "views",
  "order": "desc",
  "limit": 10
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `search` | `string`[] | No |  |
| `keywordMode` | `any` \| `all` | No |  |
| `searchArea` | `all` \| `caption` \| `profile` \| `hashtag` \| `music` | No |  |
| `type` | `all` \| `ad` \| `organic` | No |  |
| `status` | `all` \| `active` \| `inactive` | No |  |
| `mediaTypes` | `image` \| `video` \| `carousel`[] | No |  |
| `languages` | `string`[] | No | ISO 639-1 codes (en, fr) or English language names (English, french), case-insensitive. |
| `countries` | `string`[] | No |  |
| `categories` | `string`[] | No | TikTok content categories, case-insensitive. |
| `hashtags` | `string`[] | No |  |
| `tiktokPageIds` | `string`[] | No |  |
| `tiktokPageId` | `string` | No |  |
| `websiteId` | `string` | No |  |
| `domain` | `string` | No |  |
| `handle` | `string` | No |  |
| `hasShopLinked` | `yes` \| `no` | No |  |
| `publishedAfter` | `string` | No |  |
| `publishedBefore` | `string` | No |  |
| `updatedAfter` | `string` | No |  |
| `updatedBefore` | `string` | No |  |
| `minDaysRunning` | `number` | No |  |
| `maxDaysRunning` | `number` | No |  |
| `minViews` | `number` | No |  |
| `maxViews` | `number` | No |  |
| `minLikes` | `number` | No |  |
| `minShares` | `number` | No |  |
| `minEngagementRate` | `number` | No |  |
| `maxEngagementRate` | `number` | No |  |
| `minFollowers` | `number` | No |  |
| `minProfileViews` | `number` | No |  |
| `isPinned` | `boolean` | No |  |
| `sortBy` | `relevance` \| `newest` \| `updatedAt` \| `views` \| `likes` \| `comments` \| `shares` \| `saves` \| `engagementRate` \| `daysRunning` \| `followers` | No |  |
| `order` | `asc` \| `desc` | No |  |
| `page` | `object` | No |  |
| `limit` | `object` | No |  |

## Responses

### 200 - Paginated TikTok library query response. One returned TikTok item is one billable ads credit.

**Content-Type:** `application/json`

```json
{
  "requestId": "req_123",
  "data": [
    {
      "id": "tiktok_7078586231734521093",
      "tiktokId": "string",
      "type": "ad",
      "status": "active",
      "isPinned": true,
      "publishedAt": "string",
      "createdAt": "string",
      "updatedAt": "string",
      "daysRunning": 0,
      "media": {
        "type": "video",
        "thumbnailUrl": "string",
        "mediaUrl": "string",
        "videoUrl": "string",
        "imageUrls": [
          "string"
        ],
        "medias": [
          {
            "type": "video",
            "url": "string",
            "order": 0
          }
        ],
        "durationSec": 0,
        "mediaCount": 0,
        "imageCount": 0
      },
      "content": {
        "description": "string",
        "language": "string",
        "category": "string",
        "hashtags": [
          "string"
        ],
        "music": {
          "id": "string",
          "title": "string",
          "author": "string"
        }
      },
      "metrics": {
        "views": 0,
        "likes": 0,
        "comments": 0,
        "saves": 0,
        "shares": 0,
        "reposts": 0,
        "engagementRate": 0,
        "rank": 0,
        "rankPercent": 0,
        "relevanceScore": 0,
        "deltaRank3d": 0,
        "deltaRank7d": 0,
        "deltaRank14d": 0,
        "deltaRank30d": 0
      },
      "profile": {
        "id": "string",
        "handle": "string",
        "name": "string",
        "avatarUrl": "string",
        "bio": "string",
        "bioUrl": "string",
        "accountType": "string",
        "secUid": "string",
        "followers": 0,
        "following": 0,
        "totalTikToks": 0,
        "newTikToks": 0,
        "percentAds": 0,
        "views": 0,
        "likes": 0,
        "pageCreation": "string"
      },
      "shop": {
        "id": "string",
        "domain": "string",
        "name": "string",
        "logoUrl": "string",
        "faviconUrl": "string",
        "countryCode": "string",
        "monthlyVisits": 0,
        "trafficGrowth30d": 0,
        "productsCount": 0,
        "googleCategoryIds": [
          0
        ]
      },
      "pin": {
        "isCurrent": true,
        "firstPinnedAt": "string",
        "lastPinnedAt": "string",
        "lastUnpinnedAt": "string"
      },
      "pageSnapshot": {
        "recordedAt": "string",
        "adsCount": 0,
        "organicCount": 0,
        "totalTikToks": 0,
        "dailyViews": 0,
        "dailyLikes": 0,
        "dailyFollowers": 0
      },
      "indexedAt": "string"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 250,
    "totalPages": 10
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
| `id` | `string` | Yes |  |
| `tiktokId` | `string` | Yes |  |
| `type` | `ad` \| `organic` | Yes |  |
| `status` | `active` \| `inactive` \| `unknown` | Yes |  |
| `isPinned` | `boolean` | Yes |  |
| `publishedAt` | `string` | Yes |  |
| `createdAt` | `string` | Yes |  |
| `updatedAt` | `string` | Yes |  |
| `daysRunning` | `number` | Yes |  |
| `media` | `object` | Yes |  |
| `content` | `object` | Yes |  |
| `metrics` | `object` | Yes |  |
| `profile` | `object` | Yes |  |
| `shop` | `object` | Yes |  |
| `pin` | `object` | Yes |  |
| `pageSnapshot` | `object` | Yes |  |
| `indexedAt` | `string` | Yes |  |

**`media` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `image` \| `video` \| `carousel` \| `unknown` | Yes |  |
| `thumbnailUrl` | `string` | Yes |  |
| `mediaUrl` | `string` | Yes |  |
| `videoUrl` | `string` | Yes |  |
| `imageUrls` | `string`[] | Yes |  |
| `medias` | `object`[] | Yes |  |
| `durationSec` | `number` | Yes |  |
| `mediaCount` | `number` | Yes |  |
| `imageCount` | `number` | Yes |  |

**`medias[]` item properties:**


**`content` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `description` | `string` | Yes |  |
| `language` | `string` | Yes |  |
| `category` | `string` | Yes |  |
| `hashtags` | `string`[] | Yes |  |
| `music` | `object` | Yes |  |

**`music` properties:**


**`metrics` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `views` | `number` | Yes |  |
| `likes` | `number` | Yes |  |
| `comments` | `number` | Yes |  |
| `saves` | `number` | Yes |  |
| `shares` | `number` | Yes |  |
| `reposts` | `number` | Yes |  |
| `engagementRate` | `number` | Yes | Percentage, not fraction. |
| `rank` | `number` | Yes |  |
| `rankPercent` | `number` | Yes |  |
| `relevanceScore` | `number` | Yes |  |
| `deltaRank3d` | `number` | Yes |  |
| `deltaRank7d` | `number` | Yes |  |
| `deltaRank14d` | `number` | Yes |  |
| `deltaRank30d` | `number` | Yes |  |

**`profile` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes |  |
| `handle` | `string` | Yes |  |
| `name` | `string` | Yes |  |
| `avatarUrl` | `string` | Yes |  |
| `bio` | `string` | Yes |  |
| `bioUrl` | `string` | Yes |  |
| `accountType` | `string` | Yes |  |
| `secUid` | `string` | Yes |  |
| `followers` | `number` | Yes |  |
| `following` | `number` | Yes |  |
| `totalTikToks` | `number` | Yes |  |
| `newTikToks` | `number` | Yes |  |
| `percentAds` | `number` | Yes |  |
| `views` | `number` | Yes |  |
| `likes` | `number` | Yes |  |
| `pageCreation` | `string` | Yes |  |

**`shop` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes |  |
| `domain` | `string` | Yes |  |
| `name` | `string` | Yes |  |
| `logoUrl` | `string` | Yes |  |
| `faviconUrl` | `string` | Yes |  |
| `countryCode` | `string` | Yes |  |
| `monthlyVisits` | `number` | Yes |  |
| `trafficGrowth30d` | `number` | Yes |  |
| `productsCount` | `number` | Yes |  |
| `googleCategoryIds` | `number`[] | Yes |  |

**`pin` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `isCurrent` | `boolean` | Yes |  |
| `firstPinnedAt` | `string` | Yes |  |
| `lastPinnedAt` | `string` | Yes |  |
| `lastUnpinnedAt` | `string` | Yes |  |

**`pageSnapshot` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `recordedAt` | `string` | Yes |  |
| `adsCount` | `number` | Yes |  |
| `organicCount` | `number` | Yes |  |
| `totalTikToks` | `number` | Yes |  |
| `dailyViews` | `number` | Yes |  |
| `dailyLikes` | `number` | Yes |  |
| `dailyFollowers` | `number` | Yes |  |

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

# Get a TikTok library item

`GET /v1/tiktok/library/{itemId}`

Returns one TikTok library item detail by composite_ad_id, with tiktok_id fallback because tiktok_id is part of the tiktoks-search public ES contract.

**Tags:** TikTok

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `itemId` | path | Yes | `string` |  |

## Responses

### 200 - TikTok library detail response. One found TikTok item is one billable ads credit.

**Content-Type:** `application/json`

```json
{
  "requestId": "req_123",
  "data": {
    "id": "tiktok_7078586231734521093",
    "tiktokId": "string",
    "type": "ad",
    "status": "active",
    "isPinned": true,
    "publishedAt": "string",
    "createdAt": "string",
    "updatedAt": "string",
    "daysRunning": 0,
    "media": {
      "type": "video",
      "thumbnailUrl": "string",
      "mediaUrl": "string",
      "videoUrl": "string",
      "imageUrls": [
        "string"
      ],
      "medias": [
        {
          "type": "video",
          "url": "string",
          "order": 0
        }
      ],
      "durationSec": 0,
      "mediaCount": 0,
      "imageCount": 0
    },
    "content": {
      "description": "string",
      "language": "string",
      "category": "string",
      "hashtags": [
        "string"
      ],
      "music": {
        "id": "string",
        "title": "string",
        "author": "string"
      }
    },
    "metrics": {
      "views": 0,
      "likes": 0,
      "comments": 0,
      "saves": 0,
      "shares": 0,
      "reposts": 0,
      "engagementRate": 0,
      "rank": 0,
      "rankPercent": 0,
      "relevanceScore": 0,
      "deltaRank3d": 0,
      "deltaRank7d": 0,
      "deltaRank14d": 0,
      "deltaRank30d": 0
    },
    "profile": {
      "id": "string",
      "handle": "string",
      "name": "string",
      "avatarUrl": "string",
      "bio": "string",
      "bioUrl": "string",
      "accountType": "string",
      "secUid": "string",
      "followers": 0,
      "following": 0,
      "totalTikToks": 0,
      "newTikToks": 0,
      "percentAds": 0,
      "views": 0,
      "likes": 0,
      "pageCreation": "string"
    },
    "shop": {
      "id": "string",
      "domain": "string",
      "name": "string",
      "logoUrl": "string",
      "faviconUrl": "string",
      "countryCode": "string",
      "monthlyVisits": 0,
      "trafficGrowth30d": 0,
      "productsCount": 0,
      "googleCategoryIds": [
        0
      ]
    },
    "pin": {
      "isCurrent": true,
      "firstPinnedAt": "string",
      "lastPinnedAt": "string",
      "lastUnpinnedAt": "string"
    },
    "pageSnapshot": {
      "recordedAt": "string",
      "adsCount": 0,
      "organicCount": 0,
      "totalTikToks": 0,
      "dailyViews": 0,
      "dailyLikes": 0,
      "dailyFollowers": 0
    },
    "indexedAt": "string",
    "links": {
      "tiktokUrl": "string",
      "profileUrl": "string"
    },
    "source": {
      "network": "string",
      "sourceType": "string",
      "tiktokPageId": "string",
      "websiteId": "string",
      "domain": "string"
    }
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
| `id` | `string` | Yes |  |
| `tiktokId` | `string` | Yes |  |
| `type` | `ad` \| `organic` | Yes |  |
| `status` | `active` \| `inactive` \| `unknown` | Yes |  |
| `isPinned` | `boolean` | Yes |  |
| `publishedAt` | `string` | Yes |  |
| `createdAt` | `string` | Yes |  |
| `updatedAt` | `string` | Yes |  |
| `daysRunning` | `number` | Yes |  |
| `media` | `object` | Yes |  |
| `content` | `object` | Yes |  |
| `metrics` | `object` | Yes |  |
| `profile` | `object` | Yes |  |
| `shop` | `object` | Yes |  |
| `pin` | `object` | Yes |  |
| `pageSnapshot` | `object` | Yes |  |
| `indexedAt` | `string` | Yes |  |
| `links` | `object` | Yes |  |
| `source` | `object` | Yes |  |

**`media` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `image` \| `video` \| `carousel` \| `unknown` | Yes |  |
| `thumbnailUrl` | `string` | Yes |  |
| `mediaUrl` | `string` | Yes |  |
| `videoUrl` | `string` | Yes |  |
| `imageUrls` | `string`[] | Yes |  |
| `medias` | `object`[] | Yes |  |
| `durationSec` | `number` | Yes |  |
| `mediaCount` | `number` | Yes |  |
| `imageCount` | `number` | Yes |  |

**`medias[]` item properties:**


**`content` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `description` | `string` | Yes |  |
| `language` | `string` | Yes |  |
| `category` | `string` | Yes |  |
| `hashtags` | `string`[] | Yes |  |
| `music` | `object` | Yes |  |

**`music` properties:**


**`metrics` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `views` | `number` | Yes |  |
| `likes` | `number` | Yes |  |
| `comments` | `number` | Yes |  |
| `saves` | `number` | Yes |  |
| `shares` | `number` | Yes |  |
| `reposts` | `number` | Yes |  |
| `engagementRate` | `number` | Yes | Percentage, not fraction. |
| `rank` | `number` | Yes |  |
| `rankPercent` | `number` | Yes |  |
| `relevanceScore` | `number` | Yes |  |
| `deltaRank3d` | `number` | Yes |  |
| `deltaRank7d` | `number` | Yes |  |
| `deltaRank14d` | `number` | Yes |  |
| `deltaRank30d` | `number` | Yes |  |

**`profile` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes |  |
| `handle` | `string` | Yes |  |
| `name` | `string` | Yes |  |
| `avatarUrl` | `string` | Yes |  |
| `bio` | `string` | Yes |  |
| `bioUrl` | `string` | Yes |  |
| `accountType` | `string` | Yes |  |
| `secUid` | `string` | Yes |  |
| `followers` | `number` | Yes |  |
| `following` | `number` | Yes |  |
| `totalTikToks` | `number` | Yes |  |
| `newTikToks` | `number` | Yes |  |
| `percentAds` | `number` | Yes |  |
| `views` | `number` | Yes |  |
| `likes` | `number` | Yes |  |
| `pageCreation` | `string` | Yes |  |

**`shop` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes |  |
| `domain` | `string` | Yes |  |
| `name` | `string` | Yes |  |
| `logoUrl` | `string` | Yes |  |
| `faviconUrl` | `string` | Yes |  |
| `countryCode` | `string` | Yes |  |
| `monthlyVisits` | `number` | Yes |  |
| `trafficGrowth30d` | `number` | Yes |  |
| `productsCount` | `number` | Yes |  |
| `googleCategoryIds` | `number`[] | Yes |  |

**`pin` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `isCurrent` | `boolean` | Yes |  |
| `firstPinnedAt` | `string` | Yes |  |
| `lastPinnedAt` | `string` | Yes |  |
| `lastUnpinnedAt` | `string` | Yes |  |

**`pageSnapshot` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `recordedAt` | `string` | Yes |  |
| `adsCount` | `number` | Yes |  |
| `organicCount` | `number` | Yes |  |
| `totalTikToks` | `number` | Yes |  |
| `dailyViews` | `number` | Yes |  |
| `dailyLikes` | `number` | Yes |  |
| `dailyFollowers` | `number` | Yes |  |

**`links` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `tiktokUrl` | `string` | Yes |  |
| `profileUrl` | `string` | Yes |  |

**`source` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `network` | `string` | Yes |  |
| `sourceType` | `string` | Yes |  |
| `tiktokPageId` | `string` | Yes |  |
| `websiteId` | `string` | Yes |  |
| `domain` | `string` | Yes |  |

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

### 404 - No TikTok library item matches the requested id.

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

# List TikTok library items for a shop

`GET /v1/shops/{shopId}/tiktok/library`

Returns TikTok library items linked to one public shop id using exact ES shop identifiers. This route has a TikTok endpoint key and ads entitlement even though it is nested under /v1/shops.

**Tags:** TikTok

## Parameters

**Query parameter groups:**

- Pagination: `page`, `limit`
- Search: `search`, `searchArea`
- Sorting: `sortBy`, `order`
- Filters: `type`, `status`, `mediaTypes`, `languages`, `countries`, `hashtags`, `tiktokPageId`, `domain`, `handle`, `publishedAfter`, `publishedBefore`, `minViews`, `maxViews`, `minEngagementRate`, `maxEngagementRate`

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `shopId` | path | Yes | `string` | Stable public shop identifier. |
| `search` | query | No | `string` |  |
| `searchArea` | query | No | `all` \| `caption` \| `profile` \| `hashtag` \| `music` |  |
| `type` | query | No | `all` \| `ad` \| `organic` |  |
| `status` | query | No | `all` \| `active` \| `inactive` |  |
| `mediaTypes` | query | No | `image` \| `video` \| `carousel`[] |  |
| `languages` | query | No | `string`[] | ISO 639-1 codes (en, fr) or English language names (English, french), case-insensitive. |
| `countries` | query | No | `string`[] |  |
| `hashtags` | query | No | `string`[] | Hashtags with or without #, case-insensitive. |
| `tiktokPageId` | query | No | `string` |  |
| `domain` | query | No | `string` |  |
| `handle` | query | No | `string` |  |
| `publishedAfter` | query | No | `string` |  |
| `publishedBefore` | query | No | `string` |  |
| `minViews` | query | No | `number` |  |
| `maxViews` | query | No | `number` |  |
| `minEngagementRate` | query | No | `number` |  |
| `maxEngagementRate` | query | No | `number` |  |
| `sortBy` | query | No | `relevance` \| `newest` \| `updatedAt` \| `views` \| `likes` \| `comments` \| `shares` \| `saves` \| `engagementRate` \| `daysRunning` \| `followers` |  |
| `order` | query | No | `asc` \| `desc` |  |
| `page` | query | No | `object` |  |
| `limit` | query | No | `object` |  |

## Responses

### 200 - Paginated shop-scoped TikTok library response. One returned TikTok item is one billable ads credit.

**Content-Type:** `application/json`

```json
{
  "requestId": "req_123",
  "data": [
    {
      "id": "tiktok_7078586231734521093",
      "tiktokId": "string",
      "type": "ad",
      "status": "active",
      "isPinned": true,
      "publishedAt": "string",
      "createdAt": "string",
      "updatedAt": "string",
      "daysRunning": 0,
      "media": {
        "type": "video",
        "thumbnailUrl": "string",
        "mediaUrl": "string",
        "videoUrl": "string",
        "imageUrls": [
          "string"
        ],
        "medias": [
          {
            "type": "video",
            "url": "string",
            "order": 0
          }
        ],
        "durationSec": 0,
        "mediaCount": 0,
        "imageCount": 0
      },
      "content": {
        "description": "string",
        "language": "string",
        "category": "string",
        "hashtags": [
          "string"
        ],
        "music": {
          "id": "string",
          "title": "string",
          "author": "string"
        }
      },
      "metrics": {
        "views": 0,
        "likes": 0,
        "comments": 0,
        "saves": 0,
        "shares": 0,
        "reposts": 0,
        "engagementRate": 0,
        "rank": 0,
        "rankPercent": 0,
        "relevanceScore": 0,
        "deltaRank3d": 0,
        "deltaRank7d": 0,
        "deltaRank14d": 0,
        "deltaRank30d": 0
      },
      "profile": {
        "id": "string",
        "handle": "string",
        "name": "string",
        "avatarUrl": "string",
        "bio": "string",
        "bioUrl": "string",
        "accountType": "string",
        "secUid": "string",
        "followers": 0,
        "following": 0,
        "totalTikToks": 0,
        "newTikToks": 0,
        "percentAds": 0,
        "views": 0,
        "likes": 0,
        "pageCreation": "string"
      },
      "shop": {
        "id": "string",
        "domain": "string",
        "name": "string",
        "logoUrl": "string",
        "faviconUrl": "string",
        "countryCode": "string",
        "monthlyVisits": 0,
        "trafficGrowth30d": 0,
        "productsCount": 0,
        "googleCategoryIds": [
          0
        ]
      },
      "pin": {
        "isCurrent": true,
        "firstPinnedAt": "string",
        "lastPinnedAt": "string",
        "lastUnpinnedAt": "string"
      },
      "pageSnapshot": {
        "recordedAt": "string",
        "adsCount": 0,
        "organicCount": 0,
        "totalTikToks": 0,
        "dailyViews": 0,
        "dailyLikes": 0,
        "dailyFollowers": 0
      },
      "indexedAt": "string"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 250,
    "totalPages": 10
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
| `id` | `string` | Yes |  |
| `tiktokId` | `string` | Yes |  |
| `type` | `ad` \| `organic` | Yes |  |
| `status` | `active` \| `inactive` \| `unknown` | Yes |  |
| `isPinned` | `boolean` | Yes |  |
| `publishedAt` | `string` | Yes |  |
| `createdAt` | `string` | Yes |  |
| `updatedAt` | `string` | Yes |  |
| `daysRunning` | `number` | Yes |  |
| `media` | `object` | Yes |  |
| `content` | `object` | Yes |  |
| `metrics` | `object` | Yes |  |
| `profile` | `object` | Yes |  |
| `shop` | `object` | Yes |  |
| `pin` | `object` | Yes |  |
| `pageSnapshot` | `object` | Yes |  |
| `indexedAt` | `string` | Yes |  |

**`media` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `image` \| `video` \| `carousel` \| `unknown` | Yes |  |
| `thumbnailUrl` | `string` | Yes |  |
| `mediaUrl` | `string` | Yes |  |
| `videoUrl` | `string` | Yes |  |
| `imageUrls` | `string`[] | Yes |  |
| `medias` | `object`[] | Yes |  |
| `durationSec` | `number` | Yes |  |
| `mediaCount` | `number` | Yes |  |
| `imageCount` | `number` | Yes |  |

**`medias[]` item properties:**


**`content` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `description` | `string` | Yes |  |
| `language` | `string` | Yes |  |
| `category` | `string` | Yes |  |
| `hashtags` | `string`[] | Yes |  |
| `music` | `object` | Yes |  |

**`music` properties:**


**`metrics` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `views` | `number` | Yes |  |
| `likes` | `number` | Yes |  |
| `comments` | `number` | Yes |  |
| `saves` | `number` | Yes |  |
| `shares` | `number` | Yes |  |
| `reposts` | `number` | Yes |  |
| `engagementRate` | `number` | Yes | Percentage, not fraction. |
| `rank` | `number` | Yes |  |
| `rankPercent` | `number` | Yes |  |
| `relevanceScore` | `number` | Yes |  |
| `deltaRank3d` | `number` | Yes |  |
| `deltaRank7d` | `number` | Yes |  |
| `deltaRank14d` | `number` | Yes |  |
| `deltaRank30d` | `number` | Yes |  |

**`profile` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes |  |
| `handle` | `string` | Yes |  |
| `name` | `string` | Yes |  |
| `avatarUrl` | `string` | Yes |  |
| `bio` | `string` | Yes |  |
| `bioUrl` | `string` | Yes |  |
| `accountType` | `string` | Yes |  |
| `secUid` | `string` | Yes |  |
| `followers` | `number` | Yes |  |
| `following` | `number` | Yes |  |
| `totalTikToks` | `number` | Yes |  |
| `newTikToks` | `number` | Yes |  |
| `percentAds` | `number` | Yes |  |
| `views` | `number` | Yes |  |
| `likes` | `number` | Yes |  |
| `pageCreation` | `string` | Yes |  |

**`shop` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes |  |
| `domain` | `string` | Yes |  |
| `name` | `string` | Yes |  |
| `logoUrl` | `string` | Yes |  |
| `faviconUrl` | `string` | Yes |  |
| `countryCode` | `string` | Yes |  |
| `monthlyVisits` | `number` | Yes |  |
| `trafficGrowth30d` | `number` | Yes |  |
| `productsCount` | `number` | Yes |  |
| `googleCategoryIds` | `number`[] | Yes |  |

**`pin` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `isCurrent` | `boolean` | Yes |  |
| `firstPinnedAt` | `string` | Yes |  |
| `lastPinnedAt` | `string` | Yes |  |
| `lastUnpinnedAt` | `string` | Yes |  |

**`pageSnapshot` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `recordedAt` | `string` | Yes |  |
| `adsCount` | `number` | Yes |  |
| `organicCount` | `number` | Yes |  |
| `totalTikToks` | `number` | Yes |  |
| `dailyViews` | `number` | Yes |  |
| `dailyLikes` | `number` | Yes |  |
| `dailyFollowers` | `number` | Yes |  |

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
