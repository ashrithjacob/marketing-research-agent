# Favorites

---

# Add a favorite ad

`POST /v1/favorites/ads`

Saves an ad to the requested workspace or delegated-user favorites scope. Existing favorites are returned idempotently without creating an audit mutation event. Deprecated: favorites are now V3 boards; use /v1/boards. This endpoint is a compatibility facade over boards: folder ids are board ids (migrated V2 folder UUIDs are still accepted), saved favorite ids are board item ids, and favorites without a folder live in the scope's "Unsorted" board.

**Tags:** Favorites

## Request Body

**Content-Type:** `application/json`

```json
{
  "scope": "workspace",
  "adId": "facebook_1234567890",
  "folderId": "board_8b7c6d5e-4f3a-4b2c-9d1e-0f1a2b3c4d5e"
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `scope` | `workspace` \| `personal` | Yes |  |
| `adId` | `string` | Yes | Composite public ad identifier, for example facebook_123 or tiktok_123. |
| `folderId` | `object` | No | Favorite ads folder id (board id, or migrated V2 folder UUID). Null or omitted saves the ad in the scope's "Unsorted" board. |

## Responses

### 200 - Favorite ad mutation response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": {
    "id": "board_item_3f1c2b7e-8d4a-4f0e-9b1a-2c3d4e5f6a7b",
    "scope": "workspace",
    "savedAt": "2026-04-20T10:00:00.000Z",
    "folder": {
      "id": "board_8b7c6d5e-4f3a-4b2c-9d1e-0f1a2b3c4d5e",
      "name": "Winning Creatives",
      "parentId": "board_1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d"
    },
    "ad": {
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
  },
  "created": true
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `requestId` | `string` | Yes |  |
| `data` | `object` | Yes |  |
| `created` | `boolean` | Yes | True when this call created a favorite; false when the favorite already existed. |

**`data` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes | Saved favorite id: the board item id. |
| `scope` | `workspace` \| `personal` | Yes |  |
| `savedAt` | `string` | Yes |  |
| `folder` | `object` | Yes |  |
| `ad` | `object` | Yes | Embedded public ad summary when the backing favorite can be resolved to a public-supported ad platform. |

**`folder` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes | Folder id: the id of the board backing the folder. |
| `name` | `string` | Yes |  |
| `parentId` | `string` | Yes | Parent folder (board) id when the folder is nested. Null for root folders. |

**`ad` properties:**


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

# List favorite ads

`GET /v1/favorites/ads`

Deprecated: favorites are now V3 boards; use /v1/boards. This endpoint is a compatibility facade over boards: folder ids are board ids (migrated V2 folder UUIDs are still accepted), saved favorite ids are board item ids, and favorites without a folder live in the scope's "Unsorted" board.

**Tags:** Favorites

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `scope` | query | Yes | `workspace` \| `personal` | Favorites scope. Use personal only with a delegated_user credential. full_access credentials receive 403 for personal scope. |
| `page` | query | No | `integer` |  |
| `limit` | query | No | `integer` |  |
| `folderId` | query | No | `string` | Optional ads folder identifier. This is the folder id (board id, or migrated V2 folder UUID). When provided, only favorites saved in that folder are returned. |

## Responses

### 200 - Paginated favorite ads response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": [
    {
      "id": "board_item_3f1c2b7e-8d4a-4f0e-9b1a-2c3d4e5f6a7b",
      "scope": "workspace",
      "savedAt": "2026-04-20T10:00:00.000Z",
      "folder": {
        "id": "board_8b7c6d5e-4f3a-4b2c-9d1e-0f1a2b3c4d5e",
        "name": "Winning Creatives",
        "parentId": "board_1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d"
      },
      "ad": {
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
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 130,
    "totalPages": 6
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
| `id` | `string` | Yes | Saved favorite id: the board item id. |
| `scope` | `workspace` \| `personal` | Yes |  |
| `savedAt` | `string` | Yes |  |
| `folder` | `object` | Yes |  |
| `ad` | `object` | Yes | Embedded public ad summary when the backing favorite can be resolved to a public-supported ad platform. |

**`folder` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes | Folder id: the id of the board backing the folder. |
| `name` | `string` | Yes |  |
| `parentId` | `string` | Yes | Parent folder (board) id when the folder is nested. Null for root folders. |

**`ad` properties:**


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

# Move a saved favorite ad

`PATCH /v1/favorites/ads/saved/{favoriteId}/folder`

Deprecated: favorites are now V3 boards; use /v1/boards. This endpoint is a compatibility facade over boards: folder ids are board ids (migrated V2 folder UUIDs are still accepted), saved favorite ids are board item ids, and favorites without a folder live in the scope's "Unsorted" board.

**Tags:** Favorites

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `favoriteId` | path | Yes | `string` | Saved favorite id, which is the board item id. |
| `scope` | query | Yes | `workspace` \| `personal` | Favorites scope. Use personal only with a delegated_user credential. full_access credentials receive 403 for personal scope. |

## Request Body

**Content-Type:** `application/json`

```json
{
  "folderId": "board_8b7c6d5e-4f3a-4b2c-9d1e-0f1a2b3c4d5e"
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `folderId` | `object` | No | Favorite ads folder id (board id, or migrated V2 folder UUID). Null moves the saved ad to the scope's "Unsorted" board. |

## Responses

### 200 - Saved favorite ad move response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": {
    "id": "board_item_3f1c2b7e-8d4a-4f0e-9b1a-2c3d4e5f6a7b",
    "scope": "workspace",
    "savedAt": "2026-04-20T10:00:00.000Z",
    "folder": {
      "id": "board_8b7c6d5e-4f3a-4b2c-9d1e-0f1a2b3c4d5e",
      "name": "Winning Creatives",
      "parentId": "board_1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d"
    },
    "ad": {
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
| `id` | `string` | Yes | Saved favorite id: the board item id. |
| `scope` | `workspace` \| `personal` | Yes |  |
| `savedAt` | `string` | Yes |  |
| `folder` | `object` | Yes |  |
| `ad` | `object` | Yes | Embedded public ad summary when the backing favorite can be resolved to a public-supported ad platform. |

**`folder` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes | Folder id: the id of the board backing the folder. |
| `name` | `string` | Yes |  |
| `parentId` | `string` | Yes | Parent folder (board) id when the folder is nested. Null for root folders. |

**`ad` properties:**


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

# Delete a saved favorite ad

`DELETE /v1/favorites/ads/saved/{favoriteId}`

Deprecated: favorites are now V3 boards; use /v1/boards. This endpoint is a compatibility facade over boards: folder ids are board ids (migrated V2 folder UUIDs are still accepted), saved favorite ids are board item ids, and favorites without a folder live in the scope's "Unsorted" board.

**Tags:** Favorites

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `favoriteId` | path | Yes | `string` | Saved favorite id, which is the board item id. |
| `scope` | query | Yes | `workspace` \| `personal` | Favorites scope. Use personal only with a delegated_user credential. full_access credentials receive 403 for personal scope. |

## Responses

### 200 - Saved favorite ad removal response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": {
    "removed": true,
    "adId": "facebook_1234567890",
    "scope": "workspace",
    "folderId": "board_8b7c6d5e-4f3a-4b2c-9d1e-0f1a2b3c4d5e"
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
| `removed` | `boolean` | Yes |  |
| `adId` | `string` | Yes |  |
| `scope` | `workspace` \| `personal` | Yes |  |
| `folderId` | `string` | Yes |  |

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

# Remove a favorite ad

`DELETE /v1/favorites/ads/{adId}`

Deprecated: favorites are now V3 boards; use /v1/boards. This endpoint is a compatibility facade over boards: folder ids are board ids (migrated V2 folder UUIDs are still accepted), saved favorite ids are board item ids, and favorites without a folder live in the scope's "Unsorted" board.

**Tags:** Favorites

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `adId` | path | Yes | `string` | Composite public ad identifier, for example facebook_123 or tiktok_123. |
| `scope` | query | Yes | `workspace` \| `personal` | Favorites scope. Use personal only with a delegated_user credential. full_access credentials receive 403 for personal scope. |
| `folderId` | query | No | `string` | Favorite ads folder id (board id, or migrated V2 folder UUID). Omit to remove from the scope's "Unsorted" board. |

## Responses

### 200 - Favorite ad removal response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": {
    "removed": true,
    "adId": "facebook_1234567890",
    "scope": "workspace",
    "folderId": "board_8b7c6d5e-4f3a-4b2c-9d1e-0f1a2b3c4d5e"
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
| `removed` | `boolean` | Yes |  |
| `adId` | `string` | Yes |  |
| `scope` | `workspace` \| `personal` | Yes |  |
| `folderId` | `string` | Yes |  |

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

# Create a favorite ad folder

`POST /v1/favorites/ads/folders`

Deprecated: favorites are now V3 boards; use /v1/boards. This endpoint is a compatibility facade over boards: folder ids are board ids (migrated V2 folder UUIDs are still accepted), saved favorite ids are board item ids, and favorites without a folder live in the scope's "Unsorted" board.

**Tags:** Favorites

## Request Body

**Content-Type:** `application/json`

```json
{
  "scope": "workspace",
  "name": "Winning Creatives",
  "parentId": "f2c0dc30-95bf-4455-bb43-48d5f6e08f30"
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `scope` | `workspace` \| `personal` | Yes |  |
| `name` | `string` | Yes |  |
| `parentId` | `object` | No | Parent folder id (board id, or migrated V2 folder UUID). Null or omitted creates a root folder. |

## Responses

### 200 - Favorite ad folder mutation response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": {
    "id": "board_8b7c6d5e-4f3a-4b2c-9d1e-0f1a2b3c4d5e",
    "name": "Winning Creatives",
    "parentId": "board_1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d"
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
| `id` | `string` | Yes | Folder id: the id of the board backing the folder. |
| `name` | `string` | Yes |  |
| `parentId` | `string` | Yes | Parent folder (board) id when the folder is nested. Null for root folders. |

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

# List favorite ad folders

`GET /v1/favorites/ads/folders`

Deprecated: favorites are now V3 boards; use /v1/boards. This endpoint is a compatibility facade over boards: folder ids are board ids (migrated V2 folder UUIDs are still accepted), saved favorite ids are board item ids, and favorites without a folder live in the scope's "Unsorted" board.

**Tags:** Favorites

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `scope` | query | Yes | `workspace` \| `personal` | Favorites scope. Use personal only with a delegated_user credential. full_access credentials receive 403 for personal scope. |
| `page` | query | No | `integer` |  |
| `limit` | query | No | `integer` |  |
| `parentId` | query | No | `string` | Optional parent folder id (board id, or migrated V2 folder UUID). When provided, only direct children of that folder are returned. |
| `rootOnly` | query | No | `boolean` | When true, returns only root folders. Cannot be combined with parentId. |

## Responses

### 200 - Paginated favorite ad folders response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": [
    {
      "id": "board_8b7c6d5e-4f3a-4b2c-9d1e-0f1a2b3c4d5e",
      "name": "Winning Creatives",
      "parentId": "board_1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 130,
    "totalPages": 6
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
| `id` | `string` | Yes | Folder id: the id of the board backing the folder. |
| `name` | `string` | Yes |  |
| `parentId` | `string` | Yes | Parent folder (board) id when the folder is nested. Null for root folders. |

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

# Reorder favorite ad folders

`PATCH /v1/favorites/ads/folders/reorder`

Boards have no manual order: the folders are validated and echoed back in the requested order, but no order is persisted. Deprecated: favorites are now V3 boards; use /v1/boards. This endpoint is a compatibility facade over boards: folder ids are board ids (migrated V2 folder UUIDs are still accepted), saved favorite ids are board item ids, and favorites without a folder live in the scope's "Unsorted" board.

**Tags:** Favorites

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `scope` | query | Yes | `workspace` \| `personal` | Favorites scope. Use personal only with a delegated_user credential. full_access credentials receive 403 for personal scope. |

## Request Body

**Content-Type:** `application/json`

```json
{
  "folders": [
    {
      "id": "board_8b7c6d5e-4f3a-4b2c-9d1e-0f1a2b3c4d5e",
      "order": 1
    }
  ]
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `folders` | `object`[] | Yes | Folder UUID/order pairs to update in the requested scope. |

**`folders[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes | Favorite ads folder id (board id, or migrated V2 folder UUID). |
| `order` | `number` | Yes |  |

## Responses

### 200 - Favorite ad folders reorder response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": {
    "reordered": true,
    "scope": "workspace",
    "folders": [
      {
        "id": "board_8b7c6d5e-4f3a-4b2c-9d1e-0f1a2b3c4d5e",
        "name": "Winning Creatives",
        "parentId": "board_1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d"
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
| `reordered` | `boolean` | Yes |  |
| `scope` | `workspace` \| `personal` | Yes |  |
| `folders` | `object`[] | Yes |  |

**`folders[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes | Folder id: the id of the board backing the folder. |
| `name` | `string` | Yes |  |
| `parentId` | `string` | Yes | Parent folder (board) id when the folder is nested. Null for root folders. |

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

# Create a favorite ad folder share URL

`POST /v1/favorites/ads/folders/{folderId}/share`

Each call creates a new board share link. Deprecated: favorites are now V3 boards; use /v1/boards. This endpoint is a compatibility facade over boards: folder ids are board ids (migrated V2 folder UUIDs are still accepted), saved favorite ids are board item ids, and favorites without a folder live in the scope's "Unsorted" board.

**Tags:** Favorites

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `folderId` | path | Yes | `string` |  |
| `scope` | query | Yes | `workspace` \| `personal` | Favorites scope. Use personal only with a delegated_user credential. full_access credentials receive 403 for personal scope. |

## Responses

### 200 - Public favorite ad folder share URL response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": {
    "folderId": "board_8b7c6d5e-4f3a-4b2c-9d1e-0f1a2b3c4d5e",
    "folder": {
      "id": "board_8b7c6d5e-4f3a-4b2c-9d1e-0f1a2b3c4d5e",
      "name": "Winning Creatives",
      "parentId": "board_1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d"
    },
    "id": "share_3f8aa146-6f96-46e8-9781-64db5166f9a8",
    "slug": null,
    "shareUrl": "https://app.trendtrack.io/en/share/boards/Zm9vYmFy",
    "sharePath": "/en/share/boards/Zm9vYmFy",
    "createdAt": "2026-04-18T12:30:00.000Z"
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
| `folderId` | `string` | Yes | Board id of the shared folder. |
| `folder` | `object` | Yes |  |
| `id` | `string` | Yes | Identifier of the board share link. |
| `slug` | `string` | Yes | Always null: board share links have no slug. |
| `shareUrl` | `string` | Yes |  |
| `sharePath` | `string` | Yes |  |
| `createdAt` | `string` | Yes |  |

**`folder` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes | Folder id: the id of the board backing the folder. |
| `name` | `string` | Yes |  |
| `parentId` | `string` | Yes | Parent folder (board) id when the folder is nested. Null for root folders. |

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

# Set favorite ad folder visibility

`PATCH /v1/favorites/ads/folders/{folderId}/visibility`

organization shares the board with the workspace; private is only allowed for folders created by the delegated user. Deprecated: favorites are now V3 boards; use /v1/boards. This endpoint is a compatibility facade over boards: folder ids are board ids (migrated V2 folder UUIDs are still accepted), saved favorite ids are board item ids, and favorites without a folder live in the scope's "Unsorted" board.

**Tags:** Favorites

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `folderId` | path | Yes | `string` |  |
| `scope` | query | Yes | `workspace` \| `personal` | Favorites scope. Use personal only with a delegated_user credential. full_access credentials receive 403 for personal scope. |

## Request Body

**Content-Type:** `application/json`

```json
{
  "visibility": "organization"
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `visibility` | `private` \| `organization` | Yes | organization publishes a root folder tree to the API credential workspace. private converts a root folder tree to delegated-user personal scope when the delegated user owns all contained folders and saved ads. |

## Responses

### 200 - Favorite ad folder visibility response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": {
    "id": "board_8b7c6d5e-4f3a-4b2c-9d1e-0f1a2b3c4d5e",
    "name": "Winning Creatives",
    "parentId": "board_1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d"
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
| `id` | `string` | Yes | Folder id: the id of the board backing the folder. |
| `name` | `string` | Yes |  |
| `parentId` | `string` | Yes | Parent folder (board) id when the folder is nested. Null for root folders. |

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

# Rename or move a favorite ad folder

`PATCH /v1/favorites/ads/folders/{folderId}`

Deprecated: favorites are now V3 boards; use /v1/boards. This endpoint is a compatibility facade over boards: folder ids are board ids (migrated V2 folder UUIDs are still accepted), saved favorite ids are board item ids, and favorites without a folder live in the scope's "Unsorted" board.

**Tags:** Favorites

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `folderId` | path | Yes | `string` |  |
| `scope` | query | Yes | `workspace` \| `personal` | Favorites scope. Use personal only with a delegated_user credential. full_access credentials receive 403 for personal scope. |

## Request Body

**Content-Type:** `application/json`

```json
{
  "name": "Top Competitor Hooks",
  "parentId": "f2c0dc30-95bf-4455-bb43-48d5f6e08f30"
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | No |  |
| `parentId` | `object` | No | Parent folder id (board id, or migrated V2 folder UUID). Use null to make it a root folder; omit to keep the current parent. |

## Responses

### 200 - Favorite ad folder mutation response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": {
    "id": "board_8b7c6d5e-4f3a-4b2c-9d1e-0f1a2b3c4d5e",
    "name": "Winning Creatives",
    "parentId": "board_1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d"
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
| `id` | `string` | Yes | Folder id: the id of the board backing the folder. |
| `name` | `string` | Yes |  |
| `parentId` | `string` | Yes | Parent folder (board) id when the folder is nested. Null for root folders. |

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

# Delete a favorite ad folder

`DELETE /v1/favorites/ads/folders/{folderId}`

The folder's board is archived, not destroyed: restore it with POST /v1/boards/{boardId}/restore. With move_items_to_root, items go to the scope's "Unsorted" board. Deprecated: favorites are now V3 boards; use /v1/boards. This endpoint is a compatibility facade over boards: folder ids are board ids (migrated V2 folder UUIDs are still accepted), saved favorite ids are board item ids, and favorites without a folder live in the scope's "Unsorted" board.

**Tags:** Favorites

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `folderId` | path | Yes | `string` |  |
| `scope` | query | Yes | `workspace` \| `personal` | Favorites scope. Use personal only with a delegated_user credential. full_access credentials receive 403 for personal scope. |

## Request Body

**Content-Type:** `application/json`

```json
{
  "mode": "move_items_to_root",
  "targetFolderId": "f2c0dc30-95bf-4455-bb43-48d5f6e08f30"
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `mode` | `delete_items` \| `move_items_to_root` \| `move_items_to_folder` | Yes | Explicit handling for saved ads contained in the deleted folder tree. |
| `targetFolderId` | `object` | No | Required when mode is move_items_to_folder. Must be a folder in the same requested scope and outside the deleted folder tree. |

## Responses

### 200 - Favorite ad folder delete response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": {
    "deleted": true,
    "folderId": "board_8b7c6d5e-4f3a-4b2c-9d1e-0f1a2b3c4d5e",
    "scope": "workspace",
    "mode": "delete_items",
    "targetFolderId": "string",
    "deletedFolderIds": [
      "string"
    ],
    "affectedFavoriteIds": [
      "string"
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
| `deleted` | `boolean` | Yes |  |
| `folderId` | `string` | Yes |  |
| `scope` | `workspace` \| `personal` | Yes |  |
| `mode` | `delete_items` \| `move_items_to_root` \| `move_items_to_folder` | Yes |  |
| `targetFolderId` | `string` | Yes |  |
| `deletedFolderIds` | `string`[] | Yes |  |
| `affectedFavoriteIds` | `string`[] | Yes |  |

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

# Add a favorite shop

`POST /v1/favorites/shops`

Deprecated: favorites are now V3 boards; use /v1/boards. This endpoint is a compatibility facade over boards: folder ids are board ids (migrated V2 folder UUIDs are still accepted), saved favorite ids are board item ids, and favorites without a folder live in the scope's "Unsorted" board.

**Tags:** Favorites

## Request Body

**Content-Type:** `application/json`

```json
{
  "scope": "workspace",
  "websiteId": "4af9f0d0-64d3-46db-a5f9-1a1b89604c88",
  "folderId": "board_5c11c47c-cf92-4709-85a2-a1f72b9ea0ca"
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `scope` | `workspace` \| `personal` | Yes |  |
| `websiteId` | `string` | Yes | Public website/shop identifier. The server resolves trusted domain and shop metadata from this id; clients cannot supply authoritative domain state. |
| `folderId` | `object` | No | Favorite shops folder id (board id, or migrated V2 folder UUID). Null or omitted saves the shop in the scope's "Unsorted" board. |

## Responses

### 200 - Favorite shop mutation response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": {
    "id": "board_item_8f92ad4a-61e8-4519-a182-4f8e24db0e52",
    "scope": "personal",
    "savedAt": "2026-04-20T10:00:00.000Z",
    "folder": {
      "id": "board_5c11c47c-cf92-4709-85a2-a1f72b9ea0ca",
      "name": "Competitors"
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
  },
  "created": true
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `requestId` | `string` | Yes |  |
| `data` | `object` | Yes |  |
| `created` | `boolean` | Yes | True when this call created a favorite; false when the favorite already existed. |

**`data` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes | Saved favorite id: the board item id. |
| `scope` | `workspace` \| `personal` | Yes |  |
| `savedAt` | `string` | Yes |  |
| `folder` | `object` | Yes |  |
| `shop` | `object` | Yes |  |

**`folder` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes | Folder id: the id of the board backing the folder. |
| `name` | `string` | Yes |  |

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

# List favorite shops

`GET /v1/favorites/shops`

Deprecated: favorites are now V3 boards; use /v1/boards. This endpoint is a compatibility facade over boards: folder ids are board ids (migrated V2 folder UUIDs are still accepted), saved favorite ids are board item ids, and favorites without a folder live in the scope's "Unsorted" board.

**Tags:** Favorites

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `scope` | query | Yes | `workspace` \| `personal` | Favorites scope. Use personal only with a delegated_user credential. full_access credentials receive 403 for personal scope. |
| `page` | query | No | `integer` |  |
| `limit` | query | No | `integer` |  |
| `folderId` | query | No | `string` | Optional shops folder identifier. When provided, only favorites saved in that folder are returned. |

## Responses

### 200 - Paginated favorite shops response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": [
    {
      "id": "board_item_8f92ad4a-61e8-4519-a182-4f8e24db0e52",
      "scope": "personal",
      "savedAt": "2026-04-20T10:00:00.000Z",
      "folder": {
        "id": "board_5c11c47c-cf92-4709-85a2-a1f72b9ea0ca",
        "name": "Competitors"
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
    "page": 1,
    "limit": 25,
    "total": 130,
    "totalPages": 6
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
| `id` | `string` | Yes | Saved favorite id: the board item id. |
| `scope` | `workspace` \| `personal` | Yes |  |
| `savedAt` | `string` | Yes |  |
| `folder` | `object` | Yes |  |
| `shop` | `object` | Yes |  |

**`folder` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes | Folder id: the id of the board backing the folder. |
| `name` | `string` | Yes |  |

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

# Move a saved favorite shop

`PATCH /v1/favorites/shops/saved/{favoriteId}/folder`

Deprecated: favorites are now V3 boards; use /v1/boards. This endpoint is a compatibility facade over boards: folder ids are board ids (migrated V2 folder UUIDs are still accepted), saved favorite ids are board item ids, and favorites without a folder live in the scope's "Unsorted" board.

**Tags:** Favorites

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `favoriteId` | path | Yes | `string` | Saved favorite id, which is the board item id. |
| `scope` | query | Yes | `workspace` \| `personal` | Favorites scope. Use personal only with a delegated_user credential. full_access credentials receive 403 for personal scope. |

## Request Body

**Content-Type:** `application/json`

```json
{
  "folderId": "board_5c11c47c-cf92-4709-85a2-a1f72b9ea0ca"
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `folderId` | `object` | No | Favorite shops folder id (board id, or migrated V2 folder UUID). Null moves the saved shop to the scope's "Unsorted" board. |

## Responses

### 200 - Saved favorite shop move response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": {
    "id": "board_item_8f92ad4a-61e8-4519-a182-4f8e24db0e52",
    "scope": "personal",
    "savedAt": "2026-04-20T10:00:00.000Z",
    "folder": {
      "id": "board_5c11c47c-cf92-4709-85a2-a1f72b9ea0ca",
      "name": "Competitors"
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
| `id` | `string` | Yes | Saved favorite id: the board item id. |
| `scope` | `workspace` \| `personal` | Yes |  |
| `savedAt` | `string` | Yes |  |
| `folder` | `object` | Yes |  |
| `shop` | `object` | Yes |  |

**`folder` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes | Folder id: the id of the board backing the folder. |
| `name` | `string` | Yes |  |

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

# Delete a saved favorite shop

`DELETE /v1/favorites/shops/saved/{favoriteId}`

Deprecated: favorites are now V3 boards; use /v1/boards. This endpoint is a compatibility facade over boards: folder ids are board ids (migrated V2 folder UUIDs are still accepted), saved favorite ids are board item ids, and favorites without a folder live in the scope's "Unsorted" board.

**Tags:** Favorites

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `favoriteId` | path | Yes | `string` | Saved favorite id, which is the board item id. |
| `scope` | query | Yes | `workspace` \| `personal` | Favorites scope. Use personal only with a delegated_user credential. full_access credentials receive 403 for personal scope. |

## Responses

### 200 - Saved favorite shop removal response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": {
    "removed": true,
    "websiteId": "4af9f0d0-64d3-46db-a5f9-1a1b89604c88",
    "scope": "workspace",
    "folderId": "board_5c11c47c-cf92-4709-85a2-a1f72b9ea0ca",
    "savedFavoriteId": "8f92ad4a-61e8-4519-a182-4f8e24db0e52"
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
| `removed` | `boolean` | Yes |  |
| `websiteId` | `string` | Yes |  |
| `scope` | `workspace` \| `personal` | Yes |  |
| `folderId` | `string` | Yes |  |
| `savedFavoriteId` | `string` | Yes |  |

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

# Remove a favorite shop by website id

`DELETE /v1/favorites/shops/{websiteId}`

Deprecated: favorites are now V3 boards; use /v1/boards. This endpoint is a compatibility facade over boards: folder ids are board ids (migrated V2 folder UUIDs are still accepted), saved favorite ids are board item ids, and favorites without a folder live in the scope's "Unsorted" board.

**Tags:** Favorites

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `websiteId` | path | Yes | `string` | Public website/shop identifier. |
| `scope` | query | Yes | `workspace` \| `personal` | Favorites scope. Use personal only with a delegated_user credential. full_access credentials receive 403 for personal scope. |
| `folderId` | query | No | `string` | Favorite shops folder id (board id, or migrated V2 folder UUID). Omit to remove from the scope's "Unsorted" board. |

## Responses

### 200 - Favorite shop removal response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": {
    "removed": true,
    "websiteId": "4af9f0d0-64d3-46db-a5f9-1a1b89604c88",
    "scope": "workspace",
    "folderId": "board_5c11c47c-cf92-4709-85a2-a1f72b9ea0ca",
    "savedFavoriteId": "8f92ad4a-61e8-4519-a182-4f8e24db0e52"
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
| `removed` | `boolean` | Yes |  |
| `websiteId` | `string` | Yes |  |
| `scope` | `workspace` \| `personal` | Yes |  |
| `folderId` | `string` | Yes |  |
| `savedFavoriteId` | `string` | Yes |  |

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

# Create a favorite shop folder

`POST /v1/favorites/shops/folders`

Deprecated: favorites are now V3 boards; use /v1/boards. This endpoint is a compatibility facade over boards: folder ids are board ids (migrated V2 folder UUIDs are still accepted), saved favorite ids are board item ids, and favorites without a folder live in the scope's "Unsorted" board.

**Tags:** Favorites

## Request Body

**Content-Type:** `application/json`

```json
{
  "scope": "workspace",
  "name": "Competitors"
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `scope` | `workspace` \| `personal` | Yes |  |
| `name` | `string` | Yes |  |

## Responses

### 200 - Favorite shop folder mutation response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": {
    "id": "board_5c11c47c-cf92-4709-85a2-a1f72b9ea0ca",
    "name": "Competitors"
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
| `id` | `string` | Yes | Folder id: the id of the board backing the folder. |
| `name` | `string` | Yes |  |

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

# List favorite shop folders

`GET /v1/favorites/shops/folders`

Deprecated: favorites are now V3 boards; use /v1/boards. This endpoint is a compatibility facade over boards: folder ids are board ids (migrated V2 folder UUIDs are still accepted), saved favorite ids are board item ids, and favorites without a folder live in the scope's "Unsorted" board.

**Tags:** Favorites

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `scope` | query | Yes | `workspace` \| `personal` | Favorites scope. Use personal only with a delegated_user credential. full_access credentials receive 403 for personal scope. |
| `page` | query | No | `integer` |  |
| `limit` | query | No | `integer` |  |

## Responses

### 200 - Paginated favorite shop folders response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": [
    {
      "id": "board_5c11c47c-cf92-4709-85a2-a1f72b9ea0ca",
      "name": "Competitors"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 130,
    "totalPages": 6
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
| `id` | `string` | Yes | Folder id: the id of the board backing the folder. |
| `name` | `string` | Yes |  |

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

# Set favorite shop folder visibility

`PATCH /v1/favorites/shops/folders/{folderId}/visibility`

organization shares the board with the workspace; private is only allowed for folders created by the delegated user. Deprecated: favorites are now V3 boards; use /v1/boards. This endpoint is a compatibility facade over boards: folder ids are board ids (migrated V2 folder UUIDs are still accepted), saved favorite ids are board item ids, and favorites without a folder live in the scope's "Unsorted" board.

**Tags:** Favorites

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `folderId` | path | Yes | `string` |  |
| `scope` | query | Yes | `workspace` \| `personal` | Favorites scope. Use personal only with a delegated_user credential. full_access credentials receive 403 for personal scope. |

## Request Body

**Content-Type:** `application/json`

```json
{
  "visibility": "organization"
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `visibility` | `private` \| `organization` | Yes | organization publishes a flat shop folder to the API credential workspace. private converts it to delegated-user personal scope when the delegated user owns the folder and every contained saved shop. |

## Responses

### 200 - Favorite shop folder visibility response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": {
    "id": "board_5c11c47c-cf92-4709-85a2-a1f72b9ea0ca",
    "name": "Competitors"
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
| `id` | `string` | Yes | Folder id: the id of the board backing the folder. |
| `name` | `string` | Yes |  |

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

# Rename a favorite shop folder

`PATCH /v1/favorites/shops/folders/{folderId}`

Deprecated: favorites are now V3 boards; use /v1/boards. This endpoint is a compatibility facade over boards: folder ids are board ids (migrated V2 folder UUIDs are still accepted), saved favorite ids are board item ids, and favorites without a folder live in the scope's "Unsorted" board.

**Tags:** Favorites

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `folderId` | path | Yes | `string` |  |
| `scope` | query | Yes | `workspace` \| `personal` | Favorites scope. Use personal only with a delegated_user credential. full_access credentials receive 403 for personal scope. |

## Request Body

**Content-Type:** `application/json`

```json
{
  "name": "Top Competitors"
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | No |  |

## Responses

### 200 - Favorite shop folder mutation response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": {
    "id": "board_5c11c47c-cf92-4709-85a2-a1f72b9ea0ca",
    "name": "Competitors"
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
| `id` | `string` | Yes | Folder id: the id of the board backing the folder. |
| `name` | `string` | Yes |  |

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

# Delete a favorite shop folder

`DELETE /v1/favorites/shops/folders/{folderId}`

The folder's board is archived, not destroyed: restore it with POST /v1/boards/{boardId}/restore. With move_items_to_root, items go to the scope's "Unsorted" board. Deprecated: favorites are now V3 boards; use /v1/boards. This endpoint is a compatibility facade over boards: folder ids are board ids (migrated V2 folder UUIDs are still accepted), saved favorite ids are board item ids, and favorites without a folder live in the scope's "Unsorted" board.

**Tags:** Favorites

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `folderId` | path | Yes | `string` |  |
| `scope` | query | Yes | `workspace` \| `personal` | Favorites scope. Use personal only with a delegated_user credential. full_access credentials receive 403 for personal scope. |

## Request Body

**Content-Type:** `application/json`

```json
{
  "mode": "move_items_to_root",
  "targetFolderId": "board_5c11c47c-cf92-4709-85a2-a1f72b9ea0ca"
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `mode` | `delete_items` \| `move_items_to_root` \| `move_items_to_folder` | Yes | Explicit handling for saved shops contained in the deleted flat folder. |
| `targetFolderId` | `object` | No | Required when mode is move_items_to_folder. Must be a flat shops folder in the same requested scope. |

## Responses

### 200 - Favorite shop folder delete response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": {
    "deleted": true,
    "folderId": "board_5c11c47c-cf92-4709-85a2-a1f72b9ea0ca",
    "scope": "workspace",
    "mode": "delete_items",
    "targetFolderId": "string",
    "affectedFavoriteIds": [
      "string"
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
| `deleted` | `boolean` | Yes |  |
| `folderId` | `string` | Yes |  |
| `scope` | `workspace` \| `personal` | Yes |  |
| `mode` | `delete_items` \| `move_items_to_root` \| `move_items_to_folder` | Yes |  |
| `targetFolderId` | `string` | Yes |  |
| `affectedFavoriteIds` | `string`[] | Yes |  |

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

# Add or update a favorite email

`POST /v1/favorites/emails`

Deprecated: favorites are now V3 boards; use /v1/boards. This endpoint is a compatibility facade over boards: folder ids are board ids (migrated V2 folder UUIDs are still accepted), saved favorite ids are board item ids, and favorites without a folder live in the scope's "Unsorted" board.

**Tags:** Favorites

## Request Body

**Content-Type:** `application/json`

```json
{
  "scope": "workspace",
  "emailId": 7298813,
  "folderId": "0e91fbef-3d02-44d8-b024-3bda62fb050c"
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `scope` | `workspace` \| `personal` | Yes |  |
| `emailId` | `number` | Yes | Public email identifier used by search/get_email_html. |
| `folderId` | `object` | No | Favorite emails folder id (board id, or migrated V2 folder UUID). Null or omitted saves the email in the scope's "Unsorted" board. |

## Responses

### 200 - Favorite email mutation response.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": {
    "id": "board_item_f3d7c2da-e64c-42c3-a0b1-ef1a4633592d",
    "scope": "workspace",
    "savedAt": "2026-04-20T10:00:00.000Z",
    "folder": {
      "id": "board_0e91fbef-3d02-44d8-b024-3bda62fb050c",
      "name": "Lifecycle Emails",
      "parentId": "board_4b84a8f9-44df-4a18-9f08-66e6db6403da"
    },
    "email": {
      "id": 123456,
      "sentAt": "2026-04-18T12:30:00.000Z",
      "campaignType": "Newsletter",
      "classification": {
        "promotionType": "Discount %",
        "promotionTypeId": 1,
        "category": "Promotional Campaign",
        "categoryId": 4,
        "event": {
          "name": "Black Friday",
          "id": 1,
          "category": "Commercial Events"
        }
      },
      "content": {
        "subject": "Up to 30% off this weekend",
        "preheader": "Limited-time offers picked for you.",
        "bodyPreview": "Shop limited-time offers picked for you before they are gone.",
        "bodyLength": 428,
        "screenshotUrl": "https://cdn.example.com/emails/123.png"
      },
      "shop": {
        "id": "3f8aa146-6f96-46e8-9781-64db5166f9a8",
        "domain": "example.com",
        "name": "Example Shop"
      }
    }
  },
  "created": true
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `requestId` | `string` | Yes |  |
| `data` | `object` | Yes |  |
| `created` | `boolean` | Yes |  |

**`data` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes | Saved favorite id: the board item id. |
| `scope` | `workspace` \| `personal` | Yes |  |
| `savedAt` | `string` | Yes |  |
| `folder` | `object` | Yes |  |
| `email` | `object` | Yes | Embedded public email summary. Null when the saved row exists but the backing email content is no longer available. |

**`folder` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes | Folder id: the id of the board backing the folder. |
| `name` | `string` | Yes |  |
| `parentId` | `string` | Yes | Parent folder (board) id. Null for root folders. |

**`email` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `number` | Yes |  |
| `sentAt` | `string` | Yes |  |
| `campaignType` | `string` | Yes |  |
| `classification` | `object` | Yes |  |
| `content` | `object` | Yes |  |
| `shop` | `object` | Yes |  |

**`classification` properties:**


**`content` properties:**


**`shop` properties:**


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

# List favorite emails

`GET /v1/favorites/emails`

Deprecated: favorites are now V3 boards; use /v1/boards. This endpoint is a compatibility facade over boards: folder ids are board ids (migrated V2 folder UUIDs are still accepted), saved favorite ids are board item ids, and favorites without a folder live in the scope's "Unsorted" board.

**Tags:** Favorites

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `scope` | query | Yes | `workspace` \| `personal` | Favorites scope. Use personal only with a delegated_user credential. full_access credentials receive 403 for personal scope. |
| `page` | query | No | `integer` |  |
| `limit` | query | No | `integer` |  |
| `folderId` | query | No | `string` | Optional emails folder id (board id, or migrated V2 folder UUID). When provided, only favorites saved in that folder are returned. |

## Responses

### 200 - Paginated favorite emails response.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": [
    {
      "id": "board_item_f3d7c2da-e64c-42c3-a0b1-ef1a4633592d",
      "scope": "workspace",
      "savedAt": "2026-04-20T10:00:00.000Z",
      "folder": {
        "id": "board_0e91fbef-3d02-44d8-b024-3bda62fb050c",
        "name": "Lifecycle Emails",
        "parentId": "board_4b84a8f9-44df-4a18-9f08-66e6db6403da"
      },
      "email": {
        "id": 123456,
        "sentAt": "2026-04-18T12:30:00.000Z",
        "campaignType": "Newsletter",
        "classification": {
          "promotionType": "Discount %",
          "promotionTypeId": 1,
          "category": "Promotional Campaign",
          "categoryId": 4,
          "event": {
            "name": "Black Friday",
            "id": 1,
            "category": "Commercial Events"
          }
        },
        "content": {
          "subject": "Up to 30% off this weekend",
          "preheader": "Limited-time offers picked for you.",
          "bodyPreview": "Shop limited-time offers picked for you before they are gone.",
          "bodyLength": 428,
          "screenshotUrl": "https://cdn.example.com/emails/123.png"
        },
        "shop": {
          "id": "3f8aa146-6f96-46e8-9781-64db5166f9a8",
          "domain": "example.com",
          "name": "Example Shop"
        }
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 130,
    "totalPages": 6
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
| `id` | `string` | Yes | Saved favorite id: the board item id. |
| `scope` | `workspace` \| `personal` | Yes |  |
| `savedAt` | `string` | Yes |  |
| `folder` | `object` | Yes |  |
| `email` | `object` | Yes | Embedded public email summary. Null when the saved row exists but the backing email content is no longer available. |

**`folder` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes | Folder id: the id of the board backing the folder. |
| `name` | `string` | Yes |  |
| `parentId` | `string` | Yes | Parent folder (board) id. Null for root folders. |

**`email` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `number` | Yes |  |
| `sentAt` | `string` | Yes |  |
| `campaignType` | `string` | Yes |  |
| `classification` | `object` | Yes |  |
| `content` | `object` | Yes |  |
| `shop` | `object` | Yes |  |

**`classification` properties:**


**`content` properties:**


**`shop` properties:**


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

# Move a saved favorite email

`PATCH /v1/favorites/emails/saved/{favoriteId}/folder`

Deprecated: favorites are now V3 boards; use /v1/boards. This endpoint is a compatibility facade over boards: folder ids are board ids (migrated V2 folder UUIDs are still accepted), saved favorite ids are board item ids, and favorites without a folder live in the scope's "Unsorted" board.

**Tags:** Favorites

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `favoriteId` | path | Yes | `string` | Saved favorite id, which is the board item id. |
| `scope` | query | Yes | `workspace` \| `personal` | Favorites scope. Use personal only with a delegated_user credential. full_access credentials receive 403 for personal scope. |

## Request Body

**Content-Type:** `application/json`

```json
{
  "folderId": "0e91fbef-3d02-44d8-b024-3bda62fb050c"
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `folderId` | `object` | No | Favorite emails folder id (board id, or migrated V2 folder UUID). Null moves the saved email to the scope's "Unsorted" board. |

## Responses

### 200 - Saved favorite email move response.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": {
    "id": "board_item_f3d7c2da-e64c-42c3-a0b1-ef1a4633592d",
    "scope": "workspace",
    "savedAt": "2026-04-20T10:00:00.000Z",
    "folder": {
      "id": "board_0e91fbef-3d02-44d8-b024-3bda62fb050c",
      "name": "Lifecycle Emails",
      "parentId": "board_4b84a8f9-44df-4a18-9f08-66e6db6403da"
    },
    "email": {
      "id": 123456,
      "sentAt": "2026-04-18T12:30:00.000Z",
      "campaignType": "Newsletter",
      "classification": {
        "promotionType": "Discount %",
        "promotionTypeId": 1,
        "category": "Promotional Campaign",
        "categoryId": 4,
        "event": {
          "name": "Black Friday",
          "id": 1,
          "category": "Commercial Events"
        }
      },
      "content": {
        "subject": "Up to 30% off this weekend",
        "preheader": "Limited-time offers picked for you.",
        "bodyPreview": "Shop limited-time offers picked for you before they are gone.",
        "bodyLength": 428,
        "screenshotUrl": "https://cdn.example.com/emails/123.png"
      },
      "shop": {
        "id": "3f8aa146-6f96-46e8-9781-64db5166f9a8",
        "domain": "example.com",
        "name": "Example Shop"
      }
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
| `id` | `string` | Yes | Saved favorite id: the board item id. |
| `scope` | `workspace` \| `personal` | Yes |  |
| `savedAt` | `string` | Yes |  |
| `folder` | `object` | Yes |  |
| `email` | `object` | Yes | Embedded public email summary. Null when the saved row exists but the backing email content is no longer available. |

**`folder` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes | Folder id: the id of the board backing the folder. |
| `name` | `string` | Yes |  |
| `parentId` | `string` | Yes | Parent folder (board) id. Null for root folders. |

**`email` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `number` | Yes |  |
| `sentAt` | `string` | Yes |  |
| `campaignType` | `string` | Yes |  |
| `classification` | `object` | Yes |  |
| `content` | `object` | Yes |  |
| `shop` | `object` | Yes |  |

**`classification` properties:**


**`content` properties:**


**`shop` properties:**


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

# Delete a saved favorite email

`DELETE /v1/favorites/emails/saved/{favoriteId}`

Deprecated: favorites are now V3 boards; use /v1/boards. This endpoint is a compatibility facade over boards: folder ids are board ids (migrated V2 folder UUIDs are still accepted), saved favorite ids are board item ids, and favorites without a folder live in the scope's "Unsorted" board.

**Tags:** Favorites

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `favoriteId` | path | Yes | `string` | Saved favorite id, which is the board item id. |
| `scope` | query | Yes | `workspace` \| `personal` | Favorites scope. Use personal only with a delegated_user credential. full_access credentials receive 403 for personal scope. |

## Responses

### 200 - Saved favorite email removal response.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": {
    "removed": true,
    "emailId": 7298813,
    "scope": "workspace",
    "folderId": "0e91fbef-3d02-44d8-b024-3bda62fb050c",
    "savedFavoriteId": "f3d7c2da-e64c-42c3-a0b1-ef1a4633592d"
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
| `removed` | `boolean` | Yes |  |
| `emailId` | `number` | Yes |  |
| `scope` | `workspace` \| `personal` | Yes |  |
| `folderId` | `string` | Yes |  |
| `savedFavoriteId` | `string` | Yes |  |

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

# Create a favorite email folder

`POST /v1/favorites/emails/folders`

Deprecated: favorites are now V3 boards; use /v1/boards. This endpoint is a compatibility facade over boards: folder ids are board ids (migrated V2 folder UUIDs are still accepted), saved favorite ids are board item ids, and favorites without a folder live in the scope's "Unsorted" board.

**Tags:** Favorites

## Request Body

**Content-Type:** `application/json`

```json
{
  "scope": "workspace",
  "name": "Lifecycle Emails",
  "parentId": "4b84a8f9-44df-4a18-9f08-66e6db6403da"
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `scope` | `workspace` \| `personal` | Yes |  |
| `name` | `string` | Yes |  |
| `parentId` | `object` | No | Parent folder id (board id, or migrated V2 folder UUID). Null or omitted creates a root folder. |

## Responses

### 200 - Favorite email folder mutation response.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": {
    "id": "board_0e91fbef-3d02-44d8-b024-3bda62fb050c",
    "name": "Lifecycle Emails",
    "parentId": "board_4b84a8f9-44df-4a18-9f08-66e6db6403da"
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
| `id` | `string` | Yes | Folder id: the id of the board backing the folder. |
| `name` | `string` | Yes |  |
| `parentId` | `string` | Yes | Parent folder (board) id. Null for root folders. |

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

# List favorite email folders

`GET /v1/favorites/emails/folders`

Deprecated: favorites are now V3 boards; use /v1/boards. This endpoint is a compatibility facade over boards: folder ids are board ids (migrated V2 folder UUIDs are still accepted), saved favorite ids are board item ids, and favorites without a folder live in the scope's "Unsorted" board.

**Tags:** Favorites

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `scope` | query | Yes | `workspace` \| `personal` | Favorites scope. Use personal only with a delegated_user credential. full_access credentials receive 403 for personal scope. |
| `page` | query | No | `integer` |  |
| `limit` | query | No | `integer` |  |

## Responses

### 200 - Paginated favorite email folders response.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": [
    {
      "id": "board_0e91fbef-3d02-44d8-b024-3bda62fb050c",
      "name": "Lifecycle Emails",
      "parentId": "board_4b84a8f9-44df-4a18-9f08-66e6db6403da"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 130,
    "totalPages": 6
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
| `id` | `string` | Yes | Folder id: the id of the board backing the folder. |
| `name` | `string` | Yes |  |
| `parentId` | `string` | Yes | Parent folder (board) id. Null for root folders. |

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

# Reorder favorite email folders

`PATCH /v1/favorites/emails/folders/reorder`

Boards have no manual order: the folders are validated and echoed back in the requested order, but no order is persisted. Deprecated: favorites are now V3 boards; use /v1/boards. This endpoint is a compatibility facade over boards: folder ids are board ids (migrated V2 folder UUIDs are still accepted), saved favorite ids are board item ids, and favorites without a folder live in the scope's "Unsorted" board.

**Tags:** Favorites

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `scope` | query | Yes | `workspace` \| `personal` | Favorites scope. Use personal only with a delegated_user credential. full_access credentials receive 403 for personal scope. |

## Request Body

**Content-Type:** `application/json`

```json
{
  "folders": [
    {
      "id": "0e91fbef-3d02-44d8-b024-3bda62fb050c",
      "order": 1
    }
  ]
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `folders` | `object`[] | Yes |  |

**`folders[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes | Favorite emails folder id (board id, or migrated V2 folder UUID). |
| `order` | `number` | Yes |  |

## Responses

### 200 - Favorite email folders reorder response.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": {
    "reordered": true,
    "scope": "workspace",
    "folders": [
      {
        "id": "board_0e91fbef-3d02-44d8-b024-3bda62fb050c",
        "name": "Lifecycle Emails",
        "parentId": "board_4b84a8f9-44df-4a18-9f08-66e6db6403da"
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
| `reordered` | `boolean` | Yes |  |
| `scope` | `workspace` \| `personal` | Yes |  |
| `folders` | `object`[] | Yes |  |

**`folders[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes | Folder id: the id of the board backing the folder. |
| `name` | `string` | Yes |  |
| `parentId` | `string` | Yes | Parent folder (board) id. Null for root folders. |

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

# Set favorite email folder visibility

`PATCH /v1/favorites/emails/folders/{folderId}/visibility`

organization shares the board with the workspace; private is only allowed for folders created by the delegated user. Deprecated: favorites are now V3 boards; use /v1/boards. This endpoint is a compatibility facade over boards: folder ids are board ids (migrated V2 folder UUIDs are still accepted), saved favorite ids are board item ids, and favorites without a folder live in the scope's "Unsorted" board.

**Tags:** Favorites

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `folderId` | path | Yes | `string` |  |
| `scope` | query | Yes | `workspace` \| `personal` | Favorites scope. Use personal only with a delegated_user credential. full_access credentials receive 403 for personal scope. |

## Request Body

**Content-Type:** `application/json`

```json
{
  "visibility": "organization"
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `visibility` | `private` \| `organization` | Yes | organization publishes a root email folder tree to the API credential workspace. private converts it to delegated-user personal scope when the delegated user owns every contained folder and saved email. |

## Responses

### 200 - Favorite email folder visibility response.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": {
    "id": "board_0e91fbef-3d02-44d8-b024-3bda62fb050c",
    "name": "Lifecycle Emails",
    "parentId": "board_4b84a8f9-44df-4a18-9f08-66e6db6403da"
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
| `id` | `string` | Yes | Folder id: the id of the board backing the folder. |
| `name` | `string` | Yes |  |
| `parentId` | `string` | Yes | Parent folder (board) id. Null for root folders. |

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

# Rename or move a favorite email folder

`PATCH /v1/favorites/emails/folders/{folderId}`

Deprecated: favorites are now V3 boards; use /v1/boards. This endpoint is a compatibility facade over boards: folder ids are board ids (migrated V2 folder UUIDs are still accepted), saved favorite ids are board item ids, and favorites without a folder live in the scope's "Unsorted" board.

**Tags:** Favorites

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `folderId` | path | Yes | `string` |  |
| `scope` | query | Yes | `workspace` \| `personal` | Favorites scope. Use personal only with a delegated_user credential. full_access credentials receive 403 for personal scope. |

## Request Body

**Content-Type:** `application/json`

```json
{
  "name": "VIP Lifecycle Emails",
  "parentId": "4b84a8f9-44df-4a18-9f08-66e6db6403da"
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | No |  |
| `parentId` | `object` | No | Parent folder id (board id, or migrated V2 folder UUID). Use null to make it a root folder; omit to keep the current parent. |

## Responses

### 200 - Favorite email folder mutation response.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": {
    "id": "board_0e91fbef-3d02-44d8-b024-3bda62fb050c",
    "name": "Lifecycle Emails",
    "parentId": "board_4b84a8f9-44df-4a18-9f08-66e6db6403da"
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
| `id` | `string` | Yes | Folder id: the id of the board backing the folder. |
| `name` | `string` | Yes |  |
| `parentId` | `string` | Yes | Parent folder (board) id. Null for root folders. |

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

# Delete a favorite email folder

`DELETE /v1/favorites/emails/folders/{folderId}`

The folder's board is archived, not destroyed: restore it with POST /v1/boards/{boardId}/restore. With move_items_to_root, items go to the scope's "Unsorted" board. Deprecated: favorites are now V3 boards; use /v1/boards. This endpoint is a compatibility facade over boards: folder ids are board ids (migrated V2 folder UUIDs are still accepted), saved favorite ids are board item ids, and favorites without a folder live in the scope's "Unsorted" board.

**Tags:** Favorites

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `folderId` | path | Yes | `string` |  |
| `scope` | query | Yes | `workspace` \| `personal` | Favorites scope. Use personal only with a delegated_user credential. full_access credentials receive 403 for personal scope. |

## Request Body

**Content-Type:** `application/json`

```json
{
  "mode": "move_items_to_root",
  "targetFolderId": "4b84a8f9-44df-4a18-9f08-66e6db6403da"
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `mode` | `delete_items` \| `move_items_to_root` \| `move_items_to_folder` | Yes |  |
| `targetFolderId` | `object` | No |  |

## Responses

### 200 - Favorite email folder delete response.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": {
    "deleted": true,
    "folderId": "0e91fbef-3d02-44d8-b024-3bda62fb050c",
    "scope": "workspace",
    "mode": "delete_items",
    "targetFolderId": "string",
    "deletedFolderIds": [
      "string"
    ],
    "affectedFavoriteIds": [
      "string"
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
| `deleted` | `boolean` | Yes |  |
| `folderId` | `string` | Yes |  |
| `scope` | `workspace` \| `personal` | Yes |  |
| `mode` | `delete_items` \| `move_items_to_root` \| `move_items_to_folder` | Yes |  |
| `targetFolderId` | `string` | Yes |  |
| `deletedFolderIds` | `string`[] | Yes |  |
| `affectedFavoriteIds` | `string`[] | Yes |  |

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

# Remove a favorite email by email id

`DELETE /v1/favorites/emails/{emailId}`

Deprecated: favorites are now V3 boards; use /v1/boards. This endpoint is a compatibility facade over boards: folder ids are board ids (migrated V2 folder UUIDs are still accepted), saved favorite ids are board item ids, and favorites without a folder live in the scope's "Unsorted" board.

**Tags:** Favorites

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `emailId` | path | Yes | `integer` | Public email identifier. To delete a saved favorite row by favorite_emails.uuid, use DELETE /v1/favorites/emails/saved/:favoriteId. |
| `scope` | query | Yes | `workspace` \| `personal` | Favorites scope. Use personal only with a delegated_user credential. full_access credentials receive 403 for personal scope. |
| `folderId` | query | No | `string` | Favorite emails folder id (board id, or migrated V2 folder UUID). Omit to remove from the scope's "Unsorted" board. |

## Responses

### 200 - Favorite email removal response.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": {
    "removed": true,
    "emailId": 7298813,
    "scope": "workspace",
    "folderId": "0e91fbef-3d02-44d8-b024-3bda62fb050c",
    "savedFavoriteId": "f3d7c2da-e64c-42c3-a0b1-ef1a4633592d"
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
| `removed` | `boolean` | Yes |  |
| `emailId` | `number` | Yes |  |
| `scope` | `workspace` \| `personal` | Yes |  |
| `folderId` | `string` | Yes |  |
| `savedFavoriteId` | `string` | Yes |  |

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
