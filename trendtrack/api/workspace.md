# Workspace

---

# List workspace brandtracker folders

`GET /v1/workspace/folders`

Returns the active workspace brandtracker folders so clients can resolve folderIds for workspace and brandtracker filters. Folder names are returned as metadata; prefer folderIds for exact filtering. Equivalent folder listing is also available at GET /v1/brandtrackers/folders.

**Tags:** Workspace

## Responses

### 200 - Workspace brandtracker folders. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": [
    {
      "id": 12,
      "name": "Competitors",
      "rank": 1,
      "brandtrackerCount": 8
    }
  ]
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `requestId` | `string` | Yes |  |
| `data` | `object`[] | Yes |  |

**`data[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `number` | Yes |  |
| `name` | `string` | Yes |  |
| `rank` | `number` | Yes |  |
| `brandtrackerCount` | `number` | Yes | Number of active brandtrackers currently assigned to this folder. |

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

# Inspect the authenticated workspace

`GET /v1/workspace`

Returns the workspace bound to the provided public API key along with the effective authentication context.

**Tags:** Workspace

## Responses

### 200 - Workspace snapshot for the authenticated public API credential. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "38558568-a304-4682-a798-2578e37345f0",
  "workspace": {
    "id": "ws_123",
    "slug": "my-workspace",
    "name": "My Workspace",
    "createdAt": "2024-11-12T16:12:43.931Z"
  },
  "authenticatedAs": {
    "accessLevel": "full_access",
    "delegatedUserId": null,
    "delegatedUserRole": null
  },
  "credential": {
    "id": "cred_123",
    "name": "Production key",
    "description": null,
    "expiresAt": null,
    "createdAt": "2026-04-20T07:24:00.246Z",
    "lastUsedAt": "2026-04-20T07:28:18.682Z"
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `workspace` | `object` | Yes |  |
| `authenticatedAs` | `object` | Yes |  |
| `credential` | `object` | Yes |  |

**`workspace` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes |  |
| `slug` | `string` | Yes |  |
| `name` | `string` | Yes |  |
| `createdAt` | `string` | Yes |  |

**`authenticatedAs` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `accessLevel` | `full_access` \| `delegated_user` | Yes |  |
| `delegatedUserId` | `string` | Yes | Delegated user identifier when authenticated with a delegated credential. |
| `delegatedUserRole` | `owner` \| `admin` \| `member` \| `readonly` | Yes | Workspace role of the delegated user when present. |

**`credential` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes |  |
| `name` | `string` | Yes |  |
| `description` | `string` | Yes |  |
| `expiresAt` | `string` | Yes |  |
| `createdAt` | `string` | Yes |  |
| `lastUsedAt` | `string` | Yes |  |

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

# Get current ranked workspace top ads

`GET /v1/workspace/top-ads`

Canonical current-ranking endpoint across active workspace brandtrackers in a single metered request. Each returned row is explicitly nested as { brandtracker, ad, metrics }. Billing remains proportional to requested/returned row count (limit/result length), not brandtracker count. Use sortBy=currentRank for current Facebook page rank, sortBy=reach/reachDelta1d/reachDelta7d/reachDelta30d for reach rankings, and sortBy=rankDelta7d/rankDelta14d/rankDelta30d for rank movers. period and snapshotDate are deprecated compatibility parameters and are ignored on this current-ranking path.

**Tags:** Workspace

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `page` | query | No | `integer` | Pagination page number. Defaults to 1. |
| `limit` | query | No | `integer` | Maximum number of workspace top ads to return. Must be <= 100. |
| `euOnly` | query | No | `boolean` | Optional EU-only filter. When true, only EU-classified Facebook ads are included. |
| `sortBy` | query | No | `currentRank` \| `rankDelta` \| `rankDelta7d` \| `rankDelta14d` \| `rankDelta30d` \| `reach` \| `reachDelta1d` \| `reachDelta7d` \| `reachDelta30d` \| `daysRunning` \| `duplicates` | Sort key for canonical current rankings. Use currentRank for current Facebook page rank (returned as rank/currentRank); rankDelta7d, rankDelta14d, or rankDelta30d for movers; reach, reachDelta1d, reachDelta7d, or reachDelta30d for reach rankings. |
| `includeInactive` | query | No | `boolean` | When true, include inactive ads where supported. Defaults to false. |
| `period` | query | No | `today` \| `yesterday` \| `last1d` \| `last7d` \| `last14d` \| `last30d` \| `total` | Optional rolling workspace top-ads period. Allowed values: today, yesterday, last1d, last7d, last14d, last30d, total. |
| `snapshotDate` | query | No | `object` | Deprecated compatibility parameter accepted but ignored by canonical workspace top-ads current ranking. Use freshness/system endpoints for snapshot availability checks. |

## Responses

### 200 - Paginated workspace top ads response where each data row is { brandtracker, ad, metrics }. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": [
    {
      "brandtracker": {
        "id": "1e08fa85-625a-4ba5-b673-d2a4b7bc7c55",
        "name": "Acme",
        "facebookPageId": "123456789012345"
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
      },
      "metrics": {
        "totalReach": 152340,
        "duplicateCount": 4,
        "daysRunning": 27,
        "currentRank": 3
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 128,
    "totalPages": 7
  },
  "meta": {
    "reason": "no_snapshot_for_period"
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `data` | `object`[] | Yes | Workspace top-ads rows. Every element uses the nested shape { brandtracker, ad, metrics }. |
| `pagination` | `object` | Yes |  |
| `meta` | `object` | No |  |

**`data[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `brandtracker` | `object` | Yes | Brandtracker context for this workspace top-ads row. Each row is nested as { brandtracker, ad, metrics }. |
| `ad` | `object` | Yes | Ad summary payload for this workspace top-ads row. Each row is nested as { brandtracker, ad, metrics }. |
| `metrics` | `object` | Yes | Ranking/reach metrics for this workspace top-ads row. Each row is nested as { brandtracker, ad, metrics }. |

**`brandtracker` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes | Public brandtracker identifier backed by brandtracker.id. Legacy spyders.uuid values are accepted when migration metadata exists. |
| `name` | `string` | Yes |  |
| `facebookPageId` | `string` | Yes | Facebook page id associated with this workspace brandtracker. |

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


**`metrics` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `totalReach` | `number` | Yes | Total reach for the ranked ad. In Meta Ad Library vocabulary, reach is the public-facing impressions-style metric; EU impressions/reach are used where available. |
| `duplicateCount` | `number` | Yes |  |
| `daysRunning` | `number` | Yes |  |
| `currentRank` | `number` | Yes |  |

**`pagination` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `page` | `number` | Yes |  |
| `limit` | `number` | Yes |  |
| `total` | `number` | Yes |  |
| `totalPages` | `number` | Yes |  |

**`meta` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `reason` | `no_snapshot_for_period` \| `no_reach_history_for_period` \| `no_matching_ads` | No | Present on empty result sets to distinguish filters with no matching ads. |

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

# Get workspace hooks

`GET /v1/workspace/hooks`

Returns hook analytics aggregated across active workspace brandtrackers in one metered request. One credit is charged per returned row.

**Tags:** Workspace

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `page` | query | No | `integer` |  |
| `limit` | query | No | `integer` | Maximum number of workspace aggregate rows to return. Must be <= 100. |
| `brandtrackerIds` | query | No | `string`[] | Optional comma-separated or repeated public brandtracker ids. |
| `folderIds` | query | No | `integer`[] | Optional comma-separated or repeated workspace brandtracker folder ids. |
| `euOnly` | query | No | `boolean` | Optional EU-only filter. When true, only EU-classified Facebook ads are included. |
| `order` | query | No | `asc` \| `desc` |  |
| `sortBy` | query | No | `usageCount` \| `longestRunning` \| `totalImpressions` \| `firstUsedAt` \| `lastUsedAt` |  |

## Responses

### 200 - Paginated workspace hooks response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": [
    {
      "brandtracker": {
        "id": "1e08fa85-625a-4ba5-b673-d2a4b7bc7c55",
        "name": "Acme",
        "facebookPageId": "123456789012345"
      },
      "hook": {
        "text": "Stop scrolling.",
        "sampleAd": {
          "adId": "facebook_123456789",
          "mediaUrl": "https://cdn.example.com/ads/creative.mp4",
          "thumbnailUrl": "https://cdn.example.com/ads/creative-thumb.jpg",
          "fullText": "This is the full transcript text for the sampled ad."
        }
      },
      "metrics": {
        "usageCount": 12,
        "longestRunning": 47,
        "totalImpressions": 152340,
        "firstUsedAt": "2026-01-01T00:00:00.000Z",
        "lastUsedAt": "2026-01-01T00:00:00.000Z"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 128,
    "totalPages": 7
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
| `brandtracker` | `object` | Yes |  |
| `hook` | `object` | Yes |  |
| `metrics` | `object` | Yes |  |

**`brandtracker` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes | Public brandtracker identifier backed by brandtracker.id. Legacy spyders.uuid values are accepted when migration metadata exists. |
| `name` | `string` | Yes |  |
| `facebookPageId` | `string` | Yes | Facebook page id associated with this workspace brandtracker. |

**`hook` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `text` | `string` | Yes |  |
| `sampleAd` | `object` | Yes |  |

**`sampleAd` properties:**


**`metrics` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `usageCount` | `number` | Yes |  |
| `longestRunning` | `number` | Yes |  |
| `totalImpressions` | `number` | Yes |  |
| `firstUsedAt` | `string` | Yes |  |
| `lastUsedAt` | `string` | Yes |  |

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

# Get workspace ad copies

`GET /v1/workspace/ad-copies`

Returns ad copy analytics aggregated across active workspace brandtrackers in one metered request. One credit is charged per returned row.

**Tags:** Workspace

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `page` | query | No | `integer` |  |
| `limit` | query | No | `integer` | Maximum number of workspace aggregate rows to return. Must be <= 100. |
| `brandtrackerIds` | query | No | `string`[] | Optional comma-separated or repeated public brandtracker ids. |
| `folderIds` | query | No | `integer`[] | Optional comma-separated or repeated workspace brandtracker folder ids. |
| `euOnly` | query | No | `boolean` | Optional EU-only filter. When true, only EU-classified Facebook ads are included. |
| `order` | query | No | `asc` \| `desc` |  |
| `sortBy` | query | No | `usageCount` \| `longestRunning` |  |

## Responses

### 200 - Paginated workspace ad copies response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": [
    {
      "brandtracker": {
        "id": "1e08fa85-625a-4ba5-b673-d2a4b7bc7c55",
        "name": "Acme",
        "facebookPageId": "123456789012345"
      },
      "adCopy": {
        "text": "Get 30% off selected products this week only."
      },
      "metrics": {
        "usageCount": 21,
        "longestRunning": 43
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 128,
    "totalPages": 7
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
| `brandtracker` | `object` | Yes |  |
| `adCopy` | `object` | Yes |  |
| `metrics` | `object` | Yes |  |

**`brandtracker` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes | Public brandtracker identifier backed by brandtracker.id. Legacy spyders.uuid values are accepted when migration metadata exists. |
| `name` | `string` | Yes |  |
| `facebookPageId` | `string` | Yes | Facebook page id associated with this workspace brandtracker. |

**`adCopy` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `text` | `string` | Yes |  |

**`metrics` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `usageCount` | `number` | Yes |  |
| `longestRunning` | `number` | Yes |  |

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

# Get workspace landing pages

`GET /v1/workspace/landing-pages`

Returns landing page analytics aggregated across active workspace brandtrackers in one metered request. One credit is charged per returned row.

**Tags:** Workspace

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `page` | query | No | `integer` |  |
| `limit` | query | No | `integer` | Maximum number of workspace aggregate rows to return. Must be <= 100. |
| `brandtrackerIds` | query | No | `string`[] | Optional comma-separated or repeated public brandtracker ids. |
| `folderIds` | query | No | `integer`[] | Optional comma-separated or repeated workspace brandtracker folder ids. |
| `euOnly` | query | No | `boolean` | Optional EU-only filter. When true, only EU-classified Facebook ads are included. |
| `order` | query | No | `asc` \| `desc` |  |
| `sortBy` | query | No | `usageCount` \| `longestRunning` \| `totalImpressions` |  |

## Responses

### 200 - Paginated workspace landing pages response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": [
    {
      "brandtracker": {
        "id": "1e08fa85-625a-4ba5-b673-d2a4b7bc7c55",
        "name": "Acme",
        "facebookPageId": "123456789012345"
      },
      "landingPage": {
        "url": "https://example.com/products/summer-sale",
        "technologies": [
          {
            "id": "04504d0b-df46-4f62-98b6-d4d9e14a2282",
            "name": "Shopify",
            "iconUrl": "https://cdn.example.com/technology_icons/shopify.svg"
          }
        ],
        "screenshots": {
          "desktop": "https://cdn.example.com/screenshots/landing-page-full.png",
          "mobile": "https://cdn.example.com/screenshots/landing-page-mobile.png",
          "head": "https://cdn.example.com/screenshots/landing-page-head.png"
        }
      },
      "metrics": {
        "usageCount": 16,
        "longestRunning": 41,
        "totalImpressions": 305400
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 128,
    "totalPages": 7
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
| `brandtracker` | `object` | Yes |  |
| `landingPage` | `object` | Yes |  |
| `metrics` | `object` | Yes |  |

**`brandtracker` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes | Public brandtracker identifier backed by brandtracker.id. Legacy spyders.uuid values are accepted when migration metadata exists. |
| `name` | `string` | Yes |  |
| `facebookPageId` | `string` | Yes | Facebook page id associated with this workspace brandtracker. |

**`landingPage` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `url` | `string` | Yes |  |
| `technologies` | `object`[] | Yes |  |
| `screenshots` | `object` | Yes |  |

**`technologies[]` item properties:**


**`screenshots` properties:**


**`metrics` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `usageCount` | `number` | Yes |  |
| `longestRunning` | `number` | Yes |  |
| `totalImpressions` | `number` | Yes |  |

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

# Get workspace scaling ads compatibility data

`GET /v1/workspace/scaling-ads`

Legacy compatibility endpoint for clients that still call /workspace/scaling-ads. Prefer /v1/workspace/top-ads?sortBy=rankDelta7d, rankDelta14d, or rankDelta30d for canonical rank movers and sortBy=currentRank for current ranking. Endpoint key, billing, and response envelope remain stable; period and snapshotDate are deprecated and ignored on the ES-backed path, and trajectory may be empty. One credit is charged per returned row.

**Tags:** Workspace

## Parameters

**Query parameter groups:**

- Pagination: `page`, `limit`
- Time and snapshots: `period`, `snapshotDate`
- Sorting: `sortBy`
- Filters: `brandtrackerIds`, `folderIds`, `euOnly`, `maxCurrentRank`, `minRankDelta`

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `page` | query | No | `integer` |  |
| `limit` | query | No | `integer` | Maximum number of workspace aggregate rows to return. Must be <= 100. |
| `brandtrackerIds` | query | No | `string`[] | Optional comma-separated or repeated public brandtracker ids. |
| `folderIds` | query | No | `integer`[] | Optional comma-separated or repeated workspace brandtracker folder ids. |
| `euOnly` | query | No | `boolean` | Optional EU-only filter. When true, only EU-classified Facebook ads are included. |
| `period` | query | No | `today` \| `yesterday` \| `last1d` \| `last7d` \| `last14d` \| `last30d` \| `total` | Optional rolling period for workspace scaling ads. Allowed values: today, yesterday, last1d, last7d, last14d, last30d, total. |
| `snapshotDate` | query | No | `object` | Deprecated compatibility parameter accepted but ignored on the ES-backed workspace scaling compatibility path. Use freshness/system endpoints for snapshot availability checks. |
| `sortBy` | query | No | `rankDelta` \| `currentRank` \| `rank_delta` \| `current_rank` |  |
| `maxCurrentRank` | query | No | `integer` |  |
| `minRankDelta` | query | No | `integer` |  |

## Responses

### 200 - Paginated workspace scaling ads response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": [
    {
      "brandtracker": {
        "id": "1e08fa85-625a-4ba5-b673-d2a4b7bc7c55",
        "name": "Acme",
        "facebookPageId": "123456789012345"
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
      },
      "metrics": {
        "currentRank": 4,
        "previousRank": 17,
        "rankDelta": 13,
        "improvementPct": 76.5
      },
      "trajectory": [
        {
          "date": "2026-04-20",
          "rank": 4,
          "totalAds": 250
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 128,
    "totalPages": 7
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
| `brandtracker` | `object` | Yes |  |
| `ad` | `object` | Yes |  |
| `metrics` | `object` | Yes |  |
| `trajectory` | `object`[] | Yes |  |

**`brandtracker` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes | Public brandtracker identifier backed by brandtracker.id. Legacy spyders.uuid values are accepted when migration metadata exists. |
| `name` | `string` | Yes |  |
| `facebookPageId` | `string` | Yes | Facebook page id associated with this workspace brandtracker. |

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


**`metrics` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `currentRank` | `number` | Yes |  |
| `previousRank` | `number` | Yes |  |
| `rankDelta` | `number` | Yes | Positive rank improvement over the selected comparison window. |
| `improvementPct` | `object` | Yes | Percentage improvement from previousRank to currentRank over the selected comparison window. |

**`trajectory[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `date` | `string` | Yes | Trajectory point date in YYYY-MM-DD format. |
| `rank` | `number` | Yes |  |
| `totalAds` | `object` | Yes | Estimated total ranked ads for this snapshot when available. |

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

# Get workspace media mix

`GET /v1/workspace/media-mix`

Returns media mix rows across active workspace brandtrackers in one metered request. One credit is charged per returned row.

**Tags:** Workspace

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `page` | query | No | `integer` |  |
| `limit` | query | No | `integer` | Maximum number of workspace aggregate rows to return. Must be <= 100. |
| `brandtrackerIds` | query | No | `string`[] | Optional comma-separated or repeated public brandtracker ids. |
| `folderIds` | query | No | `integer`[] | Optional comma-separated or repeated workspace brandtracker folder ids. |
| `euOnly` | query | No | `boolean` | Optional EU-only filter. When true, only EU-classified Facebook ads are included. |
| `sortBy` | query | No | `activeAds` \| `image` \| `video` \| `dco` \| `other` |  |

## Responses

### 200 - Paginated workspace media mix response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": [
    {
      "brandtracker": {
        "id": "1e08fa85-625a-4ba5-b673-d2a4b7bc7c55",
        "name": "Acme",
        "facebookPageId": "123456789012345"
      },
      "mediaMix": {
        "formatCount": {
          "image": 12,
          "video": 8,
          "dco": 2,
          "other": 1
        }
      },
      "metrics": {
        "activeAds": 23
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 128,
    "totalPages": 7
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
| `brandtracker` | `object` | Yes |  |
| `mediaMix` | `object` | Yes |  |
| `metrics` | `object` | Yes |  |

**`brandtracker` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes | Public brandtracker identifier backed by brandtracker.id. Legacy spyders.uuid values are accepted when migration metadata exists. |
| `name` | `string` | Yes |  |
| `facebookPageId` | `string` | Yes | Facebook page id associated with this workspace brandtracker. |

**`mediaMix` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `formatCount` | `object` | Yes | Workspace media mix exposes image, video, dco, and other only. Carousel is not available as a separate bucket. |

**`formatCount` properties:**


**`metrics` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `activeAds` | `number` | Yes |  |

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
