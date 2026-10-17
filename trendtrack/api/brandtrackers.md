# Brandtrackers

---

# Create a brandtracker

`POST /v1/brandtrackers`

Creates or reactivates a workspace brandtracker by exactly one target identifier: facebookPageId, websiteId, shopId (alias of websiteId), or domain. Domains are normalized and must resolve to exactly one known website. State-changing create/reactivate requests consume one brandtracker create/delete quota unit and one active brandtracker slot; already-active no-ops return 200 and cost 0 units.

**Tags:** Brandtrackers

## Request Body

**Content-Type:** `application/json`

```json
{
  "facebookPageId": "61554990830184",
  "websiteId": "3d6fd2f0-5b34-4ffc-91ff-f59775544e5f",
  "shopId": "3d6fd2f0-5b34-4ffc-91ff-f59775544e5f",
  "domain": "examplebrand.com",
  "folderId": 42
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `facebookPageId` | `string` | No | Meta/Facebook page identifier to track. Exactly one of facebookPageId, websiteId, shopId, or domain is required. |
| `websiteId` | `string` | No | Website/shop identifier to track as a shop-level brandtracker. Exactly one target identifier is accepted. |
| `shopId` | `string` | No | Alias of websiteId for shop-oriented clients. Exactly one target identifier is accepted. |
| `domain` | `string` | No | Shop domain to resolve to exactly one known website and track as a shop-level brandtracker. Protocols, paths, and a leading www. are normalized away. |
| `folderId` | `number` | No | Workspace brandtracker folder id. Null or omitted attaches the brandtracker at root. |

## Responses

### 200 - Brandtracker creation response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": {
    "id": "1e08fa85-625a-4ba5-b673-d2a4b7bc7c55",
    "name": "Example Brand",
    "facebookPageId": "61554990830184",
    "workspaceLinkId": 99,
    "targetType": "shop",
    "websiteId": "3d6fd2f0-5b34-4ffc-91ff-f59775544e5f",
    "domain": "examplebrand.com",
    "avatarUrl": "https://medias.trendtrack.io/profile_picture/61554990830184.jpg",
    "status": {
      "isLoaded": true,
      "lastCrawledAt": "2026-04-20T10:00:00.000Z"
    },
    "workspaceAddedAt": "2026-04-15T09:00:00.000Z",
    "folder": {
      "id": 42,
      "name": "Competitors"
    },
    "advertising": {
      "activeAds": 18,
      "newAdsLastDay": 3,
      "newAdsLast7Days": 11,
      "newAdsLast30Days": 34
    },
    "websites": [
      {
        "id": "3d6fd2f0-5b34-4ffc-91ff-f59775544e5f",
        "domain": "examplebrand.com",
        "siteName": "Example Brand",
        "trafficNumber": 145230,
        "trafficChange": 12.4,
        "monthlyTraffic": {
          "2026-01": 102343,
          "2026-02": 114230
        },
        "socialNetworks": {
          "facebook": "https://facebook.com/examplebrand",
          "instagram": "https://instagram.com/examplebrand",
          "youtube": "https://youtube.com/@examplebrand"
        }
      }
    ],
    "totalTraffic": 145230
  },
  "created": true
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `data` | `object` | Yes |  |
| `created` | `boolean` | Yes | True when this call created or reactivated a workspace brandtracker; false when an active link already existed. |

**`data` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes | Public brandtracker identifier backed by brandtracker.id. Legacy spyders.uuid values are accepted when migration metadata exists. |
| `name` | `string` | Yes |  |
| `facebookPageId` | `string` | Yes |  |
| `workspaceLinkId` | `number` | No | Workspace link identifier. Present on mutation responses and useful for follow-up move/delete operations. |
| `targetType` | `shop` \| `page` | No | Resolved tracked target type. Present on mutation responses. |
| `websiteId` | `string` | No | Resolved website/shop identifier when the brandtracker target is shop-level. |
| `domain` | `string` | No | Resolved canonical domain when the brandtracker target is shop-level. |
| `avatarUrl` | `string` | Yes |  |
| `status` | `object` | Yes |  |
| `workspaceAddedAt` | `string` | Yes |  |
| `folder` | `object` | Yes | Primary folder membership, ordered by folder rank, name, then id. Null when the tracked brand has no folder memberships. |
| `advertising` | `object` | Yes |  |
| `websites` | `object`[] | Yes |  |
| `totalTraffic` | `number` | Yes |  |

**`status` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `isLoaded` | `boolean` | Yes |  |
| `lastCrawledAt` | `string` | Yes |  |

**`folder` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `number` | Yes |  |
| `name` | `string` | Yes |  |

**`advertising` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `activeAds` | `number` | Yes |  |
| `newAdsLastDay` | `number` | Yes |  |
| `newAdsLast7Days` | `number` | Yes |  |
| `newAdsLast30Days` | `number` | Yes |  |

**`websites[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes |  |
| `domain` | `string` | Yes |  |
| `siteName` | `string` | Yes |  |
| `trafficNumber` | `number` | Yes |  |
| `trafficChange` | `number` | Yes |  |
| `monthlyTraffic` | `object` | Yes |  |
| `socialNetworks` | `object` | Yes |  |

**`socialNetworks` properties:**


### 201 - Brandtracker created or reactivated. Already-active idempotent calls return 200 with created=false.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": {
    "id": "1e08fa85-625a-4ba5-b673-d2a4b7bc7c55",
    "name": "Example Brand",
    "facebookPageId": "61554990830184",
    "workspaceLinkId": 99,
    "targetType": "shop",
    "websiteId": "3d6fd2f0-5b34-4ffc-91ff-f59775544e5f",
    "domain": "examplebrand.com",
    "avatarUrl": "https://medias.trendtrack.io/profile_picture/61554990830184.jpg",
    "status": {
      "isLoaded": true,
      "lastCrawledAt": "2026-04-20T10:00:00.000Z"
    },
    "workspaceAddedAt": "2026-04-15T09:00:00.000Z",
    "folder": {
      "id": 42,
      "name": "Competitors"
    },
    "advertising": {
      "activeAds": 18,
      "newAdsLastDay": 3,
      "newAdsLast7Days": 11,
      "newAdsLast30Days": 34
    },
    "websites": [
      {
        "id": "3d6fd2f0-5b34-4ffc-91ff-f59775544e5f",
        "domain": "examplebrand.com",
        "siteName": "Example Brand",
        "trafficNumber": 145230,
        "trafficChange": 12.4,
        "monthlyTraffic": {
          "2026-01": 102343,
          "2026-02": 114230
        },
        "socialNetworks": {
          "facebook": "https://facebook.com/examplebrand",
          "instagram": "https://instagram.com/examplebrand",
          "youtube": "https://youtube.com/@examplebrand"
        }
      }
    ],
    "totalTraffic": 145230
  },
  "created": true
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `data` | `object` | Yes |  |
| `created` | `boolean` | Yes | True when this call created or reactivated a workspace brandtracker; false when an active link already existed. |

**`data` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes | Public brandtracker identifier backed by brandtracker.id. Legacy spyders.uuid values are accepted when migration metadata exists. |
| `name` | `string` | Yes |  |
| `facebookPageId` | `string` | Yes |  |
| `workspaceLinkId` | `number` | No | Workspace link identifier. Present on mutation responses and useful for follow-up move/delete operations. |
| `targetType` | `shop` \| `page` | No | Resolved tracked target type. Present on mutation responses. |
| `websiteId` | `string` | No | Resolved website/shop identifier when the brandtracker target is shop-level. |
| `domain` | `string` | No | Resolved canonical domain when the brandtracker target is shop-level. |
| `avatarUrl` | `string` | Yes |  |
| `status` | `object` | Yes |  |
| `workspaceAddedAt` | `string` | Yes |  |
| `folder` | `object` | Yes | Primary folder membership, ordered by folder rank, name, then id. Null when the tracked brand has no folder memberships. |
| `advertising` | `object` | Yes |  |
| `websites` | `object`[] | Yes |  |
| `totalTraffic` | `number` | Yes |  |

**`status` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `isLoaded` | `boolean` | Yes |  |
| `lastCrawledAt` | `string` | Yes |  |

**`folder` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `number` | Yes |  |
| `name` | `string` | Yes |  |

**`advertising` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `activeAds` | `number` | Yes |  |
| `newAdsLastDay` | `number` | Yes |  |
| `newAdsLast7Days` | `number` | Yes |  |
| `newAdsLast30Days` | `number` | Yes |  |

**`websites[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes |  |
| `domain` | `string` | Yes |  |
| `siteName` | `string` | Yes |  |
| `trafficNumber` | `number` | Yes |  |
| `trafficChange` | `number` | Yes |  |
| `monthlyTraffic` | `object` | Yes |  |
| `socialNetworks` | `object` | Yes |  |

**`socialNetworks` properties:**


### 400 - Invalid mutation request. Possible error codes: validation_failed, bad_request. Create accepts exactly one of facebookPageId, websiteId, shopId, or domain; destructive folder/workspace-link deletes require confirm: true.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
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

### 402 - `quota_exhausted`: every tracked-brand slot of the plan is taken. A removed brand keeps its slot for 24h, so `details.reservedByCooldown` slots may be held by recent removals; `details.nextSlotAvailableAt` says when one frees.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "quota_exhausted",
    "message": "string",
    "requestId": "string",
    "details": {
      "feature": "brandtracker_v3",
      "limit": 10,
      "used": 10,
      "reservedByCooldown": 2,
      "nextSlotAvailableAt": "2026-09-26T09:30:00.000Z",
      "currentUsage": 10,
      "maxLimit": 10
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `quota_exhausted` | Yes |  |
| `message` | `string` | Yes |  |
| `requestId` | `string` | Yes |  |
| `details` | `object` | Yes |  |

**`details` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `feature` | `string` | Yes |  |
| `limit` | `number` | Yes | Tracked-brand slots of the plan, add-ons included. |
| `used` | `number` | Yes | Slots taken: active tracked brands plus slots held by a cooldown. |
| `reservedByCooldown` | `number` | Yes | Slots still held for 24h after a tracked brand was removed. |
| `nextSlotAvailableAt` | `string` | Yes | When a cooldown ending frees a slot; null when only removing a brand (its slot frees 24h later) or upgrading helps. |
| `currentUsage` | `number` | Yes | Same as `used`. |
| `maxLimit` | `number` | Yes | Same as `limit`. |

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

### 404 - Workspace-owned folder, brandtracker, workspace link, page, or domain target was not found. Cross-workspace ids are reported safely as not found.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |

### 409 - Create target could not be resolved uniquely. Possible error code: ambiguous_target for domain aliases that match multiple websites.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |

### 429 - The Pro plan persistent brandtracker create/delete mutation quota is exhausted. Business and Agency plans have no create/delete mutation quota. Response includes Retry-After, RateLimit-Limit, RateLimit-Remaining: 0, and X-RateLimit-Window: utc_day. Active brandtracker allowance exhaustion is returned before any state change.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
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

# List brandtrackers

`GET /v1/brandtrackers`

Returns the workspace-scoped active brandtrackers attached to the authenticated public API workspace. The public identifier is brandtracker.id; legacy spyders.uuid values are accepted when migration metadata exists.

**Tags:** Brandtrackers

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `page` | query | No | `integer` |  |
| `limit` | query | No | `integer` |  |
| `hasNewAdsSince` | query | No | `string` | ISO date/time lower bound. Returns brandtrackers with positive new-ad deltas recorded on or after this timestamp. |
| `name` | query | No | `string` | Case-insensitive contains match against brandtracker name. |
| `sortBy` | query | No | `newAdsLastDay` \| `newAdsLast7Days` \| `newAdsLast30Days` \| `activeAds` \| `totalTraffic` \| `name` \| `createdAt` | Sort key. Metric and createdAt sorts are descending; name sorts ascending. Omit to preserve default workspace ordering. |
| `folderIds` | query | No | `integer`[] | Folder ids. Repeated query params and comma-separated values are both accepted. |
| `folderNames` | query | No | `string`[] | Folder name search terms. Matches are case-insensitive contains checks. Repeated query params and comma-separated values are both accepted. |

## Responses

### 200 - Paginated brandtrackers response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": [
    {
      "id": "1e08fa85-625a-4ba5-b673-d2a4b7bc7c55",
      "name": "Example Brand",
      "facebookPageId": "61554990830184",
      "workspaceLinkId": 99,
      "targetType": "shop",
      "websiteId": "3d6fd2f0-5b34-4ffc-91ff-f59775544e5f",
      "domain": "examplebrand.com",
      "avatarUrl": "https://medias.trendtrack.io/profile_picture/61554990830184.jpg",
      "status": {
        "isLoaded": true,
        "lastCrawledAt": "2026-04-20T10:00:00.000Z"
      },
      "workspaceAddedAt": "2026-04-15T09:00:00.000Z",
      "folder": {
        "id": 42,
        "name": "Competitors"
      },
      "advertising": {
        "activeAds": 18,
        "newAdsLastDay": 3,
        "newAdsLast7Days": 11,
        "newAdsLast30Days": 34
      },
      "websites": [
        {
          "id": "3d6fd2f0-5b34-4ffc-91ff-f59775544e5f",
          "domain": "examplebrand.com",
          "siteName": "Example Brand",
          "trafficNumber": 145230,
          "trafficChange": 12.4,
          "monthlyTraffic": {
            "2026-01": 102343,
            "2026-02": 114230
          },
          "socialNetworks": {
            "facebook": "https://facebook.com/examplebrand",
            "instagram": "https://instagram.com/examplebrand",
            "youtube": "https://youtube.com/@examplebrand"
          }
        }
      ],
      "totalTraffic": 145230
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 128,
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
| `id` | `string` | Yes | Public brandtracker identifier backed by brandtracker.id. Legacy spyders.uuid values are accepted when migration metadata exists. |
| `name` | `string` | Yes |  |
| `facebookPageId` | `string` | Yes |  |
| `workspaceLinkId` | `number` | No | Workspace link identifier. Present on mutation responses and useful for follow-up move/delete operations. |
| `targetType` | `shop` \| `page` | No | Resolved tracked target type. Present on mutation responses. |
| `websiteId` | `string` | No | Resolved website/shop identifier when the brandtracker target is shop-level. |
| `domain` | `string` | No | Resolved canonical domain when the brandtracker target is shop-level. |
| `avatarUrl` | `string` | Yes |  |
| `status` | `object` | Yes |  |
| `workspaceAddedAt` | `string` | Yes |  |
| `folder` | `object` | Yes | Primary folder membership, ordered by folder rank, name, then id. Null when the tracked brand has no folder memberships. |
| `advertising` | `object` | Yes |  |
| `websites` | `object`[] | Yes |  |
| `totalTraffic` | `number` | Yes |  |

**`status` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `isLoaded` | `boolean` | Yes |  |
| `lastCrawledAt` | `string` | Yes |  |

**`folder` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `number` | Yes |  |
| `name` | `string` | Yes |  |

**`advertising` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `activeAds` | `number` | Yes |  |
| `newAdsLastDay` | `number` | Yes |  |
| `newAdsLast7Days` | `number` | Yes |  |
| `newAdsLast30Days` | `number` | Yes |  |

**`websites[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes |  |
| `domain` | `string` | Yes |  |
| `siteName` | `string` | Yes |  |
| `trafficNumber` | `number` | Yes |  |
| `trafficChange` | `number` | Yes |  |
| `monthlyTraffic` | `object` | Yes |  |
| `socialNetworks` | `object` | Yes |  |

**`socialNetworks` properties:**


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

# Create a brandtracker folder

`POST /v1/brandtrackers/folders`

Creates a workspace brandtracker folder and assigns the next rank atomically. Folder mutations are workspace-scoped, metered, and audited.

**Tags:** Brandtrackers

## Request Body

**Content-Type:** `application/json`

```json
{
  "name": "Competitors"
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | Yes | Workspace-scoped folder name. Rank is assigned atomically as the next workspace rank. |

## Responses

### 200 - Brandtracker folder creation response.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": {
    "id": 12,
    "name": "Competitors",
    "rank": 1,
    "brandtrackerCount": 8
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
| `id` | `number` | Yes |  |
| `name` | `string` | Yes |  |
| `rank` | `number` | Yes |  |
| `brandtrackerCount` | `number` | Yes | Number of active brandtrackers currently assigned to this folder. |

### 201 - Brandtracker folder created.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": {
    "id": 12,
    "name": "Competitors",
    "rank": 1,
    "brandtrackerCount": 8
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
| `id` | `number` | Yes |  |
| `name` | `string` | Yes |  |
| `rank` | `number` | Yes |  |
| `brandtrackerCount` | `number` | Yes | Number of active brandtrackers currently assigned to this folder. |

### 400 - Invalid mutation request. Possible error codes: validation_failed, bad_request. Create accepts exactly one of facebookPageId, websiteId, shopId, or domain; destructive folder/workspace-link deletes require confirm: true.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
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

### 404 - Workspace-owned folder, brandtracker, workspace link, page, or domain target was not found. Cross-workspace ids are reported safely as not found.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
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

# List brandtracker folders

`GET /v1/brandtrackers/folders`

Returns the active workspace brandtracker folders so clients can resolve folder ids for brandtracker filters. Equivalent folder listing is also available at GET /v1/workspace/folders.

**Tags:** Brandtrackers

## Responses

### 200 - Brandtracker folders. The response also includes the X-Request-Id header.

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

# Rename a brandtracker folder

`PATCH /v1/brandtrackers/folders/{folderId}`

Renames a workspace brandtracker folder. The folder id must belong to the authenticated workspace; cross-workspace ids are returned as not found before any state change.

**Tags:** Brandtrackers

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `folderId` | path | Yes | `integer` |  |

## Request Body

**Content-Type:** `application/json`

```json
{
  "name": "Priority Competitors"
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | Yes | New workspace-scoped folder name. |

## Responses

### 200 - Brandtracker folder rename response.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": {
    "id": 12,
    "name": "Competitors",
    "rank": 1,
    "brandtrackerCount": 8
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
| `id` | `number` | Yes |  |
| `name` | `string` | Yes |  |
| `rank` | `number` | Yes |  |
| `brandtrackerCount` | `number` | Yes | Number of active brandtrackers currently assigned to this folder. |

### 400 - Invalid mutation request. Possible error codes: validation_failed, bad_request. Create accepts exactly one of facebookPageId, websiteId, shopId, or domain; destructive folder/workspace-link deletes require confirm: true.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
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

### 404 - Workspace-owned folder, brandtracker, workspace link, page, or domain target was not found. Cross-workspace ids are reported safely as not found.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
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

# Delete a brandtracker folder

`DELETE /v1/brandtrackers/folders/{folderId}`

Deletes a workspace folder. move-to-default moves active brandtrackers to root; delete-brandtrackers deactivates affected workspace links. confirm must be true. The delete-brandtrackers action consumes one persistent brandtracker create/delete quota operation for the whole folder and decrements active brandtracker usage by the affected active-link count; no partial mutation is committed when quota is exhausted.

**Tags:** Brandtrackers

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `folderId` | path | Yes | `integer` |  |

## Request Body

**Content-Type:** `application/json`

```json
{
  "action": "move-to-default",
  "confirm": true
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `action` | `move-to-default` \| `delete-brandtrackers` | Yes | move-to-default keeps affected trackers active and clears their folder. delete-brandtrackers deactivates affected active workspace links, consumes one persistent create/delete quota unit for the whole folder delete, and decrements active brandtracker usage by affectedCount. |
| `confirm` | `boolean` | Yes | Must be true for destructive folder delete requests. |

## Responses

### 200 - Brandtracker folder delete response.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": {
    "deleted": true,
    "action": "move-to-default",
    "affectedCount": 12
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
| `action` | `move-to-default` \| `delete-brandtrackers` | Yes |  |
| `affectedCount` | `number` | Yes | Number of active workspace links moved to root or deactivated by the folder delete action. |

### 400 - Invalid mutation request. Possible error codes: validation_failed, bad_request. Create accepts exactly one of facebookPageId, websiteId, shopId, or domain; destructive folder/workspace-link deletes require confirm: true.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
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

### 404 - Workspace-owned folder, brandtracker, workspace link, page, or domain target was not found. Cross-workspace ids are reported safely as not found.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |

### 429 - The Pro plan persistent brandtracker create/delete mutation quota is exhausted. Business and Agency plans have no create/delete mutation quota. Response includes Retry-After, RateLimit-Limit, RateLimit-Remaining: 0, and X-RateLimit-Window: utc_day. Active brandtracker allowance exhaustion is returned before any state change.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
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

# Replace brandtracker folder memberships

`PATCH /v1/brandtrackers/workspace-links`

Moves active workspace brandtracker links by exactly one address set: brandtrackerIds or workspaceLinkIds. The destination folder id must belong to the authenticated workspace; null moves links to root. Move operations are metered and audited but do not consume persistent create/delete quota or change active brandtracker usage.

**Tags:** Brandtrackers

## Request Body

**Content-Type:** `application/json`

```json
{
  "brandtrackerIds": [
    "string"
  ],
  "workspaceLinkIds": [
    0
  ],
  "folderId": 42
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `brandtrackerIds` | `string`[] | No | Public brandtracker ids to move. Exactly one of brandtrackerIds or workspaceLinkIds is required. |
| `workspaceLinkIds` | `number`[] | No | Workspace link ids to move. Exactly one of brandtrackerIds or workspaceLinkIds is required. |
| `folderId` | `number` | Yes | Destination workspace folder id, or null to move to root. |

## Responses

### 200 - Brandtracker workspace-link move response.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": {
    "requestedCount": 3,
    "affectedCount": 2,
    "notFoundBrandtrackerIds": [
      "string"
    ],
    "notFoundWorkspaceLinkIds": [
      0
    ],
    "cooldownUntil": "2026-09-26T09:30:00.000Z"
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
| `requestedCount` | `number` | Yes | Deduplicated number of requested ids in the submitted address set. |
| `affectedCount` | `number` | Yes | Number of active workspace links changed. Cross-workspace, inactive, or unknown ids are excluded and reported as not found where safe. |
| `notFoundBrandtrackerIds` | `string`[] | No | Requested public brandtracker ids that did not resolve to active links in this workspace. |
| `notFoundWorkspaceLinkIds` | `number`[] | No | Requested workspace link ids that did not resolve to active links in this workspace. |
| `cooldownUntil` | `string` | No | Removals only: the removed brands keep their slots until this time (24h cooldown). |

### 400 - Invalid mutation request. Possible error codes: validation_failed, bad_request. Create accepts exactly one of facebookPageId, websiteId, shopId, or domain; destructive folder/workspace-link deletes require confirm: true.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
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

### 404 - Workspace-owned folder, brandtracker, workspace link, page, or domain target was not found. Cross-workspace ids are reported safely as not found.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
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

# Bulk delete brandtracker workspace links

`DELETE /v1/brandtrackers/workspace-links`

Deactivates active workspace brandtracker links by exactly one address set: brandtrackerIds or workspaceLinkIds. confirm must be true. Bulk delete consumes one persistent brandtracker create/delete quota operation for the request, reports requested/affected/not-found ids, and decrements active brandtracker usage by the affected active-link count.

**Tags:** Brandtrackers

## Request Body

**Content-Type:** `application/json`

```json
{
  "brandtrackerIds": [
    "string"
  ],
  "workspaceLinkIds": [
    0
  ],
  "confirm": true
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `brandtrackerIds` | `string`[] | No | Public brandtracker ids to delete. Exactly one of brandtrackerIds or workspaceLinkIds is required. |
| `workspaceLinkIds` | `number`[] | No | Workspace link ids to delete. Exactly one of brandtrackerIds or workspaceLinkIds is required. |
| `confirm` | `boolean` | Yes | Must be true for destructive bulk delete requests. |

## Responses

### 200 - Brandtracker workspace-link delete response.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": {
    "requestedCount": 3,
    "affectedCount": 2,
    "notFoundBrandtrackerIds": [
      "string"
    ],
    "notFoundWorkspaceLinkIds": [
      0
    ],
    "cooldownUntil": "2026-09-26T09:30:00.000Z"
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
| `requestedCount` | `number` | Yes | Deduplicated number of requested ids in the submitted address set. |
| `affectedCount` | `number` | Yes | Number of active workspace links changed. Cross-workspace, inactive, or unknown ids are excluded and reported as not found where safe. |
| `notFoundBrandtrackerIds` | `string`[] | No | Requested public brandtracker ids that did not resolve to active links in this workspace. |
| `notFoundWorkspaceLinkIds` | `number`[] | No | Requested workspace link ids that did not resolve to active links in this workspace. |
| `cooldownUntil` | `string` | No | Removals only: the removed brands keep their slots until this time (24h cooldown). |

### 400 - Invalid mutation request. Possible error codes: validation_failed, bad_request. Create accepts exactly one of facebookPageId, websiteId, shopId, or domain; destructive folder/workspace-link deletes require confirm: true.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
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

### 404 - Workspace-owned folder, brandtracker, workspace link, page, or domain target was not found. Cross-workspace ids are reported safely as not found.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |

### 429 - The Pro plan persistent brandtracker create/delete mutation quota is exhausted. Business and Agency plans have no create/delete mutation quota. Response includes Retry-After, RateLimit-Limit, RateLimit-Remaining: 0, and X-RateLimit-Window: utc_day. Active brandtracker allowance exhaustion is returned before any state change.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
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

# Delete a brandtracker

`DELETE /v1/brandtrackers/{brandtrackerId}`

Marks the workspace brandtracker inactive while preserving the workspace link and workspace-scoped metadata for reconstructability/reactivation. The shared global brandtracker row is preserved.

**Tags:** Brandtrackers

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `brandtrackerId` | path | Yes | `string` | Public brandtracker identifier backed by brandtracker.id. Legacy spyders.uuid values are accepted when migration metadata exists. |

## Responses

### 200 - Brandtracker delete response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": {
    "id": "1e08fa85-625a-4ba5-b673-d2a4b7bc7c55",
    "deleted": true,
    "cooldownUntil": "2026-09-26T09:30:00.000Z"
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
| `id` | `string` | Yes | Public brandtracker identifier backed by brandtracker.id. Legacy spyders.uuid values are accepted when migration metadata exists. |
| `deleted` | `boolean` | Yes |  |
| `cooldownUntil` | `string` | Yes | The removed brand keeps its tracked-brand slot until this time (24h cooldown); the slot still counts against the plan limit, and re-adding the same brand before then reuses it. |

### 400 - Invalid mutation request. Possible error codes: validation_failed, bad_request. Create accepts exactly one of facebookPageId, websiteId, shopId, or domain; destructive folder/workspace-link deletes require confirm: true.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
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

### 404 - Workspace-owned folder, brandtracker, workspace link, page, or domain target was not found. Cross-workspace ids are reported safely as not found.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `error` | `object` | Yes |  |

**`error` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | `string` | Yes | Stable public error code. |
| `message` | `string` | Yes | Human-readable error message. |
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `details` | `object` | No | Optional structured details, such as validation errors or credit availability metadata. |

### 429 - The Pro plan persistent brandtracker create/delete mutation quota is exhausted. Business and Agency plans have no create/delete mutation quota. Response includes Retry-After, RateLimit-Limit, RateLimit-Remaining: 0, and X-RateLimit-Window: utc_day. Active brandtracker allowance exhaustion is returned before any state change.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
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

# Get a brandtracker

`GET /v1/brandtrackers/{brandtrackerId}`

Returns the detail payload for one active workspace brandtracker resolved from brandtracker.id.

**Tags:** Brandtrackers

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `brandtrackerId` | path | Yes | `string` | Public brandtracker identifier backed by brandtracker.id. Legacy spyders.uuid values are accepted when migration metadata exists. |

## Responses

### 200 - Brandtracker detail response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": {
    "id": "1e08fa85-625a-4ba5-b673-d2a4b7bc7c55",
    "name": "Example Brand",
    "facebookPageId": "61554990830184",
    "workspaceLinkId": 99,
    "targetType": "shop",
    "websiteId": "3d6fd2f0-5b34-4ffc-91ff-f59775544e5f",
    "domain": "examplebrand.com",
    "avatarUrl": "https://medias.trendtrack.io/profile_picture/61554990830184.jpg",
    "status": {
      "isLoaded": true,
      "lastCrawledAt": "2026-04-20T10:00:00.000Z"
    },
    "workspaceAddedAt": "2026-04-15T09:00:00.000Z",
    "folder": {
      "id": 42,
      "name": "Competitors"
    },
    "advertising": {
      "activeAds": 18,
      "newAdsLastDay": 3,
      "newAdsLast7Days": 11,
      "newAdsLast30Days": 34
    },
    "websites": [
      {
        "id": "3d6fd2f0-5b34-4ffc-91ff-f59775544e5f",
        "domain": "examplebrand.com",
        "siteName": "Example Brand",
        "trafficNumber": 145230,
        "trafficChange": 12.4,
        "monthlyTraffic": {
          "2026-01": 102343,
          "2026-02": 114230
        },
        "socialNetworks": {
          "facebook": "https://facebook.com/examplebrand",
          "instagram": "https://instagram.com/examplebrand",
          "youtube": "https://youtube.com/@examplebrand"
        }
      }
    ],
    "totalTraffic": 145230,
    "createdAt": "2026-04-01T12:00:00.000Z",
    "updatedAt": "2026-04-21T09:30:00.000Z",
    "pageProfile": {
      "about": "Global fashion brand",
      "category": "Clothing (Brand)",
      "facebookLikes": 523400,
      "instagramFollowers": 841200,
      "instagramUsername": "examplebrand",
      "profileUri": "https://www.facebook.com/examplebrand",
      "runningAds": 18
    },
    "statistics": {
      "urlCount": {
        "https://examplebrand.com/products/hero": 14
      },
      "ctaCount": {
        "SHOP_NOW": 10,
        "LEARN_MORE": 4
      },
      "liveAdCount": {
        "activeCount": 18,
        "inactiveCount": 4
      },
      "formatCount": {
        "IMAGE": 8,
        "VIDEO": 10
      },
      "euData": null
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
| `id` | `string` | Yes | Public brandtracker identifier backed by brandtracker.id. Legacy spyders.uuid values are accepted when migration metadata exists. |
| `name` | `string` | Yes |  |
| `facebookPageId` | `string` | Yes |  |
| `workspaceLinkId` | `number` | No | Workspace link identifier. Present on mutation responses and useful for follow-up move/delete operations. |
| `targetType` | `shop` \| `page` | No | Resolved tracked target type. Present on mutation responses. |
| `websiteId` | `string` | No | Resolved website/shop identifier when the brandtracker target is shop-level. |
| `domain` | `string` | No | Resolved canonical domain when the brandtracker target is shop-level. |
| `avatarUrl` | `string` | Yes |  |
| `status` | `object` | Yes |  |
| `workspaceAddedAt` | `string` | Yes |  |
| `folder` | `object` | Yes | Primary folder membership, ordered by folder rank, name, then id. Null when the tracked brand has no folder memberships. |
| `advertising` | `object` | Yes |  |
| `websites` | `object`[] | Yes |  |
| `totalTraffic` | `number` | Yes |  |
| `createdAt` | `string` | Yes |  |
| `updatedAt` | `string` | Yes |  |
| `pageProfile` | `object` | Yes |  |
| `statistics` | `object` | Yes |  |

**`status` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `isLoaded` | `boolean` | Yes |  |
| `lastCrawledAt` | `string` | Yes |  |

**`folder` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `number` | Yes |  |
| `name` | `string` | Yes |  |

**`advertising` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `activeAds` | `number` | Yes |  |
| `newAdsLastDay` | `number` | Yes |  |
| `newAdsLast7Days` | `number` | Yes |  |
| `newAdsLast30Days` | `number` | Yes |  |

**`websites[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes |  |
| `domain` | `string` | Yes |  |
| `siteName` | `string` | Yes |  |
| `trafficNumber` | `number` | Yes |  |
| `trafficChange` | `number` | Yes |  |
| `monthlyTraffic` | `object` | Yes |  |
| `socialNetworks` | `object` | Yes |  |

**`socialNetworks` properties:**


**`pageProfile` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `about` | `string` | Yes |  |
| `category` | `string` | Yes |  |
| `facebookLikes` | `number` | Yes |  |
| `instagramFollowers` | `number` | Yes |  |
| `instagramUsername` | `string` | Yes |  |
| `profileUri` | `string` | Yes |  |
| `runningAds` | `number` | Yes |  |

**`statistics` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `urlCount` | `object` | Yes |  |
| `ctaCount` | `object` | Yes |  |
| `liveAdCount` | `object` | Yes |  |
| `formatCount` | `object` | Yes |  |
| `euData` | `object` | Yes |  |

**`liveAdCount` properties:**


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

### 404 - No active workspace brandtracker matches the requested id.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
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

# List brandtrackers in a folder

`GET /v1/brandtrackers/folders/{folderId}/brandtrackers`

Returns the workspace-scoped active brandtrackers assigned to the requested folder. This is equivalent to /v1/brandtrackers?folderIds=:folderId.

**Tags:** Brandtrackers

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `folderId` | path | Yes | `integer` | Workspace brandtracker folder id. |
| `page` | query | No | `integer` |  |
| `limit` | query | No | `integer` |  |
| `hasNewAdsSince` | query | No | `string` | ISO date/time lower bound. Returns brandtrackers with positive new-ad deltas recorded on or after this timestamp. |
| `name` | query | No | `string` | Case-insensitive contains match against brandtracker name. |
| `sortBy` | query | No | `newAdsLastDay` \| `newAdsLast7Days` \| `newAdsLast30Days` \| `activeAds` \| `totalTraffic` \| `name` \| `createdAt` | Sort key. Metric and createdAt sorts are descending; name sorts ascending. Omit to preserve default workspace ordering. |

## Responses

### 200 - Paginated folder brandtrackers response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": [
    {
      "id": "1e08fa85-625a-4ba5-b673-d2a4b7bc7c55",
      "name": "Example Brand",
      "facebookPageId": "61554990830184",
      "workspaceLinkId": 99,
      "targetType": "shop",
      "websiteId": "3d6fd2f0-5b34-4ffc-91ff-f59775544e5f",
      "domain": "examplebrand.com",
      "avatarUrl": "https://medias.trendtrack.io/profile_picture/61554990830184.jpg",
      "status": {
        "isLoaded": true,
        "lastCrawledAt": "2026-04-20T10:00:00.000Z"
      },
      "workspaceAddedAt": "2026-04-15T09:00:00.000Z",
      "folder": {
        "id": 42,
        "name": "Competitors"
      },
      "advertising": {
        "activeAds": 18,
        "newAdsLastDay": 3,
        "newAdsLast7Days": 11,
        "newAdsLast30Days": 34
      },
      "websites": [
        {
          "id": "3d6fd2f0-5b34-4ffc-91ff-f59775544e5f",
          "domain": "examplebrand.com",
          "siteName": "Example Brand",
          "trafficNumber": 145230,
          "trafficChange": 12.4,
          "monthlyTraffic": {
            "2026-01": 102343,
            "2026-02": 114230
          },
          "socialNetworks": {
            "facebook": "https://facebook.com/examplebrand",
            "instagram": "https://instagram.com/examplebrand",
            "youtube": "https://youtube.com/@examplebrand"
          }
        }
      ],
      "totalTraffic": 145230
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 128,
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
| `id` | `string` | Yes | Public brandtracker identifier backed by brandtracker.id. Legacy spyders.uuid values are accepted when migration metadata exists. |
| `name` | `string` | Yes |  |
| `facebookPageId` | `string` | Yes |  |
| `workspaceLinkId` | `number` | No | Workspace link identifier. Present on mutation responses and useful for follow-up move/delete operations. |
| `targetType` | `shop` \| `page` | No | Resolved tracked target type. Present on mutation responses. |
| `websiteId` | `string` | No | Resolved website/shop identifier when the brandtracker target is shop-level. |
| `domain` | `string` | No | Resolved canonical domain when the brandtracker target is shop-level. |
| `avatarUrl` | `string` | Yes |  |
| `status` | `object` | Yes |  |
| `workspaceAddedAt` | `string` | Yes |  |
| `folder` | `object` | Yes | Primary folder membership, ordered by folder rank, name, then id. Null when the tracked brand has no folder memberships. |
| `advertising` | `object` | Yes |  |
| `websites` | `object`[] | Yes |  |
| `totalTraffic` | `number` | Yes |  |

**`status` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `isLoaded` | `boolean` | Yes |  |
| `lastCrawledAt` | `string` | Yes |  |

**`folder` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `number` | Yes |  |
| `name` | `string` | Yes |  |

**`advertising` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `activeAds` | `number` | Yes |  |
| `newAdsLastDay` | `number` | Yes |  |
| `newAdsLast7Days` | `number` | Yes |  |
| `newAdsLast30Days` | `number` | Yes |  |

**`websites[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes |  |
| `domain` | `string` | Yes |  |
| `siteName` | `string` | Yes |  |
| `trafficNumber` | `number` | Yes |  |
| `trafficChange` | `number` | Yes |  |
| `monthlyTraffic` | `object` | Yes |  |
| `socialNetworks` | `object` | Yes |  |

**`socialNetworks` properties:**


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

# List brandtracker snapshot dates

`GET /v1/brandtrackers/{brandtrackerId}/snapshots`

Returns available ad reach snapshot dates and readiness status for one active workspace brandtracker. latestDate is preserved as a compatibility alias of latestReadyDate; snapshotDate=latest resolves to the latest ready date.

**Tags:** Brandtrackers

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `brandtrackerId` | path | Yes | `string` | Public brandtracker identifier backed by brandtracker.id. Legacy spyders.uuid values are accepted when migration metadata exists. |
| `page` | query | No | `integer` | Pagination page number. Defaults to 1. |
| `limit` | query | No | `integer` | Maximum number of snapshot dates to return. Defaults to 100. |

## Responses

### 200 - Paginated brandtracker snapshot dates response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": {
    "latestDate": "2026-04-20",
    "latestReadyDate": "2026-04-20",
    "latestScheduledDate": "2026-04-21",
    "dates": [
      "2026-04-20",
      "2026-04-19"
    ],
    "snapshots": [
      {
        "date": "2026-04-23",
        "status": "ready",
        "usableRows": 1240,
        "indexedRows": 1300
      }
    ]
  },
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
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `data` | `object` | Yes |  |
| `pagination` | `object` | Yes |  |

**`data` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `latestDate` | `string` | Yes | Deprecated compatibility alias of latestReadyDate. Latest ready snapshot date for this brandtracker, or null when no ready snapshots exist. |
| `latestReadyDate` | `string` | Yes | Latest collection day of this brandtracker's pages within the history the workspace may read, or null when none was collected. Reach (EU/UK ads only) does not affect it. |
| `latestScheduledDate` | `string` | Yes | Latest collection day of this brandtracker's pages. Equal to latestReadyDate: a collected day is complete, so no day is indexed without being ready. |
| `dates` | `string`[] | Yes | Available snapshot dates in descending order. Preserved for backwards compatibility; mirrors snapshots[].date. |
| `snapshots` | `object`[] | Yes | Snapshot dates with readiness status and row counts in descending date order. |

**`snapshots[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `date` | `string` | Yes | Snapshot date in YYYY-MM-DD format. |
| `status` | `ready` \| `indexing` \| `scheduled` | Yes | Readiness status. ready means the brandtracker's pages were collected that day, with every page aggregate; indexing and scheduled are reserved and not currently returned. |
| `usableRows` | `number` | Yes | Pages of this brandtracker collected on this snapshot date. Reach is only published for EU/UK ads and is not required. |
| `indexedRows` | `number` | Yes | Pages of this brandtracker collected on this snapshot date. |

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

### 404 - No active workspace brandtracker matches the requested id.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
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

# List brandtracker ads

`GET /v1/brandtrackers/{brandtrackerId}/ads`

Returns the Meta ads for one active workspace brandtracker resolved from brandtracker.id to fb_page_id. The response reuses the public ad summary shape.

**Tags:** Brandtrackers

## Parameters

**Query parameter groups:**

- Pagination: `page`, `limit`
- Search: `keywordMode`
- Time and snapshots: `createdAfter`, `createdBefore`, `spendPeriod`, `spendPerPagePeriod`, `snapshotDate`
- Sorting: `sortBy`
- Filters: `status`, `mediaType`, `keywords`, `minDaysRunning`, `maxDaysRunning`, `minDuplicates`, `maxDuplicates`, `landingPages`, `adLanguage`, `cta`, `adCopyHashes`, `adCountries`, `mainCountries`, `euOnly`, `partners`, `partnerIds`, `minReach`, `maxReach`, `cpm`, `minSpend`, `maxSpend`, `minSpendPerPage`, `maxSpendPerPage`, `hideLowReach`, `minAge`, `maxAge`, `sex`, `minFacebookLikes`, `maxFacebookLikes`, `minInstagramFollowers`, `maxInstagramFollowers`, `minVideoDuration`, `maxVideoDuration`, `minDescriptionLength`, `maxDescriptionLength`, `linkedDomain`, `growthRank`

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `brandtrackerId` | path | Yes | `string` | Public brandtracker identifier backed by brandtracker.id. Legacy spyders.uuid values are accepted when migration metadata exists. |
| `page` | query | No | `integer` |  |
| `limit` | query | No | `integer` |  |
| `sortBy` | query | No | `newest` \| `createdAt` \| `longestRunning` \| `reach` \| `duplicates` \| `adOrder` \| `relevance` | Sort key. The adOrder value also accepts ad_order and ad-order aliases. |
| `status` | query | No | `all` \| `active` \| `inactive` | Status filter for this request. Allowed values: `all`, `active`, `inactive`. |
| `mediaType` | query | No | `all` \| `image` \| `video` | Enum value accepted by this request. Allowed values: `all`, `image`, `video`. |
| `keywords` | query | No | `string`[] | Keyword search terms. Repeated query params and comma-separated values are both accepted. |
| `keywordMode` | query | No | `any` \| `all` | Enum value accepted by this request. Allowed values: `any`, `all`. |
| `createdAfter` | query | No | `string` |  |
| `createdBefore` | query | No | `string` |  |
| `minDaysRunning` | query | No | `integer` |  |
| `maxDaysRunning` | query | No | `integer` |  |
| `minDuplicates` | query | No | `integer` |  |
| `maxDuplicates` | query | No | `integer` |  |
| `landingPages` | query | No | `string`[] | Landing page URLs. Repeated query params and comma-separated values are both accepted. |
| `adLanguage` | query | No | `string`[] | Ad languages. Repeated query params and comma-separated values are both accepted. |
| `cta` | query | No | `string`[] | Call-to-action labels. Repeated query params and comma-separated values are both accepted. |
| `adCopyHashes` | query | No | `string`[] | 12-character MD5 prefixes for ad copy descriptions. |
| `adCountries` | query | No | `string` | Comma-separated country include/exclude filters. |
| `mainCountries` | query | No | `string`[] | Main ad countries. Repeated query params and comma-separated values are both accepted. |
| `euOnly` | query | No | `boolean` | When true, keep only ads flagged as EU ads. |
| `partners` | query | No | `boolean` | When true, keep only partnership ads. When false, keep only non-partnership ads. |
| `partnerIds` | query | No | `string`[] | Partner identifiers. Repeated query params and comma-separated values are both accepted. |
| `minReach` | query | No | `integer` | Minimum ad reach threshold. Backed by the internal reach/impressions analytics field. |
| `maxReach` | query | No | `integer` | Maximum ad reach threshold. Backed by the internal reach/impressions analytics field. |
| `cpm` | query | No | `number` | CPM used to convert spend filters into reach thresholds. |
| `minSpend` | query | No | `number` |  |
| `maxSpend` | query | No | `number` |  |
| `spendPeriod` | query | No | `total` \| `last24h` \| `last7d` \| `last30d` | Enum value accepted by this request. Allowed values: `total`, `last24h`, `last7d`, `last30d`. |
| `minSpendPerPage` | query | No | `number` |  |
| `maxSpendPerPage` | query | No | `number` |  |
| `spendPerPagePeriod` | query | No | `total` \| `last24h` \| `last7d` \| `last30d` | Enum value accepted by this request. Allowed values: `total`, `last24h`, `last7d`, `last30d`. |
| `hideLowReach` | query | No | `boolean` | When true, hides ads flagged as low reach. |
| `minAge` | query | No | `integer` |  |
| `maxAge` | query | No | `integer` |  |
| `sex` | query | No | `men` \| `women` \| `all` | Enum value accepted by this request. Allowed values: `men`, `women`, `all`. |
| `minFacebookLikes` | query | No | `integer` |  |
| `maxFacebookLikes` | query | No | `integer` |  |
| `minInstagramFollowers` | query | No | `integer` |  |
| `maxInstagramFollowers` | query | No | `integer` |  |
| `minVideoDuration` | query | No | `number` |  |
| `maxVideoDuration` | query | No | `number` |  |
| `minDescriptionLength` | query | No | `integer` |  |
| `maxDescriptionLength` | query | No | `integer` |  |
| `linkedDomain` | query | No | `string` | Linked domain filter. URLs are normalized to their hostname before validation. |
| `growthRank` | query | No | `rising` \| `falling` \| `stable`[] | Rank trend filters. Repeated query params and comma-separated values are both accepted. |
| `snapshotDate` | query | No | `string` | Snapshot date (YYYY-MM-DD or latest). When present, status is interpreted as active at this date. |

## Responses

### 200 - Paginated brandtracker ads response. The response also includes the X-Request-Id header.

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

### 404 - No active workspace brandtracker matches the requested id.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
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

# List brandtracker partnership ads

`GET /v1/brandtrackers/{brandtrackerId}/partnership-ads`

Returns deduped Meta partnership ad groups for one active workspace brandtracker. This endpoint always filters to ads with a partner badge and reuses the public ad summary shape.

**Tags:** Brandtrackers

## Parameters

**Query parameter groups:**

- Pagination: `page`, `limit`
- Search: `keywordMode`
- Time and snapshots: `createdAfter`, `createdBefore`, `spendPeriod`, `spendPerPagePeriod`, `snapshotDate`
- Sorting: `sortBy`
- Filters: `status`, `mediaType`, `keywords`, `minDaysRunning`, `maxDaysRunning`, `minDuplicates`, `maxDuplicates`, `landingPages`, `adLanguage`, `cta`, `adCopyHashes`, `adCountries`, `mainCountries`, `euOnly`, `partnerIds`, `minReach`, `maxReach`, `cpm`, `minSpend`, `maxSpend`, `minSpendPerPage`, `maxSpendPerPage`, `hideLowReach`, `minAge`, `maxAge`, `sex`, `minFacebookLikes`, `maxFacebookLikes`, `minInstagramFollowers`, `maxInstagramFollowers`, `minVideoDuration`, `maxVideoDuration`, `minDescriptionLength`, `maxDescriptionLength`, `linkedDomain`, `growthRank`, `partnerId`

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `brandtrackerId` | path | Yes | `string` | Public brandtracker identifier backed by brandtracker.id. Legacy spyders.uuid values are accepted when migration metadata exists. |
| `page` | query | No | `integer` |  |
| `limit` | query | No | `integer` |  |
| `sortBy` | query | No | `newest` \| `createdAt` \| `longestRunning` \| `reach` \| `duplicates` \| `adOrder` \| `relevance` | Sort key. The adOrder value also accepts ad_order and ad-order aliases. |
| `status` | query | No | `all` \| `active` \| `inactive` | Status filter for this request. Allowed values: `all`, `active`, `inactive`. |
| `mediaType` | query | No | `all` \| `image` \| `video` | Enum value accepted by this request. Allowed values: `all`, `image`, `video`. |
| `keywords` | query | No | `string`[] | Keyword search terms. Repeated query params and comma-separated values are both accepted. |
| `keywordMode` | query | No | `any` \| `all` | Enum value accepted by this request. Allowed values: `any`, `all`. |
| `createdAfter` | query | No | `string` |  |
| `createdBefore` | query | No | `string` |  |
| `minDaysRunning` | query | No | `integer` |  |
| `maxDaysRunning` | query | No | `integer` |  |
| `minDuplicates` | query | No | `integer` |  |
| `maxDuplicates` | query | No | `integer` |  |
| `landingPages` | query | No | `string`[] | Landing page URLs. Repeated query params and comma-separated values are both accepted. |
| `adLanguage` | query | No | `string`[] | Ad languages. Repeated query params and comma-separated values are both accepted. |
| `cta` | query | No | `string`[] | Call-to-action labels. Repeated query params and comma-separated values are both accepted. |
| `adCopyHashes` | query | No | `string`[] | 12-character MD5 prefixes for ad copy descriptions. |
| `adCountries` | query | No | `string` | Comma-separated country include/exclude filters. |
| `mainCountries` | query | No | `string`[] | Main ad countries. Repeated query params and comma-separated values are both accepted. |
| `euOnly` | query | No | `boolean` | When true, keep only ads flagged as EU ads. |
| `partnerIds` | query | No | `string`[] | Partner identifiers. Repeated query params and comma-separated values are both accepted. |
| `minReach` | query | No | `integer` | Minimum ad reach threshold. Backed by the internal reach/impressions analytics field. |
| `maxReach` | query | No | `integer` | Maximum ad reach threshold. Backed by the internal reach/impressions analytics field. |
| `cpm` | query | No | `number` | CPM used to convert spend filters into reach thresholds. |
| `minSpend` | query | No | `number` |  |
| `maxSpend` | query | No | `number` |  |
| `spendPeriod` | query | No | `total` \| `last24h` \| `last7d` \| `last30d` | Enum value accepted by this request. Allowed values: `total`, `last24h`, `last7d`, `last30d`. |
| `minSpendPerPage` | query | No | `number` |  |
| `maxSpendPerPage` | query | No | `number` |  |
| `spendPerPagePeriod` | query | No | `total` \| `last24h` \| `last7d` \| `last30d` | Enum value accepted by this request. Allowed values: `total`, `last24h`, `last7d`, `last30d`. |
| `hideLowReach` | query | No | `boolean` | When true, hides ads flagged as low reach. |
| `minAge` | query | No | `integer` |  |
| `maxAge` | query | No | `integer` |  |
| `sex` | query | No | `men` \| `women` \| `all` | Enum value accepted by this request. Allowed values: `men`, `women`, `all`. |
| `minFacebookLikes` | query | No | `integer` |  |
| `maxFacebookLikes` | query | No | `integer` |  |
| `minInstagramFollowers` | query | No | `integer` |  |
| `maxInstagramFollowers` | query | No | `integer` |  |
| `minVideoDuration` | query | No | `number` |  |
| `maxVideoDuration` | query | No | `number` |  |
| `minDescriptionLength` | query | No | `integer` |  |
| `maxDescriptionLength` | query | No | `integer` |  |
| `linkedDomain` | query | No | `string` | Linked domain filter. URLs are normalized to their hostname before validation. |
| `growthRank` | query | No | `rising` \| `falling` \| `stable`[] | Rank trend filters. Repeated query params and comma-separated values are both accepted. |
| `snapshotDate` | query | No | `string` | Snapshot date (YYYY-MM-DD or latest). When present, status is interpreted as active at this date. |
| `partnerId` | query | No | `string` | Single partner identifier alias. It is merged with partnerIds when both are provided. |

## Responses

### 200 - Paginated brandtracker partnership ads response. The response also includes the X-Request-Id header.

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

### 404 - No active workspace brandtracker matches the requested id.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
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

# Count brandtracker partnership ads

`GET /v1/brandtrackers/{brandtrackerId}/partnership-ads/count`

Returns the deduped public ad group count matching the partnership ads list filters. This intentionally matches public list pagination semantics rather than the webapp raw active badge count.

**Tags:** Brandtrackers

## Parameters

**Query parameter groups:**

- Search: `keywordMode`
- Time and snapshots: `createdAfter`, `createdBefore`, `spendPeriod`, `spendPerPagePeriod`, `snapshotDate`
- Filters: `status`, `mediaType`, `keywords`, `minDaysRunning`, `maxDaysRunning`, `minDuplicates`, `maxDuplicates`, `landingPages`, `adLanguage`, `cta`, `adCopyHashes`, `adCountries`, `mainCountries`, `euOnly`, `partnerIds`, `minReach`, `maxReach`, `cpm`, `minSpend`, `maxSpend`, `minSpendPerPage`, `maxSpendPerPage`, `hideLowReach`, `minAge`, `maxAge`, `sex`, `minFacebookLikes`, `maxFacebookLikes`, `minInstagramFollowers`, `maxInstagramFollowers`, `minVideoDuration`, `maxVideoDuration`, `minDescriptionLength`, `maxDescriptionLength`, `linkedDomain`, `growthRank`, `partnerId`

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `brandtrackerId` | path | Yes | `string` | Public brandtracker identifier backed by brandtracker.id. Legacy spyders.uuid values are accepted when migration metadata exists. |
| `status` | query | No | `all` \| `active` \| `inactive` | Status filter for this request. Allowed values: `all`, `active`, `inactive`. |
| `mediaType` | query | No | `all` \| `image` \| `video` | Enum value accepted by this request. Allowed values: `all`, `image`, `video`. |
| `keywords` | query | No | `string`[] | Keyword search terms. Repeated query params and comma-separated values are both accepted. |
| `keywordMode` | query | No | `any` \| `all` | Enum value accepted by this request. Allowed values: `any`, `all`. |
| `createdAfter` | query | No | `string` |  |
| `createdBefore` | query | No | `string` |  |
| `minDaysRunning` | query | No | `integer` |  |
| `maxDaysRunning` | query | No | `integer` |  |
| `minDuplicates` | query | No | `integer` |  |
| `maxDuplicates` | query | No | `integer` |  |
| `landingPages` | query | No | `string`[] | Landing page URLs. Repeated query params and comma-separated values are both accepted. |
| `adLanguage` | query | No | `string`[] | Ad languages. Repeated query params and comma-separated values are both accepted. |
| `cta` | query | No | `string`[] | Call-to-action labels. Repeated query params and comma-separated values are both accepted. |
| `adCopyHashes` | query | No | `string`[] | 12-character MD5 prefixes for ad copy descriptions. |
| `adCountries` | query | No | `string` | Comma-separated country include/exclude filters. |
| `mainCountries` | query | No | `string`[] | Main ad countries. Repeated query params and comma-separated values are both accepted. |
| `euOnly` | query | No | `boolean` | When true, keep only ads flagged as EU ads. |
| `partnerIds` | query | No | `string`[] | Partner identifiers. Repeated query params and comma-separated values are both accepted. |
| `minReach` | query | No | `integer` | Minimum ad reach threshold. Backed by the internal reach/impressions analytics field. |
| `maxReach` | query | No | `integer` | Maximum ad reach threshold. Backed by the internal reach/impressions analytics field. |
| `cpm` | query | No | `number` | CPM used to convert spend filters into reach thresholds. |
| `minSpend` | query | No | `number` |  |
| `maxSpend` | query | No | `number` |  |
| `spendPeriod` | query | No | `total` \| `last24h` \| `last7d` \| `last30d` | Enum value accepted by this request. Allowed values: `total`, `last24h`, `last7d`, `last30d`. |
| `minSpendPerPage` | query | No | `number` |  |
| `maxSpendPerPage` | query | No | `number` |  |
| `spendPerPagePeriod` | query | No | `total` \| `last24h` \| `last7d` \| `last30d` | Enum value accepted by this request. Allowed values: `total`, `last24h`, `last7d`, `last30d`. |
| `hideLowReach` | query | No | `boolean` | When true, hides ads flagged as low reach. |
| `minAge` | query | No | `integer` |  |
| `maxAge` | query | No | `integer` |  |
| `sex` | query | No | `men` \| `women` \| `all` | Enum value accepted by this request. Allowed values: `men`, `women`, `all`. |
| `minFacebookLikes` | query | No | `integer` |  |
| `maxFacebookLikes` | query | No | `integer` |  |
| `minInstagramFollowers` | query | No | `integer` |  |
| `maxInstagramFollowers` | query | No | `integer` |  |
| `minVideoDuration` | query | No | `number` |  |
| `maxVideoDuration` | query | No | `number` |  |
| `minDescriptionLength` | query | No | `integer` |  |
| `maxDescriptionLength` | query | No | `integer` |  |
| `linkedDomain` | query | No | `string` | Linked domain filter. URLs are normalized to their hostname before validation. |
| `growthRank` | query | No | `rising` \| `falling` \| `stable`[] | Rank trend filters. Repeated query params and comma-separated values are both accepted. |
| `snapshotDate` | query | No | `string` | Snapshot date (YYYY-MM-DD or latest). When present, status is interpreted as active at this date. |
| `partnerId` | query | No | `string` | Single partner identifier alias. It is merged with partnerIds when both are provided. |

## Responses

### 200 - Brandtracker partnership ads count response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": {
    "count": 0
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
| `count` | `number` | Yes | Deduped public ad groups matching the partnership ads list filters. |

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

### 404 - No active workspace brandtracker matches the requested id.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
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

# Get brandtracker hooks

`GET /v1/brandtrackers/{brandtrackerId}/hooks`

Returns grouped hook analytics for the requested brandtracker using the authenticated workspace as the only access scope.

**Tags:** Brandtrackers

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `brandtrackerId` | path | Yes | `string` | Public brandtracker identifier. This endpoint resolves brandtracker.id inside the authenticated workspace; legacy spyders.uuid values are accepted when migration metadata exists. |
| `timePeriod` | query | No | `live` \| `last24h` \| `last3d` \| `last7d` \| `last30d` \| `last3m` \| `last6m` \| `last1y` | Relative insights time window. Use stable windows like last7d or last30d for consistent agent behavior. |
| `page` | query | No | `integer` | Pagination page number. Defaults to 1. |
| `limit` | query | No | `integer` | Maximum number of items to return. Defaults to 20. |
| `euOnly` | query | No | `boolean` | Optional EU-only filter. When true, only EU-classified Facebook ads are included. |
| `order` | query | No | `asc` \| `desc` | Optional sort order. Defaults to desc. |
| `snapshotDate` | query | No | `string` | Optional snapshot anchor date (YYYY-MM-DD). When provided, the requested window is evaluated against that snapshot date. |
| `sortBy` | query | No | `usageCount` \| `longestRunning` \| `totalImpressions` \| `firstUsedAt` \| `lastUsedAt` | Optional hook sorting. Defaults to usageCount. |

## Responses

### 200 - Paginated brandtracker hooks analytics response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": [
    {
      "hook": "Stop scrolling.",
      "usageCount": 12,
      "longestRunning": 47,
      "totalImpressions": 152340,
      "firstUsedAt": "2026-02-01T09:12:00.000Z",
      "lastUsedAt": "2026-04-19T12:30:00.000Z",
      "sampleAd": {
        "adId": "facebook_123456789",
        "mediaUrl": "https://cdn.example.com/ads/creative.mp4",
        "thumbnailUrl": "https://cdn.example.com/ads/creative-thumb.jpg",
        "fullText": "This is the full transcript text for the sampled ad."
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
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `data` | `object`[] | Yes |  |
| `pagination` | `object` | Yes |  |

**`data[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `hook` | `string` | Yes |  |
| `usageCount` | `number` | Yes |  |
| `longestRunning` | `number` | Yes |  |
| `totalImpressions` | `number` | Yes | Total impressions/reach contributed by ads using this hook. This aligns with Meta Ad Library reach vocabulary used elsewhere in the ads API. |
| `firstUsedAt` | `string` | Yes |  |
| `lastUsedAt` | `string` | Yes |  |
| `sampleAd` | `object` | Yes |  |

**`sampleAd` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `adId` | `string` | Yes |  |
| `mediaUrl` | `string` | Yes |  |
| `thumbnailUrl` | `string` | Yes |  |
| `fullText` | `string` | Yes |  |

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

### 404 - The brandtracker could not be found in the authenticated workspace or is not active.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
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

# Get brandtracker transcripts

`GET /v1/brandtrackers/{brandtrackerId}/transcripts`

Returns grouped transcript/script analytics for the requested brandtracker using the authenticated workspace as the only access scope.

**Tags:** Brandtrackers

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `brandtrackerId` | path | Yes | `string` | Public brandtracker identifier. This endpoint resolves brandtracker.id inside the authenticated workspace; legacy spyders.uuid values are accepted when migration metadata exists. |
| `timePeriod` | query | No | `live` \| `last24h` \| `last3d` \| `last7d` \| `last30d` \| `last3m` \| `last6m` \| `last1y` | Relative insights time window. Use stable windows like last7d or last30d for consistent agent behavior. |
| `page` | query | No | `integer` | Pagination page number. Defaults to 1. |
| `limit` | query | No | `integer` | Maximum number of items to return. Defaults to 20. |
| `euOnly` | query | No | `boolean` | Optional EU-only filter. When true, only EU-classified Facebook ads are included. |
| `order` | query | No | `asc` \| `desc` | Optional sort order. Defaults to desc. |
| `snapshotDate` | query | No | `string` | Optional snapshot anchor date (YYYY-MM-DD). When provided, the requested window is evaluated against that snapshot date. |
| `sortBy` | query | No | `usageCount` \| `longestRunning` \| `totalImpressions` \| `firstUsedAt` \| `lastUsedAt` | Optional transcript sorting. Defaults to usageCount. |

## Responses

### 200 - Paginated brandtracker transcripts analytics response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": [
    {
      "fullText": "This is the full transcript text used by multiple ads in this brandtracker.",
      "usageCount": 12,
      "longestRunning": 47,
      "totalImpressions": 152340,
      "firstUsedAt": "2026-02-01T09:12:00.000Z",
      "lastUsedAt": "2026-04-19T12:30:00.000Z",
      "sampleAd": {
        "adId": "facebook_123456789",
        "mediaUrl": "https://cdn.example.com/ads/creative.mp4",
        "thumbnailUrl": "https://cdn.example.com/ads/creative-thumb.jpg"
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
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `data` | `object`[] | Yes |  |
| `pagination` | `object` | Yes |  |

**`data[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `fullText` | `string` | Yes |  |
| `usageCount` | `number` | Yes |  |
| `longestRunning` | `number` | Yes |  |
| `totalImpressions` | `number` | Yes | Total impressions/reach contributed by ads using this transcript. This aligns with Meta Ad Library reach vocabulary used elsewhere in the ads API. |
| `firstUsedAt` | `string` | Yes |  |
| `lastUsedAt` | `string` | Yes |  |
| `sampleAd` | `object` | Yes |  |

**`sampleAd` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `adId` | `string` | Yes |  |
| `mediaUrl` | `string` | Yes |  |
| `thumbnailUrl` | `string` | Yes |  |

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

### 404 - The brandtracker could not be found in the authenticated workspace or is not active.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
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

# Get brandtracker headlines

`GET /v1/brandtrackers/{brandtrackerId}/headlines`

Returns grouped headline analytics for the requested brandtracker.

**Tags:** Brandtrackers

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `brandtrackerId` | path | Yes | `string` | Public brandtracker identifier. This endpoint resolves brandtracker.id inside the authenticated workspace; legacy spyders.uuid values are accepted when migration metadata exists. |
| `timePeriod` | query | No | `live` \| `last24h` \| `last3d` \| `last7d` \| `last30d` \| `last3m` \| `last6m` \| `last1y` | Relative insights time window. Use stable windows like last7d or last30d for consistent agent behavior. |
| `page` | query | No | `integer` | Pagination page number. Defaults to 1. |
| `limit` | query | No | `integer` | Maximum number of items to return. Defaults to 20. |
| `euOnly` | query | No | `boolean` | Optional EU-only filter. When true, only EU-classified Facebook ads are included. |
| `order` | query | No | `asc` \| `desc` | Optional sort order. Defaults to desc. |
| `snapshotDate` | query | No | `string` | Optional snapshot anchor date (YYYY-MM-DD). When provided, the requested window is evaluated against that snapshot date. |
| `sortBy` | query | No | `usageCount` \| `longestRunning` | Optional headline sorting. Defaults to usageCount. |

## Responses

### 200 - Paginated brandtracker headlines analytics response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": [
    {
      "headline": "Summer sale is live",
      "usageCount": 18,
      "longestRunning": 52
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
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `data` | `object`[] | Yes |  |
| `pagination` | `object` | Yes |  |

**`data[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `headline` | `string` | Yes |  |
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

### 404 - The brandtracker could not be found in the authenticated workspace or is not active.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
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

# Get brandtracker ad copies

`GET /v1/brandtrackers/{brandtrackerId}/ad-copies`

Returns grouped ad copy analytics for the requested brandtracker.

**Tags:** Brandtrackers

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `brandtrackerId` | path | Yes | `string` | Public brandtracker identifier. This endpoint resolves brandtracker.id inside the authenticated workspace; legacy spyders.uuid values are accepted when migration metadata exists. |
| `timePeriod` | query | No | `live` \| `last24h` \| `last3d` \| `last7d` \| `last30d` \| `last3m` \| `last6m` \| `last1y` | Relative insights time window. Use stable windows like last7d or last30d for consistent agent behavior. |
| `page` | query | No | `integer` | Pagination page number. Defaults to 1. |
| `limit` | query | No | `integer` | Maximum number of items to return. Defaults to 20. |
| `euOnly` | query | No | `boolean` | Optional EU-only filter. When true, only EU-classified Facebook ads are included. |
| `order` | query | No | `asc` \| `desc` | Optional sort order. Defaults to desc. |
| `snapshotDate` | query | No | `string` | Optional snapshot anchor date (YYYY-MM-DD). When provided, the requested window is evaluated against that snapshot date. |
| `sortBy` | query | No | `usageCount` \| `longestRunning` | Optional ad copy sorting. Defaults to usageCount. |

## Responses

### 200 - Paginated brandtracker ad copies analytics response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": [
    {
      "adCopy": "Get 30% off selected products this week only.",
      "usageCount": 21,
      "longestRunning": 43
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
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `data` | `object`[] | Yes |  |
| `pagination` | `object` | Yes |  |

**`data[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `adCopy` | `string` | Yes |  |
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

### 404 - The brandtracker could not be found in the authenticated workspace or is not active.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
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

# Get brandtracker landing pages

`GET /v1/brandtrackers/{brandtrackerId}/landing-pages`

Returns grouped landing page analytics for the requested brandtracker, including detected technologies when available.

**Tags:** Brandtrackers

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `brandtrackerId` | path | Yes | `string` | Public brandtracker identifier. This endpoint resolves brandtracker.id inside the authenticated workspace; legacy spyders.uuid values are accepted when migration metadata exists. |
| `timePeriod` | query | No | `live` \| `last24h` \| `last3d` \| `last7d` \| `last30d` \| `last3m` \| `last6m` \| `last1y` | Relative insights time window. Use stable windows like last7d or last30d for consistent agent behavior. |
| `page` | query | No | `integer` | Pagination page number. Defaults to 1. |
| `limit` | query | No | `integer` | Maximum number of items to return. Defaults to 20. |
| `euOnly` | query | No | `boolean` | Optional EU-only filter. When true, only EU-classified Facebook ads are included. |
| `order` | query | No | `asc` \| `desc` | Optional sort order. Defaults to desc. |
| `snapshotDate` | query | No | `string` | Optional snapshot anchor date (YYYY-MM-DD). When provided, the requested window is evaluated against that snapshot date. |
| `sortBy` | query | No | `usageCount` \| `longestRunning` \| `totalImpressions` | Optional landing page sorting. Defaults to usageCount. |

## Responses

### 200 - Paginated brandtracker landing pages analytics response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": [
    {
      "landingPage": "https://example.com/products/summer-sale",
      "usageCount": 16,
      "longestRunning": 41,
      "totalImpressions": 305400,
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
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `data` | `object`[] | Yes |  |
| `pagination` | `object` | Yes |  |

**`data[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `landingPage` | `string` | Yes |  |
| `usageCount` | `number` | Yes |  |
| `longestRunning` | `number` | Yes |  |
| `totalImpressions` | `number` | Yes | Total impressions/reach contributed by ads pointing to this landing page. This aligns with Meta Ad Library reach vocabulary used elsewhere in the ads API. |
| `technologies` | `object`[] | Yes |  |
| `screenshots` | `object` | Yes | Best-effort landing page screenshot preview URLs from the screenshots table. |

**`technologies[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes |  |
| `name` | `string` | Yes |  |
| `iconUrl` | `string` | Yes |  |

**`screenshots` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `desktop` | `object` | Yes | Latest desktop/full-page screenshot URL when available. |
| `mobile` | `object` | Yes | Latest mobile screenshot URL when available. |
| `head` | `object` | Yes | Latest above-the-fold/head screenshot URL when available. |

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

### 404 - The brandtracker could not be found in the authenticated workspace or is not active.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
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

# Get normalized brandtracker landing pages

`GET /v1/brandtrackers/{brandtrackerId}/landing-pages/simple`

Returns normalized/grouped landing page analytics for the requested brandtracker. Query strings, fragments, trailing slashes, and leading www. hostnames are ignored for grouping.

**Tags:** Brandtrackers

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `brandtrackerId` | path | Yes | `string` | Public brandtracker identifier. This endpoint resolves brandtracker.id inside the authenticated workspace; legacy spyders.uuid values are accepted when migration metadata exists. |
| `timePeriod` | query | No | `live` \| `last24h` \| `last3d` \| `last7d` \| `last30d` \| `last3m` \| `last6m` \| `last1y` | Relative insights time window. Use stable windows like last7d or last30d for consistent agent behavior. |
| `page` | query | No | `integer` | Pagination page number. Defaults to 1. |
| `limit` | query | No | `integer` | Maximum number of items to return. Defaults to 20. |
| `euOnly` | query | No | `boolean` | Optional EU-only filter. When true, only EU-classified Facebook ads are included. |
| `order` | query | No | `asc` \| `desc` | Optional sort order. Defaults to desc. |
| `snapshotDate` | query | No | `string` | Optional snapshot anchor date (YYYY-MM-DD). When provided, the requested window is evaluated against that snapshot date. |
| `sortBy` | query | No | `usageCount` \| `activeAdsCount` | Optional normalized landing page sorting. Defaults to usageCount. |

## Responses

### 200 - Paginated normalized brandtracker landing pages analytics response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": [
    {
      "landingPage": "https://example.com/products/summer-sale",
      "normalizedLandingPage": "example.com/products/summer-sale",
      "usageCount": 16,
      "activeAdsCount": 5,
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
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `data` | `object`[] | Yes |  |
| `pagination` | `object` | Yes |  |

**`data[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `landingPage` | `string` | Yes | Representative landing page URL with query string, fragment, and trailing slash removed. |
| `normalizedLandingPage` | `string` | Yes | Normalized grouping key. Hostname is lowercased and leading www. is removed; query strings and fragments are ignored. |
| `usageCount` | `number` | Yes |  |
| `activeAdsCount` | `number` | Yes | Number of currently active ads in this group for rolling windows. For live and snapshot queries this matches usageCount. |
| `technologies` | `object`[] | Yes |  |
| `screenshots` | `object` | Yes | Best-effort landing page screenshot preview URLs from the screenshots table. |

**`technologies[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes |  |
| `name` | `string` | Yes |  |
| `iconUrl` | `string` | Yes |  |

**`screenshots` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `desktop` | `object` | Yes | Latest desktop/full-page screenshot URL when available. |
| `mobile` | `object` | Yes | Latest mobile screenshot URL when available. |
| `head` | `object` | Yes | Latest above-the-fold/head screenshot URL when available. |

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

### 404 - The brandtracker could not be found in the authenticated workspace or is not active.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
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

# Get brandtracker creatives

`GET /v1/brandtrackers/{brandtrackerId}/creatives`

Returns paginated creative analytics for the requested brandtracker.

**Tags:** Brandtrackers

## Parameters

**Query parameter groups:**

- Pagination: `page`, `limit`
- Time and snapshots: `timePeriod`, `snapshotDate`
- Sorting: `order`, `sortBy`
- Filters: `euOnly`, `mediaType`

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `brandtrackerId` | path | Yes | `string` | Public brandtracker identifier. This endpoint resolves brandtracker.id inside the authenticated workspace; legacy spyders.uuid values are accepted when migration metadata exists. |
| `timePeriod` | query | No | `live` \| `last24h` \| `last3d` \| `last7d` \| `last30d` \| `last3m` \| `last6m` \| `last1y` | Relative insights time window. Use stable windows like last7d or last30d for consistent agent behavior. |
| `page` | query | No | `integer` | Pagination page number. Defaults to 1. |
| `limit` | query | No | `integer` | Maximum number of items to return. Defaults to 20. |
| `euOnly` | query | No | `boolean` | Optional EU-only filter. When true, only EU-classified Facebook ads are included. |
| `order` | query | No | `asc` \| `desc` | Optional sort order. Defaults to desc. |
| `snapshotDate` | query | No | `string` | Optional snapshot anchor date (YYYY-MM-DD). When provided, the requested window is evaluated against that snapshot date. |
| `sortBy` | query | No | `firstSeenAt` \| `daysRunning` \| `duplicates` | Optional creatives sorting. Defaults to firstSeenAt. |
| `mediaType` | query | No | `all` \| `image` \| `video` | Optional media type filter. Defaults to all. |

## Responses

### 200 - Paginated brandtracker creatives response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": [
    {
      "adId": "facebook_123456789",
      "mediaType": "video",
      "mediaUrl": "https://cdn.example.com/ads/creative.mp4",
      "thumbnailUrl": "https://cdn.example.com/ads/creative-thumb.jpg",
      "firstSeenAt": "2026-03-01T08:00:00.000Z",
      "daysRunning": 27,
      "duplicates": 4
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
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `data` | `object`[] | Yes |  |
| `pagination` | `object` | Yes |  |

**`data[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `adId` | `string` | Yes |  |
| `mediaType` | `image` \| `video` \| `unknown` | Yes |  |
| `mediaUrl` | `string` | Yes |  |
| `thumbnailUrl` | `string` | Yes |  |
| `firstSeenAt` | `string` | Yes |  |
| `daysRunning` | `number` | Yes |  |
| `duplicates` | `number` | Yes |  |

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

### 404 - The brandtracker could not be found in the authenticated workspace or is not active.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
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

# Get brandtracker partners

`GET /v1/brandtrackers/{brandtrackerId}/partners`

Returns paginated partnership analytics for the requested brandtracker.

**Tags:** Brandtrackers

## Parameters

**Query parameter groups:**

- Pagination: `page`, `limit`
- Time and snapshots: `timePeriod`, `snapshotDate`
- Sorting: `order`, `sortBy`
- Filters: `euOnly`, `cpm`

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `brandtrackerId` | path | Yes | `string` | Public brandtracker identifier. This endpoint resolves brandtracker.id inside the authenticated workspace; legacy spyders.uuid values are accepted when migration metadata exists. |
| `timePeriod` | query | No | `live` \| `last24h` \| `last3d` \| `last7d` \| `last30d` \| `last3m` \| `last6m` \| `last1y` | Relative insights time window. Use stable windows like last7d or last30d for consistent agent behavior. |
| `page` | query | No | `integer` | Pagination page number. Defaults to 1. |
| `limit` | query | No | `integer` | Maximum number of items to return. Defaults to 20. |
| `euOnly` | query | No | `boolean` | Optional EU-only filter. When true, only EU-classified Facebook ads are included. |
| `order` | query | No | `asc` \| `desc` | Optional sort order. Defaults to desc. |
| `snapshotDate` | query | No | `string` | Optional snapshot anchor date (YYYY-MM-DD). When provided, the requested window is evaluated against that snapshot date. |
| `sortBy` | query | No | `activeAds` \| `launchDate` \| `reach` \| `estimatedSpend` | Optional partners sorting. Defaults to activeAds. |
| `cpm` | query | No | `number` | Optional CPM used to estimate spend from reach. Defaults to 9. |

## Responses

### 200 - Paginated brandtracker partners response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": [
    {
      "facebookPageId": "61554990830184",
      "name": "Example Partner",
      "activeAds": 8,
      "launchDate": "2026-02-18T13:40:00.000Z",
      "reach": 245000,
      "estimatedSpend": 2205
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
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `data` | `object`[] | Yes |  |
| `pagination` | `object` | Yes |  |

**`data[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `facebookPageId` | `string` | Yes |  |
| `name` | `string` | Yes |  |
| `activeAds` | `number` | Yes |  |
| `launchDate` | `string` | Yes |  |
| `reach` | `number` | Yes | Partner ad reach. In Meta Ad Library vocabulary, reach is the public-facing impressions-style metric where available. |
| `estimatedSpend` | `number` | Yes |  |

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

### 404 - The brandtracker could not be found in the authenticated workspace or is not active.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
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

# Get brandtracker media mix

`GET /v1/brandtrackers/{brandtrackerId}/media-mix`

Returns the media-format breakdown (image, video, dco, other) for the brandtracker's deduped currently active ads, or a deduped snapshot reconstruction when a snapshotDate is provided. activeAds equals the sum of the media buckets.

**Tags:** Brandtrackers

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `brandtrackerId` | path | Yes | `string` | Public brandtracker identifier. This endpoint resolves brandtracker.id inside the authenticated workspace; legacy spyders.uuid values are accepted when migration metadata exists. |
| `euOnly` | query | No | `boolean` | Optional EU-only filter. When true, only EU-classified Facebook ads are included. |
| `snapshotDate` | query | No | `string` | Optional snapshot date (YYYY-MM-DD or latest). When provided, the mix is reconstructed for that date; otherwise it uses live active ads. Counts are deduped by ad before media buckets are calculated. |

## Responses

### 200 - Brandtracker media mix response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": {
    "activeAds": 23,
    "formatCount": {
      "image": 12,
      "video": 8,
      "dco": 2,
      "other": 1
    }
  },
  "meta": {
    "requestedSnapshotDate": "latest",
    "resolvedSnapshotDate": "2026-04-23",
    "dataFreshnessLagDays": 1,
    "periodNote": "period=today uses the latest ready completed snapshot date instead of partial current-day data."
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `data` | `object` | Yes |  |
| `meta` | `object` | Yes |  |

**`data` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `activeAds` | `number` | Yes | Number of deduped eligible ads in the media mix. Equals image + video + dco + other. |
| `formatCount` | `object` | Yes | Media-format buckets counted from the same deduped eligible-ad set as activeAds. Carousel is not exposed as a separate media-mix bucket; carousel creatives are currently folded into image, video, dco, or other based on the indexed media format. |

**`formatCount` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `image` | `number` | Yes |  |
| `video` | `number` | Yes |  |
| `dco` | `number` | Yes |  |
| `other` | `number` | Yes |  |

**`meta` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `requestedSnapshotDate` | `string` | Yes | Snapshot date requested by the client. Null when snapshotDate was omitted. |
| `resolvedSnapshotDate` | `string` | Yes | Snapshot date actually used by the endpoint. Null when no ready snapshot was available or no snapshot resolution was needed. |
| `dataFreshnessLagDays` | `number` | Yes | Difference in whole UTC days between today and the resolved snapshot date. Null when no snapshot was resolved. |
| `periodNote` | `string` | No | Optional note clarifying period-specific freshness behavior. |

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

### 404 - The brandtracker could not be found in the authenticated workspace or is not active.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
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

# Get brandtracker demography

`GET /v1/brandtrackers/{brandtrackerId}/demography`

Returns the EU country / age / gender reach distributions precomputed for the brandtracker. The underlying dataset is page-level and EU-only, so this endpoint is fundamentally EU-scoped.

**Tags:** Brandtrackers

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `brandtrackerId` | path | Yes | `string` | Public brandtracker identifier. This endpoint resolves brandtracker.id inside the authenticated workspace; legacy spyders.uuid values are accepted when migration metadata exists. |
| `euOnly` | query | No | `boolean` | EU-only filter. This endpoint is fundamentally EU-scoped (the source data is the EU-only fb_page_reach_by_country table), so this defaults to true and is retained for forward compatibility. |
| `snapshotDate` | query | No | `string` | Optional snapshot date (YYYY-MM-DD or latest). The underlying demography data is currently a precomputed per-page snapshot (not time-windowed), so this parameter is accepted for forward compatibility but does not filter the result today. |
| `timePeriod` | query | No | `live` \| `last24h` \| `last3d` \| `last7d` \| `last30d` \| `last3m` \| `last6m` \| `last1y` | Optional time window. The underlying demography data is currently a precomputed per-page snapshot (not time-windowed), so this parameter is accepted for forward compatibility but does not filter the result today. |

## Responses

### 200 - Brandtracker demography distributions response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": {
    "hasData": true,
    "countryDistribution": [
      {
        "countryCode": "US",
        "reach": 125000
      }
    ],
    "ageDistribution": [
      {
        "ageRange": "25-34",
        "reach": 82000
      }
    ],
    "genderDistribution": [
      {
        "gender": "female",
        "reach": 91000
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
| `hasData` | `boolean` | Yes |  |
| `countryDistribution` | `object`[] | Yes |  |
| `ageDistribution` | `object`[] | Yes |  |
| `genderDistribution` | `object`[] | Yes |  |

**`countryDistribution[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `countryCode` | `string` | Yes |  |
| `reach` | `number` | Yes | Reach attributed to this country. In Meta Ad Library vocabulary, reach is the public-facing impressions-style metric where available. |

**`ageDistribution[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `ageRange` | `string` | Yes |  |
| `reach` | `number` | Yes | Reach attributed to this age range. In Meta Ad Library vocabulary, reach is the public-facing impressions-style metric where available. |

**`genderDistribution[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `gender` | `female` \| `male` \| `unknown` | Yes |  |
| `reach` | `number` | Yes | Reach attributed to this gender bucket. In Meta Ad Library vocabulary, reach is the public-facing impressions-style metric where available. |

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

### 404 - The brandtracker could not be found in the authenticated workspace or is not active.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
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

# Get current ranked top ads

`GET /v1/brandtrackers/{brandtrackerId}/top-ads`

Canonical current-ranking endpoint for a brandtracker. Use sortBy=currentRank for the current Facebook page rank, sortBy=reach/reachDelta1d/reachDelta7d/reachDelta30d for reach rankings, and sortBy=rankDelta7d/rankDelta14d/rankDelta30d for rank movers. period and snapshotDate are deprecated compatibility parameters and are ignored on this current-ranking path.

**Tags:** Brandtrackers

## Parameters

**Query parameter groups:**

- Pagination: `page`, `limit`
- Time and snapshots: `period`, `snapshotDate`
- Sorting: `sortBy`
- Filters: `facebookPageId`, `allFacebookPages`, `euOnly`, `status`, `includeInactive`

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `brandtrackerId` | path | Yes | `string` | Public brandtracker identifier. This endpoint resolves brandtracker.id inside the authenticated workspace; legacy spyders.uuid values are accepted when migration metadata exists. |
| `page` | query | No | `integer` | Pagination page number. Defaults to 1. |
| `limit` | query | No | `integer` | Maximum number of items to return. Defaults to 20. |
| `facebookPageId` | query | No | `string` | Optional Facebook page id belonging to this brandtracker. When omitted, the primary Facebook page is used. |
| `allFacebookPages` | query | No | `boolean` | When true, aggregate all selected Facebook pages. Current ranks are page-local, so ties across pages are expected. Cannot be combined with facebookPageId. |
| `euOnly` | query | No | `boolean` | Optional EU-only filter. When true, only EU-classified Facebook ads are included. |
| `sortBy` | query | No | `currentRank` \| `rankDelta` \| `rankDelta7d` \| `rankDelta14d` \| `rankDelta30d` \| `reach` \| `reachDelta1d` \| `reachDelta7d` \| `reachDelta30d` \| `daysRunning` \| `duplicates` | Sort key for canonical current rankings. Use currentRank for the selected Facebook page rank (returned as rank/currentRank); rankDelta7d, rankDelta14d, or rankDelta30d for movers; reach, reachDelta1d, reachDelta7d, or reachDelta30d for reach rankings. |
| `status` | query | No | `active` \| `inactive` \| `all` | Preferred activity filter. active returns active ads, inactive returns inactive ads, all returns both. When supplied, it takes precedence over includeInactive. |
| `includeInactive` | query | No | `boolean` | Deprecated. When status is omitted, includeInactive=true maps to status=all; ignored when status is supplied. |
| `period` | query | No | `today` \| `yesterday` \| `last1d` \| `last7d` \| `last14d` \| `last30d` \| `total` | Optional rolling top-ads period. Allowed values: today, yesterday, last1d, last7d, last14d, last30d, total. |
| `snapshotDate` | query | No | `object` | Deprecated compatibility parameter accepted but ignored by canonical top-ads current ranking. Use freshness/system endpoints for snapshot availability checks. |

## Responses

### 200 - Paginated brandtracker top ads response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": [
    {
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
| `data` | `object`[] | Yes |  |
| `pagination` | `object` | Yes |  |
| `meta` | `object` | No | Optional empty-result diagnostics. Omitted on normal top-ads responses. |

**`data[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `ad` | `object` | Yes |  |
| `metrics` | `object` | Yes |  |

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

### 404 - The brandtracker could not be found in the authenticated workspace or is not active.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
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

# Get brandtracker ad rank compatibility data

`GET /v1/brandtrackers/{brandtrackerId}/ad-rank`

Compatibility endpoint for clients that still call /ad-rank. Prefer /v1/brandtrackers/{brandtrackerId}/top-ads?sortBy=rankDelta7d, rankDelta14d, or rankDelta30d for canonical rank movers and sortBy=currentRank for current ranking. Endpoint key, billing, and response envelope remain stable; snapshotDate is deprecated and ignored on the ES-backed path, and trajectory may be empty.

**Tags:** Brandtrackers

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `brandtrackerId` | path | Yes | `string` | Public brandtracker identifier. This endpoint resolves brandtracker.id inside the authenticated workspace; legacy spyders.uuid values are accepted when migration metadata exists. |
| `page` | query | No | `integer` | Pagination page number. Defaults to 1. |
| `limit` | query | No | `integer` | Maximum number of items to return. Defaults to 20. |
| `timeWindow` | query | No | `last7d` \| `last14d` \| `last30d` \| `7d` \| `14d` \| `30d` | Scaling comparison window. Prefer stable windows (last7d or last14d) for agent workflows. |
| `sortBy` | query | No | `rankDelta` \| `currentRank` \| `rank_delta` \| `current_rank` | Optional scaling ads sort key. Defaults to rankDelta. Also accepts legacy aliases rank_delta and current_rank. |
| `snapshotDate` | query | No | `string` | Deprecated compatibility parameter accepted but ignored on the ES-backed compatibility path. Use top-ads sortBy=rankDelta7d/14d/30d for canonical rank movers. |
| `maxCurrentRank` | query | No | `integer` | Optional maximum current rank filter. Only ads at or above this current rank are returned. |
| `minRankDelta` | query | No | `integer` | Minimum positive rank improvement required for an ad to be returned. Defaults to 1. |

## Responses

### 200 - Paginated brandtracker ad rank response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": [
    {
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
  },
  "meta": {
    "requestedSnapshotDate": "latest",
    "resolvedSnapshotDate": "2026-04-23",
    "dataFreshnessLagDays": 1,
    "periodNote": "period=today uses the latest ready completed snapshot date instead of partial current-day data."
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
| `ad` | `object` | Yes |  |
| `metrics` | `object` | Yes |  |
| `trajectory` | `object`[] | Yes | Daily rank trajectory for this ad over the selected comparison window. |

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

**`meta` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `requestedSnapshotDate` | `string` | Yes | Snapshot date requested by the client. Null when snapshotDate was omitted. |
| `resolvedSnapshotDate` | `string` | Yes | Snapshot date actually used by the endpoint. Null when no ready snapshot was available or no snapshot resolution was needed. |
| `dataFreshnessLagDays` | `number` | Yes | Difference in whole UTC days between today and the resolved snapshot date. Null when no snapshot was resolved. |
| `periodNote` | `string` | No | Optional note clarifying period-specific freshness behavior. |

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

### 404 - The brandtracker could not be found in the authenticated workspace or is not active.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
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

# Get brandtracker scaling ads compatibility data

`GET /v1/brandtrackers/{brandtrackerId}/scaling-ads`

Legacy compatibility endpoint for clients that still call /scaling-ads. Prefer /v1/brandtrackers/{brandtrackerId}/top-ads?sortBy=rankDelta7d, rankDelta14d, or rankDelta30d for canonical rank movers and sortBy=currentRank for current ranking. Endpoint key, billing, and response envelope remain stable; snapshotDate is deprecated and ignored on the ES-backed path, and trajectory may be empty.

**Tags:** Brandtrackers

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `brandtrackerId` | path | Yes | `string` | Public brandtracker identifier. This endpoint resolves brandtracker.id inside the authenticated workspace; legacy spyders.uuid values are accepted when migration metadata exists. |
| `page` | query | No | `integer` | Pagination page number. Defaults to 1. |
| `limit` | query | No | `integer` | Maximum number of items to return. Defaults to 20. |
| `timeWindow` | query | No | `last7d` \| `last14d` \| `last30d` \| `7d` \| `14d` \| `30d` | Scaling comparison window. Prefer stable windows (last7d or last14d) for agent workflows. |
| `sortBy` | query | No | `rankDelta` \| `currentRank` \| `rank_delta` \| `current_rank` | Optional scaling ads sort key. Defaults to rankDelta. Also accepts legacy aliases rank_delta and current_rank. |
| `snapshotDate` | query | No | `string` | Deprecated compatibility parameter accepted but ignored on the ES-backed compatibility path. Use top-ads sortBy=rankDelta7d/14d/30d for canonical rank movers. |
| `maxCurrentRank` | query | No | `integer` | Optional maximum current rank filter. Only ads at or above this current rank are returned. |
| `minRankDelta` | query | No | `integer` | Minimum positive rank improvement required for an ad to be returned. Defaults to 1. |

## Responses

### 200 - Paginated brandtracker scaling ads response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": [
    {
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
  },
  "meta": {
    "requestedSnapshotDate": "latest",
    "resolvedSnapshotDate": "2026-04-23",
    "dataFreshnessLagDays": 1,
    "periodNote": "period=today uses the latest ready completed snapshot date instead of partial current-day data."
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
| `ad` | `object` | Yes |  |
| `metrics` | `object` | Yes |  |
| `trajectory` | `object`[] | Yes | Daily rank trajectory for this ad over the selected comparison window. |

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

**`meta` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `requestedSnapshotDate` | `string` | Yes | Snapshot date requested by the client. Null when snapshotDate was omitted. |
| `resolvedSnapshotDate` | `string` | Yes | Snapshot date actually used by the endpoint. Null when no ready snapshot was available or no snapshot resolution was needed. |
| `dataFreshnessLagDays` | `number` | Yes | Difference in whole UTC days between today and the resolved snapshot date. Null when no snapshot was resolved. |
| `periodNote` | `string` | No | Optional note clarifying period-specific freshness behavior. |

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

### 404 - The brandtracker could not be found in the authenticated workspace or is not active.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
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

# Get brandtracker overview

`GET /v1/brandtrackers/{brandtrackerId}/overview`

Returns a dashboard-style Brandtracker overview combining graph, media mix, top landing pages, top ads, and ads preview sections. The graph accepts timeSeriesPeriod for rolling windows or timeSeriesStartDate/timeSeriesEndDate for explicit ranges; do not combine them.

**Tags:** Brandtrackers

## Parameters

**Query parameter groups:**

- Time and snapshots: `snapshotDate`, `timeSeriesStartDate`, `timeSeriesEndDate`, `timeSeriesPeriod`, `landingPagesTimePeriod`, `topAdsPeriod`
- Sorting: `topAdsSortBy`
- Filters: `euOnly`, `cpm`, `timeSeriesGranularity`, `landingPagesLimit`, `topAdsLimit`, `adsPreviewLimit`

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `brandtrackerId` | path | Yes | `string` | Public brandtracker identifier. This endpoint resolves brandtracker.id inside the authenticated workspace; legacy spyders.uuid values are accepted when migration metadata exists. |
| `euOnly` | query | No | `boolean` | Optional EU-only filter forwarded to graph, media mix, landing pages, and top ads sections where supported. |
| `snapshotDate` | query | No | `object` | Snapshot date for dashboard time travel. Use YYYY-MM-DD or latest. |
| `cpm` | query | No | `number` | CPM used to estimate spend in the graph section. |
| `timeSeriesGranularity` | query | No | `daily` \| `weekly` \| `monthly` | Bucket size for the graph section. Defaults to daily. |
| `timeSeriesStartDate` | query | No | `string` | Inclusive graph start date. Cannot be combined with timeSeriesPeriod. |
| `timeSeriesEndDate` | query | No | `string` | Inclusive graph end date. Cannot be combined with timeSeriesPeriod. |
| `timeSeriesPeriod` | query | No | `today` \| `yesterday` \| `1d` \| `7d` \| `14d` \| `30d` \| `90d` \| `365d` | Optional rolling window for the graph section. Supports today, yesterday, 1d, 7d, 14d, 30d, 90d, and 365d. Cannot be combined with timeSeriesStartDate or timeSeriesEndDate; snapshotDate may anchor the window. |
| `landingPagesTimePeriod` | query | No | `live` \| `last24h` \| `last3d` \| `last7d` \| `last30d` \| `last3m` \| `last6m` \| `last1y` | Time window for top landing pages. Defaults to live for dashboard-style current overview. |
| `landingPagesLimit` | query | No | `integer` | Maximum number of top landing pages to return. Defaults to 5. |
| `topAdsLimit` | query | No | `integer` | Maximum number of top ads to return. Defaults to 5. |
| `adsPreviewLimit` | query | No | `integer` | Maximum number of ads preview items to return. Defaults to 10. |
| `topAdsSortBy` | query | No | `currentRank` \| `rankDelta` \| `rankDelta7d` \| `rankDelta14d` \| `rankDelta30d` \| `reach` \| `reachDelta1d` \| `reachDelta7d` \| `reachDelta30d` \| `daysRunning` \| `duplicates` | Optional top ads sorting. Defaults to reach when euOnly=true, otherwise daysRunning. |
| `topAdsPeriod` | query | No | `today` \| `yesterday` \| `last1d` \| `last7d` \| `last14d` \| `last30d` \| `total` | Optional top ads period. Supports `today`, `yesterday`, `last1d`, `last7d`, `last14d`, `last30d`, and `total`. Defaults to `total`. |

## Responses

### 200 - Brandtracker overview response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": {
    "graph": {
      "granularity": "daily",
      "dateRange": {
        "startDate": "2026-01-01",
        "endDate": "2026-04-20"
      },
      "adsLaunched": [
        {
          "date": "2026-04-20",
          "count": 12
        }
      ],
      "liveAds": [
        {
          "date": "2026-04-20",
          "count": 12
        }
      ],
      "euImpressionsSpend": [
        {
          "date": "2026-04-20",
          "impressions": 12450,
          "cumulativeImpressions": 431200,
          "estimatedSpend": 112.05
        }
      ],
      "cpm": 9
    },
    "mediaMix": {
      "activeAds": 23,
      "formatCount": {
        "image": 12,
        "video": 8,
        "dco": 2,
        "other": 1
      }
    },
    "topLandingPages": {
      "data": [
        {
          "landingPage": "https://example.com/products/summer-sale",
          "usageCount": 16,
          "longestRunning": 41,
          "totalImpressions": 305400,
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
        }
      ],
      "pagination": {
        "page": 1,
        "limit": 20,
        "total": 128,
        "totalPages": 7
      }
    },
    "topAds": {
      "data": [
        {
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
      }
    },
    "adsPreview": {
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
  },
  "meta": {}
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `data` | `object` | Yes |  |
| `meta` | `object` | Yes | Reserved response metadata. Snapshot freshness is intentionally omitted from overview to match top-ads. |

**`data` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `graph` | `object` | Yes |  |
| `mediaMix` | `object` | Yes |  |
| `topLandingPages` | `object` | Yes |  |
| `topAds` | `object` | Yes |  |
| `adsPreview` | `object` | Yes |  |

**`graph` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `granularity` | `daily` \| `weekly` \| `monthly` | Yes |  |
| `dateRange` | `object` | Yes |  |
| `adsLaunched` | `object`[] | Yes |  |
| `liveAds` | `object`[] | Yes |  |
| `euImpressionsSpend` | `object`[] | Yes | EU impressions/reach spend time series. For Meta Ad Library data, reach is the public-facing impressions-style vocabulary used by related ad DTOs. |
| `cpm` | `number` | Yes |  |

**`dateRange` properties:**


**`adsLaunched[]` item properties:**


**`liveAds[]` item properties:**


**`euImpressionsSpend[]` item properties:**


**`mediaMix` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `activeAds` | `number` | Yes | Number of deduped eligible ads in the media mix. Equals image + video + dco + other. |
| `formatCount` | `object` | Yes | Media-format buckets counted from the same deduped eligible-ad set as activeAds. Carousel is not exposed as a separate media-mix bucket; carousel creatives are currently folded into image, video, dco, or other based on the indexed media format. |

**`formatCount` properties:**


**`topLandingPages` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `data` | `object`[] | Yes |  |
| `pagination` | `object` | Yes |  |

**`data[]` item properties:**


**`pagination` properties:**


**`topAds` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `data` | `object`[] | Yes |  |
| `pagination` | `object` | Yes |  |

**`data[]` item properties:**


**`pagination` properties:**


**`adsPreview` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `data` | `object`[] | Yes |  |
| `pagination` | `object` | Yes |  |

**`data[]` item properties:**


**`pagination` properties:**


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

### 404 - The brandtracker could not be found in the authenticated workspace or is not active.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
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

# List brandtracker timeline ads

`GET /v1/brandtrackers/{brandtrackerId}/timeline`

Returns timeline-ready Meta ads for one active workspace brandtracker resolved from brandtracker.id. Timeline membership includes non-deleted Facebook ads with media available in the bucket and a non-null start date.

**Tags:** Brandtrackers

## Parameters

**Query parameter groups:**

- Pagination: `page`, `limit`
- Search: `keywordMode`
- Time and snapshots: `createdAfter`, `createdBefore`, `spendPeriod`, `spendPerPagePeriod`, `snapshotDate`
- Sorting: `sortBy`
- Filters: `status`, `mediaType`, `keywords`, `minDaysRunning`, `maxDaysRunning`, `minDuplicates`, `maxDuplicates`, `landingPages`, `adLanguage`, `cta`, `adCopyHashes`, `adCountries`, `mainCountries`, `euOnly`, `partners`, `partnerIds`, `minReach`, `maxReach`, `cpm`, `minSpend`, `maxSpend`, `minSpendPerPage`, `maxSpendPerPage`, `hideLowReach`, `minAge`, `maxAge`, `sex`, `minFacebookLikes`, `maxFacebookLikes`, `minInstagramFollowers`, `maxInstagramFollowers`, `minVideoDuration`, `maxVideoDuration`, `minDescriptionLength`, `maxDescriptionLength`, `linkedDomain`, `growthRank`, `startedAfter`, `startedBefore`, `lastSeenAfter`, `lastSeenBefore`

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `brandtrackerId` | path | Yes | `string` | Public brandtracker identifier. This endpoint resolves brandtracker.id inside the authenticated workspace; legacy spyders.uuid values are accepted when migration metadata exists. |
| `page` | query | No | `integer` |  |
| `limit` | query | No | `integer` |  |
| `sortBy` | query | No | `newest` \| `createdAt` \| `longestRunning` \| `reach` \| `duplicates` \| `adOrder` \| `relevance` | Sort key for this request. Allowed values: `newest`, `createdAt`, `longestRunning`, `reach`, `duplicates`, `adOrder`, `relevance`. |
| `status` | query | No | `all` \| `active` \| `inactive` | Status filter for this request. Allowed values: `all`, `active`, `inactive`. |
| `mediaType` | query | No | `all` \| `image` \| `video` | Enum value accepted by this request. Allowed values: `all`, `image`, `video`. |
| `keywords` | query | No | `string`[] | Keyword search terms. Repeated query params and comma-separated values are both accepted. |
| `keywordMode` | query | No | `any` \| `all` | Enum value accepted by this request. Allowed values: `any`, `all`. |
| `createdAfter` | query | No | `string` |  |
| `createdBefore` | query | No | `string` |  |
| `minDaysRunning` | query | No | `integer` |  |
| `maxDaysRunning` | query | No | `integer` |  |
| `minDuplicates` | query | No | `integer` |  |
| `maxDuplicates` | query | No | `integer` |  |
| `landingPages` | query | No | `string`[] | Landing page URLs. Repeated query params and comma-separated values are both accepted. |
| `adLanguage` | query | No | `string`[] | Ad languages. Repeated query params and comma-separated values are both accepted. |
| `cta` | query | No | `string`[] | Call-to-action labels. Repeated query params and comma-separated values are both accepted. |
| `adCopyHashes` | query | No | `string`[] | 12-character MD5 prefixes of ad copy descriptions. Repeated query params and comma-separated values are both accepted. |
| `adCountries` | query | No | `string` | Ad country include/exclude filter. Use comma-separated ISO codes with include/exclude modes. |
| `mainCountries` | query | No | `string`[] | Main ad countries. Repeated query params and comma-separated values are both accepted. |
| `euOnly` | query | No | `boolean` | When true, keep only ads flagged as EU ads. |
| `partners` | query | No | `boolean` | When true, keep only partnership ads. When false, keep only non-partnership ads. |
| `partnerIds` | query | No | `string`[] | Partner identifiers. Repeated query params and comma-separated values are both accepted. |
| `minReach` | query | No | `integer` | Minimum ad reach threshold. Backed by the internal reach/impressions analytics field. |
| `maxReach` | query | No | `integer` | Maximum ad reach threshold. Backed by the internal reach/impressions analytics field. |
| `cpm` | query | No | `number` | CPM used to convert spend filters into reach thresholds. |
| `minSpend` | query | No | `number` |  |
| `maxSpend` | query | No | `number` |  |
| `spendPeriod` | query | No | `total` \| `last24h` \| `last7d` \| `last30d` | Enum value accepted by this request. Allowed values: `total`, `last24h`, `last7d`, `last30d`. |
| `minSpendPerPage` | query | No | `number` |  |
| `maxSpendPerPage` | query | No | `number` |  |
| `spendPerPagePeriod` | query | No | `total` \| `last24h` \| `last7d` \| `last30d` | Enum value accepted by this request. Allowed values: `total`, `last24h`, `last7d`, `last30d`. |
| `hideLowReach` | query | No | `boolean` | When true, hides ads flagged as low reach. |
| `minAge` | query | No | `integer` |  |
| `maxAge` | query | No | `integer` |  |
| `sex` | query | No | `men` \| `women` \| `all` | Enum value accepted by this request. Allowed values: `men`, `women`, `all`. |
| `minFacebookLikes` | query | No | `integer` |  |
| `maxFacebookLikes` | query | No | `integer` |  |
| `minInstagramFollowers` | query | No | `integer` |  |
| `maxInstagramFollowers` | query | No | `integer` |  |
| `minVideoDuration` | query | No | `number` |  |
| `maxVideoDuration` | query | No | `number` |  |
| `minDescriptionLength` | query | No | `integer` |  |
| `maxDescriptionLength` | query | No | `integer` |  |
| `linkedDomain` | query | No | `string` | Linked domain filter. URLs are normalized to their hostname before validation. |
| `growthRank` | query | No | `rising` \| `falling` \| `stable`[] | Rank trend filters. Repeated query params and comma-separated values are both accepted. |
| `snapshotDate` | query | No | `string` | Snapshot date (YYYY-MM-DD or latest). When present, status is interpreted as active at this date. |
| `startedAfter` | query | No | `string` | Inclusive ad start-date lower bound. |
| `startedBefore` | query | No | `string` | Inclusive ad start-date upper bound. |
| `lastSeenAfter` | query | No | `string` | Inclusive effective timeline end-date lower bound. Active ads use today, or snapshotDate when provided. |
| `lastSeenBefore` | query | No | `string` | Inclusive effective timeline end-date upper bound. Active ads use today, or snapshotDate when provided. |

## Responses

### 200 - Paginated brandtracker timeline response. The response also includes the X-Request-Id header.

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

### 404 - The brandtracker could not be found in the authenticated workspace or is not active.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
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

# Get brandtracker timeline metadata

`GET /v1/brandtrackers/{brandtrackerId}/timeline/metadata`

Returns total count and date bounds for the same filter membership used by the brandtracker timeline endpoint.

**Tags:** Brandtrackers

## Parameters

**Query parameter groups:**

- Search: `keywordMode`
- Time and snapshots: `createdAfter`, `createdBefore`, `spendPeriod`, `spendPerPagePeriod`, `snapshotDate`
- Filters: `status`, `mediaType`, `keywords`, `minDaysRunning`, `maxDaysRunning`, `minDuplicates`, `maxDuplicates`, `landingPages`, `adLanguage`, `cta`, `adCopyHashes`, `adCountries`, `mainCountries`, `euOnly`, `partners`, `partnerIds`, `minReach`, `maxReach`, `cpm`, `minSpend`, `maxSpend`, `minSpendPerPage`, `maxSpendPerPage`, `hideLowReach`, `minAge`, `maxAge`, `sex`, `minFacebookLikes`, `maxFacebookLikes`, `minInstagramFollowers`, `maxInstagramFollowers`, `minVideoDuration`, `maxVideoDuration`, `minDescriptionLength`, `maxDescriptionLength`, `linkedDomain`, `growthRank`, `startedAfter`, `startedBefore`, `lastSeenAfter`, `lastSeenBefore`

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `brandtrackerId` | path | Yes | `string` | Public brandtracker identifier. This endpoint resolves brandtracker.id inside the authenticated workspace; legacy spyders.uuid values are accepted when migration metadata exists. |
| `status` | query | No | `all` \| `active` \| `inactive` | Status filter for this request. Allowed values: `all`, `active`, `inactive`. |
| `mediaType` | query | No | `all` \| `image` \| `video` | Enum value accepted by this request. Allowed values: `all`, `image`, `video`. |
| `keywords` | query | No | `string`[] | Keyword search terms. Repeated query params and comma-separated values are both accepted. |
| `keywordMode` | query | No | `any` \| `all` | Enum value accepted by this request. Allowed values: `any`, `all`. |
| `createdAfter` | query | No | `string` |  |
| `createdBefore` | query | No | `string` |  |
| `minDaysRunning` | query | No | `integer` |  |
| `maxDaysRunning` | query | No | `integer` |  |
| `minDuplicates` | query | No | `integer` |  |
| `maxDuplicates` | query | No | `integer` |  |
| `landingPages` | query | No | `string`[] | Landing page URLs. Repeated query params and comma-separated values are both accepted. |
| `adLanguage` | query | No | `string`[] | Ad languages. Repeated query params and comma-separated values are both accepted. |
| `cta` | query | No | `string`[] | Call-to-action labels. Repeated query params and comma-separated values are both accepted. |
| `adCopyHashes` | query | No | `string`[] | 12-character MD5 prefixes of ad copy descriptions. Repeated query params and comma-separated values are both accepted. |
| `adCountries` | query | No | `string` | Ad country include/exclude filter. Use comma-separated ISO codes with include/exclude modes. |
| `mainCountries` | query | No | `string`[] | Main ad countries. Repeated query params and comma-separated values are both accepted. |
| `euOnly` | query | No | `boolean` | When true, keep only ads flagged as EU ads. |
| `partners` | query | No | `boolean` | When true, keep only partnership ads. When false, keep only non-partnership ads. |
| `partnerIds` | query | No | `string`[] | Partner identifiers. Repeated query params and comma-separated values are both accepted. |
| `minReach` | query | No | `integer` | Minimum ad reach threshold. Backed by the internal reach/impressions analytics field. |
| `maxReach` | query | No | `integer` | Maximum ad reach threshold. Backed by the internal reach/impressions analytics field. |
| `cpm` | query | No | `number` | CPM used to convert spend filters into reach thresholds. |
| `minSpend` | query | No | `number` |  |
| `maxSpend` | query | No | `number` |  |
| `spendPeriod` | query | No | `total` \| `last24h` \| `last7d` \| `last30d` | Enum value accepted by this request. Allowed values: `total`, `last24h`, `last7d`, `last30d`. |
| `minSpendPerPage` | query | No | `number` |  |
| `maxSpendPerPage` | query | No | `number` |  |
| `spendPerPagePeriod` | query | No | `total` \| `last24h` \| `last7d` \| `last30d` | Enum value accepted by this request. Allowed values: `total`, `last24h`, `last7d`, `last30d`. |
| `hideLowReach` | query | No | `boolean` | When true, hides ads flagged as low reach. |
| `minAge` | query | No | `integer` |  |
| `maxAge` | query | No | `integer` |  |
| `sex` | query | No | `men` \| `women` \| `all` | Enum value accepted by this request. Allowed values: `men`, `women`, `all`. |
| `minFacebookLikes` | query | No | `integer` |  |
| `maxFacebookLikes` | query | No | `integer` |  |
| `minInstagramFollowers` | query | No | `integer` |  |
| `maxInstagramFollowers` | query | No | `integer` |  |
| `minVideoDuration` | query | No | `number` |  |
| `maxVideoDuration` | query | No | `number` |  |
| `minDescriptionLength` | query | No | `integer` |  |
| `maxDescriptionLength` | query | No | `integer` |  |
| `linkedDomain` | query | No | `string` | Linked domain filter. URLs are normalized to their hostname before validation. |
| `growthRank` | query | No | `rising` \| `falling` \| `stable`[] | Rank trend filters. Repeated query params and comma-separated values are both accepted. |
| `snapshotDate` | query | No | `string` | Snapshot date (YYYY-MM-DD or latest). When present, status is interpreted as active at this date. |
| `startedAfter` | query | No | `string` | Inclusive ad start-date lower bound. |
| `startedBefore` | query | No | `string` | Inclusive ad start-date upper bound. |
| `lastSeenAfter` | query | No | `string` | Inclusive effective timeline end-date lower bound. Active ads use today, or snapshotDate when provided. |
| `lastSeenBefore` | query | No | `string` | Inclusive effective timeline end-date upper bound. Active ads use today, or snapshotDate when provided. |

## Responses

### 200 - Brandtracker timeline metadata response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": {
    "totalCount": 235,
    "earliestDate": "2026-04-01",
    "latestDate": "2026-04-23"
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
| `totalCount` | `number` | Yes |  |
| `earliestDate` | `string` | Yes |  |
| `latestDate` | `string` | Yes |  |

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

### 404 - The brandtracker could not be found in the authenticated workspace or is not active.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
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

# List brandtracker creative testing batches

`GET /v1/brandtrackers/{brandtrackerId}/testing`

Returns creative-testing batches grouped by ad start date for one active workspace brandtracker resolved from brandtracker.id. Testing membership includes non-deleted Facebook ads with media available in the bucket and a non-null start date. To keep response size and metering bounded, each batch returns at most 20 ads and exposes truncation metadata.

**Tags:** Brandtrackers

## Parameters

**Query parameter groups:**

- Pagination: `page`, `limit`
- Search: `keywordMode`
- Time and snapshots: `createdAfter`, `createdBefore`, `spendPeriod`, `spendPerPagePeriod`, `snapshotDate`
- Filters: `status`, `mediaType`, `keywords`, `minDaysRunning`, `maxDaysRunning`, `minDuplicates`, `maxDuplicates`, `landingPages`, `adLanguage`, `cta`, `adCopyHashes`, `adCountries`, `mainCountries`, `euOnly`, `partners`, `partnerIds`, `minReach`, `maxReach`, `cpm`, `minSpend`, `maxSpend`, `minSpendPerPage`, `maxSpendPerPage`, `hideLowReach`, `minAge`, `maxAge`, `sex`, `minFacebookLikes`, `maxFacebookLikes`, `minInstagramFollowers`, `maxInstagramFollowers`, `minVideoDuration`, `maxVideoDuration`, `minDescriptionLength`, `maxDescriptionLength`, `linkedDomain`, `growthRank`, `startedAfter`, `startedBefore`, `lastSeenAfter`, `lastSeenBefore`

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `brandtrackerId` | path | Yes | `string` | Public brandtracker identifier. This endpoint resolves brandtracker.id inside the authenticated workspace; legacy spyders.uuid values are accepted when migration metadata exists. |
| `page` | query | No | `integer` | Batch page number. Pagination is by distinct ad start-date batches. |
| `limit` | query | No | `integer` | Number of distinct start-date batches to return. Each batch returns at most 20 ads. |
| `status` | query | No | `all` \| `active` \| `inactive` | Status filter for this request. Allowed values: `all`, `active`, `inactive`. |
| `mediaType` | query | No | `all` \| `image` \| `video` | Enum value accepted by this request. Allowed values: `all`, `image`, `video`. |
| `keywords` | query | No | `string`[] | Keyword search terms. Repeated query params and comma-separated values are both accepted. |
| `keywordMode` | query | No | `any` \| `all` | Enum value accepted by this request. Allowed values: `any`, `all`. |
| `createdAfter` | query | No | `string` |  |
| `createdBefore` | query | No | `string` |  |
| `minDaysRunning` | query | No | `number` |  |
| `maxDaysRunning` | query | No | `number` |  |
| `minDuplicates` | query | No | `number` |  |
| `maxDuplicates` | query | No | `number` |  |
| `landingPages` | query | No | `string`[] | Landing page URLs. Repeated query params and comma-separated values are both accepted. |
| `adLanguage` | query | No | `string`[] | Ad languages. Repeated query params and comma-separated values are both accepted. |
| `cta` | query | No | `string`[] | Call-to-action labels. Repeated query params and comma-separated values are both accepted. |
| `adCopyHashes` | query | No | `string`[] | 12-character MD5 prefixes of ad copy descriptions. Repeated query params and comma-separated values are both accepted. |
| `adCountries` | query | No | `string` | Ad country include/exclude filter. Use comma-separated ISO codes with include/exclude modes. |
| `mainCountries` | query | No | `string`[] | Main ad countries. Repeated query params and comma-separated values are both accepted. |
| `euOnly` | query | No | `boolean` | When true, keep only ads flagged as EU ads. |
| `partners` | query | No | `boolean` | When true, keep only partnership ads. When false, keep only non-partnership ads. |
| `partnerIds` | query | No | `string`[] | Partner identifiers. Repeated query params and comma-separated values are both accepted. |
| `minReach` | query | No | `number` | Minimum ad reach threshold. Backed by the internal reach/impressions analytics field. |
| `maxReach` | query | No | `number` | Maximum ad reach threshold. Backed by the internal reach/impressions analytics field. |
| `cpm` | query | No | `number` | CPM used to convert spend filters into reach thresholds. |
| `minSpend` | query | No | `number` |  |
| `maxSpend` | query | No | `number` |  |
| `spendPeriod` | query | No | `total` \| `last24h` \| `last7d` \| `last30d` | Enum value accepted by this request. Allowed values: `total`, `last24h`, `last7d`, `last30d`. |
| `minSpendPerPage` | query | No | `number` |  |
| `maxSpendPerPage` | query | No | `number` |  |
| `spendPerPagePeriod` | query | No | `total` \| `last24h` \| `last7d` \| `last30d` | Enum value accepted by this request. Allowed values: `total`, `last24h`, `last7d`, `last30d`. |
| `hideLowReach` | query | No | `boolean` | When true, hides ads flagged as low reach. |
| `minAge` | query | No | `number` |  |
| `maxAge` | query | No | `number` |  |
| `sex` | query | No | `men` \| `women` \| `all` | Enum value accepted by this request. Allowed values: `men`, `women`, `all`. |
| `minFacebookLikes` | query | No | `number` |  |
| `maxFacebookLikes` | query | No | `number` |  |
| `minInstagramFollowers` | query | No | `number` |  |
| `maxInstagramFollowers` | query | No | `number` |  |
| `minVideoDuration` | query | No | `number` |  |
| `maxVideoDuration` | query | No | `number` |  |
| `minDescriptionLength` | query | No | `number` |  |
| `maxDescriptionLength` | query | No | `number` |  |
| `linkedDomain` | query | No | `string` | Linked domain filter. URLs are normalized to their hostname before validation. |
| `growthRank` | query | No | `rising` \| `falling` \| `stable`[] | Rank trend filters. Repeated query params and comma-separated values are both accepted. |
| `snapshotDate` | query | No | `string` | Snapshot date (YYYY-MM-DD or latest). When present, status is interpreted as active at this date. |
| `startedAfter` | query | No | `string` | Inclusive ad start-date lower bound. |
| `startedBefore` | query | No | `string` | Inclusive ad start-date upper bound. |
| `lastSeenAfter` | query | No | `string` | Inclusive effective timeline end-date lower bound. Active ads use today, or snapshotDate when provided. |
| `lastSeenBefore` | query | No | `string` | Inclusive effective timeline end-date upper bound. Active ads use today, or snapshotDate when provided. |

## Responses

### 200 - Paginated brandtracker testing response. Pagination is by start-date batches and the response includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": [
    {
      "startDate": "2026-04-20",
      "ads": [
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
      "adsReturned": 20,
      "maxAdsPerBatch": 20,
      "adsTruncated": false,
      "runningCount": 1,
      "isWinner": true,
      "stats": {
        "reach": {
          "min": 1200,
          "avg": 4200,
          "max": 9800,
          "total": 16800
        },
        "daysRunning": {
          "min": 2,
          "avg": 12,
          "max": 31
        },
        "activeCount": 2,
        "totalCount": 4,
        "bestPerformerId": "facebook_123456789"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 73,
    "totalPages": 3
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
| `startDate` | `string` | Yes |  |
| `ads` | `object`[] | Yes |  |
| `adsReturned` | `number` | Yes | Number of ads returned in this batch after the per-batch cap. |
| `maxAdsPerBatch` | `number` | Yes | Maximum ads returned per start-date batch. |
| `adsTruncated` | `boolean` | Yes | True when more matching ads exist for this start-date batch than were returned. |
| `runningCount` | `number` | Yes |  |
| `isWinner` | `boolean` | Yes | True when the batch matches the creative-testing winner heuristics. |
| `stats` | `object` | Yes |  |

**`ads[]` item properties:**


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


**`stats` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `reach` | `object` | Yes |  |
| `daysRunning` | `object` | Yes |  |
| `activeCount` | `number` | Yes |  |
| `totalCount` | `number` | Yes |  |
| `bestPerformerId` | `string` | Yes |  |

**`reach` properties:**


**`daysRunning` properties:**


**`pagination` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `page` | `number` | Yes |  |
| `limit` | `number` | Yes | Number of start-date batches requested per page. |
| `total` | `number` | Yes | Total matching start-date batches. |
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

### 404 - The brandtracker could not be found in the authenticated workspace or is not active.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
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

# Get brandtracker time-series

`GET /v1/brandtrackers/{brandtrackerId}/time-series`

Returns graph-ready Brandtracker time-series for ads launched, live ads history, and EU impression/spend deltas. Use period for rolling windows, or startDate/endDate for explicit ranges; do not combine period with date params.

**Tags:** Brandtrackers

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `brandtrackerId` | path | Yes | `string` | Public brandtracker identifier. This endpoint resolves brandtracker.id inside the authenticated workspace; legacy spyders.uuid values are accepted when migration metadata exists. |
| `granularity` | query | No | `daily` \| `weekly` \| `monthly` | Bucket size for the returned graph data. Defaults to daily. |
| `startDate` | query | No | `string` | Inclusive start date. Defaults to 365 days before the effective end date. Cannot be combined with period. |
| `endDate` | query | No | `string` | Inclusive end date. Defaults to today unless snapshotDate is provided. Cannot be combined with period. |
| `snapshotDate` | query | No | `string` | Optional snapshot date. When provided with period, it anchors the rolling window; otherwise it is used as the effective end date. |
| `period` | query | No | `today` \| `yesterday` \| `1d` \| `7d` \| `14d` \| `30d` \| `90d` \| `365d` | Optional rolling window for the time-series. Supports today, yesterday, 1d, 7d, 14d, 30d, 90d, and 365d. Cannot be combined with startDate or endDate; snapshotDate may anchor the window. |
| `euOnly` | query | No | `boolean` | When true, only EU-classified ads are counted for adsLaunched. |
| `cpm` | query | No | `number` | CPM used to estimate spend from EU impression deltas. |

## Responses

### 200 - Brandtracker time-series response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": {
    "granularity": "daily",
    "dateRange": {
      "startDate": "2026-01-01",
      "endDate": "2026-04-20"
    },
    "adsLaunched": [
      {
        "date": "2026-04-20",
        "count": 12
      }
    ],
    "liveAds": [
      {
        "date": "2026-04-20",
        "count": 12
      }
    ],
    "euImpressionsSpend": [
      {
        "date": "2026-04-20",
        "impressions": 12450,
        "cumulativeImpressions": 431200,
        "estimatedSpend": 112.05
      }
    ],
    "cpm": 9
  },
  "meta": {
    "requestedSnapshotDate": "latest",
    "resolvedSnapshotDate": "2026-04-23",
    "dataFreshnessLagDays": 1,
    "periodNote": "period=today uses the latest ready completed snapshot date instead of partial current-day data."
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `data` | `object` | Yes |  |
| `meta` | `object` | Yes |  |

**`data` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `granularity` | `daily` \| `weekly` \| `monthly` | Yes |  |
| `dateRange` | `object` | Yes |  |
| `adsLaunched` | `object`[] | Yes |  |
| `liveAds` | `object`[] | Yes |  |
| `euImpressionsSpend` | `object`[] | Yes | EU impressions/reach spend time series. For Meta Ad Library data, reach is the public-facing impressions-style vocabulary used by related ad DTOs. |
| `cpm` | `number` | Yes |  |

**`dateRange` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `startDate` | `string` | Yes |  |
| `endDate` | `string` | Yes |  |

**`adsLaunched[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `date` | `string` | Yes |  |
| `count` | `number` | Yes |  |

**`liveAds[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `date` | `string` | Yes |  |
| `count` | `number` | Yes |  |

**`euImpressionsSpend[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `date` | `string` | Yes |  |
| `impressions` | `number` | Yes | Impression delta within this bucket. |
| `cumulativeImpressions` | `number` | Yes | Latest cumulative EU impressions value observed in this bucket. |
| `estimatedSpend` | `number` | Yes | Estimated spend for this bucket, computed from impressions and cpm. |

**`meta` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `requestedSnapshotDate` | `string` | Yes | Snapshot date requested by the client. Null when snapshotDate was omitted. |
| `resolvedSnapshotDate` | `string` | Yes | Snapshot date actually used by the endpoint. Null when no ready snapshot was available or no snapshot resolution was needed. |
| `dataFreshnessLagDays` | `number` | Yes | Difference in whole UTC days between today and the resolved snapshot date. Null when no snapshot was resolved. |
| `periodNote` | `string` | No | Optional note clarifying period-specific freshness behavior. |

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

### 404 - The brandtracker could not be found in the authenticated workspace or is not active.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
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

# Get brandtracker ad copy evolution

`GET /v1/brandtrackers/{brandtrackerId}/ad-copy-evolution`

Returns graph-ready ad copy evolution series for one active workspace brandtracker resolved from brandtracker.id. Provide adCopy for exact single-text mode, or omit it to page through bounded global series ranked by active ads.

**Tags:** Brandtrackers

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `brandtrackerId` | path | Yes | `string` | Public brandtracker identifier. This endpoint resolves brandtracker.id inside the authenticated workspace; legacy spyders.uuid values are accepted when migration metadata exists. |
| `page` | query | No | `integer` | Pagination page number for global mode. Exact mode always returns at most one series. |
| `limit` | query | No | `integer` | Number of series to return in global mode. Exact mode costs and returns one series. |
| `startDate` | query | No | `string` | Inclusive start date. Defaults to 365 days before the effective end date. |
| `endDate` | query | No | `string` | Inclusive end date. Defaults to today unless snapshotDate is provided. |
| `snapshotDate` | query | No | `string` | Optional snapshot date. When provided, it is used as the effective end date. |
| `adCopy` | query | No | `string` | Exact ad copy text to return as a single evolution series. Omit for global mode. |

## Responses

### 200 - Paginated ad copy evolution response. Pagination is by distinct ad copy series and the response includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "dateRange": {
    "startDate": "2026-01-01",
    "endDate": "2026-04-20"
  },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 128,
    "totalPages": 7
  },
  "meta": {
    "requestedSnapshotDate": "latest",
    "resolvedSnapshotDate": "2026-04-23",
    "dataFreshnessLagDays": 1,
    "periodNote": "period=today uses the latest ready completed snapshot date instead of partial current-day data."
  },
  "data": [
    {
      "adCopy": "Turn your mornings into a ritual.",
      "points": [
        {
          "date": "2026-04-20",
          "recordedAt": "2026-04-20T12:30:00.000Z",
          "activeAds": 12,
          "totalAds": 48,
          "euAds": 9,
          "euActiveAds": 7,
          "totalReach": 124500,
          "percentNewAds": 18.5
        }
      ]
    }
  ]
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `dateRange` | `object` | Yes |  |
| `pagination` | `object` | Yes |  |
| `meta` | `object` | Yes |  |
| `data` | `object`[] | Yes |  |

**`dateRange` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `startDate` | `string` | Yes |  |
| `endDate` | `string` | Yes |  |

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
| `requestedSnapshotDate` | `string` | Yes | Snapshot date requested by the client. Null when snapshotDate was omitted. |
| `resolvedSnapshotDate` | `string` | Yes | Snapshot date actually used by the endpoint. Null when no ready snapshot was available or no snapshot resolution was needed. |
| `dataFreshnessLagDays` | `number` | Yes | Difference in whole UTC days between today and the resolved snapshot date. Null when no snapshot was resolved. |
| `periodNote` | `string` | No | Optional note clarifying period-specific freshness behavior. |

**`data[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `adCopy` | `string` | Yes |  |
| `points` | `object`[] | Yes |  |

**`points[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `date` | `string` | Yes |  |
| `recordedAt` | `string` | Yes | Timestamp of the history snapshot used for this point. |
| `activeAds` | `number` | Yes |  |
| `totalAds` | `number` | Yes |  |
| `euAds` | `number` | Yes |  |
| `euActiveAds` | `number` | Yes |  |
| `totalReach` | `number` | Yes | Total reach at this history point. In Meta Ad Library vocabulary, reach is the public-facing impressions-style metric where available. |
| `percentNewAds` | `number` | Yes |  |

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

### 404 - The brandtracker could not be found in the authenticated workspace or is not active.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
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

# Get brandtracker headline evolution

`GET /v1/brandtrackers/{brandtrackerId}/headline-evolution`

Returns graph-ready headline evolution series for one active workspace brandtracker resolved from brandtracker.id. Provide headline for exact single-text mode, or omit it to page through bounded global series ranked by active ads.

**Tags:** Brandtrackers

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `brandtrackerId` | path | Yes | `string` | Public brandtracker identifier. This endpoint resolves brandtracker.id inside the authenticated workspace; legacy spyders.uuid values are accepted when migration metadata exists. |
| `page` | query | No | `integer` | Pagination page number for global mode. Exact mode always returns at most one series. |
| `limit` | query | No | `integer` | Number of series to return in global mode. Exact mode costs and returns one series. |
| `startDate` | query | No | `string` | Inclusive start date. Defaults to 365 days before the effective end date. |
| `endDate` | query | No | `string` | Inclusive end date. Defaults to today unless snapshotDate is provided. |
| `snapshotDate` | query | No | `string` | Optional snapshot date. When provided, it is used as the effective end date. |
| `headline` | query | No | `string` | Exact headline text to return as a single evolution series. Omit for global mode. |

## Responses

### 200 - Paginated headline evolution response. Pagination is by distinct headline series and the response includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "dateRange": {
    "startDate": "2026-01-01",
    "endDate": "2026-04-20"
  },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 128,
    "totalPages": 7
  },
  "meta": {
    "requestedSnapshotDate": "latest",
    "resolvedSnapshotDate": "2026-04-23",
    "dataFreshnessLagDays": 1,
    "periodNote": "period=today uses the latest ready completed snapshot date instead of partial current-day data."
  },
  "data": [
    {
      "headline": "The ritual your skin was waiting for",
      "points": [
        {
          "date": "2026-04-20",
          "recordedAt": "2026-04-20T12:30:00.000Z",
          "activeAds": 12,
          "totalAds": 48,
          "euAds": 9,
          "euActiveAds": 7,
          "totalReach": 124500,
          "percentNewAds": 18.5
        }
      ]
    }
  ]
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `dateRange` | `object` | Yes |  |
| `pagination` | `object` | Yes |  |
| `meta` | `object` | Yes |  |
| `data` | `object`[] | Yes |  |

**`dateRange` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `startDate` | `string` | Yes |  |
| `endDate` | `string` | Yes |  |

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
| `requestedSnapshotDate` | `string` | Yes | Snapshot date requested by the client. Null when snapshotDate was omitted. |
| `resolvedSnapshotDate` | `string` | Yes | Snapshot date actually used by the endpoint. Null when no ready snapshot was available or no snapshot resolution was needed. |
| `dataFreshnessLagDays` | `number` | Yes | Difference in whole UTC days between today and the resolved snapshot date. Null when no snapshot was resolved. |
| `periodNote` | `string` | No | Optional note clarifying period-specific freshness behavior. |

**`data[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `headline` | `string` | Yes |  |
| `points` | `object`[] | Yes |  |

**`points[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `date` | `string` | Yes |  |
| `recordedAt` | `string` | Yes | Timestamp of the history snapshot used for this point. |
| `activeAds` | `number` | Yes |  |
| `totalAds` | `number` | Yes |  |
| `euAds` | `number` | Yes |  |
| `euActiveAds` | `number` | Yes |  |
| `totalReach` | `number` | Yes | Total reach at this history point. In Meta Ad Library vocabulary, reach is the public-facing impressions-style metric where available. |
| `percentNewAds` | `number` | Yes |  |

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

### 404 - The brandtracker could not be found in the authenticated workspace or is not active.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
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

# Get brandtracker landing page evolution

`GET /v1/brandtrackers/{brandtrackerId}/landing-page-evolution`

Returns graph-ready landing page evolution series for one active workspace brandtracker resolved from brandtracker.id. Provide landingPage for exact single-page mode, or omit it to page through bounded global series ranked by active ads.

**Tags:** Brandtrackers

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `brandtrackerId` | path | Yes | `string` | Public brandtracker identifier. This endpoint resolves brandtracker.id inside the authenticated workspace; legacy spyders.uuid values are accepted when migration metadata exists. |
| `page` | query | No | `integer` | Pagination page number for global mode. Exact mode always returns at most one series. |
| `limit` | query | No | `integer` | Number of series to return in global mode. Exact mode costs and returns one series. |
| `startDate` | query | No | `string` | Inclusive start date. Defaults to 365 days before the effective end date. |
| `endDate` | query | No | `string` | Inclusive end date. Defaults to today unless snapshotDate is provided. |
| `snapshotDate` | query | No | `string` | Optional snapshot date. When provided, it is used as the effective end date. |
| `landingPage` | query | No | `string` | Exact landing page URL to return as a single evolution series. Omit for global mode. |

## Responses

### 200 - Paginated landing page evolution response. Pagination is by distinct landing page series and the response includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "dateRange": {
    "startDate": "2026-01-01",
    "endDate": "2026-04-20"
  },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 128,
    "totalPages": 7
  },
  "meta": {
    "requestedSnapshotDate": "latest",
    "resolvedSnapshotDate": "2026-04-23",
    "dataFreshnessLagDays": 1,
    "periodNote": "period=today uses the latest ready completed snapshot date instead of partial current-day data."
  },
  "data": [
    {
      "landingPage": "https://example.com/products/ritual-kit",
      "points": [
        {
          "date": "2026-04-20",
          "recordedAt": "2026-04-20T12:30:00.000Z",
          "activeAds": 12,
          "totalAds": 48,
          "euAds": 9,
          "euActiveAds": 7,
          "totalReach": 124500,
          "percentNewAds": 18.5
        }
      ]
    }
  ]
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `dateRange` | `object` | Yes |  |
| `pagination` | `object` | Yes |  |
| `meta` | `object` | Yes |  |
| `data` | `object`[] | Yes |  |

**`dateRange` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `startDate` | `string` | Yes |  |
| `endDate` | `string` | Yes |  |

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
| `requestedSnapshotDate` | `string` | Yes | Snapshot date requested by the client. Null when snapshotDate was omitted. |
| `resolvedSnapshotDate` | `string` | Yes | Snapshot date actually used by the endpoint. Null when no ready snapshot was available or no snapshot resolution was needed. |
| `dataFreshnessLagDays` | `number` | Yes | Difference in whole UTC days between today and the resolved snapshot date. Null when no snapshot was resolved. |
| `periodNote` | `string` | No | Optional note clarifying period-specific freshness behavior. |

**`data[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `landingPage` | `string` | Yes |  |
| `points` | `object`[] | Yes |  |

**`points[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `date` | `string` | Yes |  |
| `recordedAt` | `string` | Yes | Timestamp of the history snapshot used for this point. |
| `activeAds` | `number` | Yes |  |
| `totalAds` | `number` | Yes |  |
| `euAds` | `number` | Yes |  |
| `euActiveAds` | `number` | Yes |  |
| `totalReach` | `number` | Yes | Total reach at this history point. In Meta Ad Library vocabulary, reach is the public-facing impressions-style metric where available. |
| `percentNewAds` | `number` | Yes |  |

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

### 404 - The brandtracker could not be found in the authenticated workspace or is not active.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
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
