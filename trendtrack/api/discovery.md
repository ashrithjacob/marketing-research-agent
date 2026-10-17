# Discovery

---

# Resolve a brand, advertiser, or shop

`GET /v1/lookup`

Zero-credit lookup for brand names, shop domains, Facebook page ids, and Instagram handles. Exact matches are returned before fuzzy name matches.

**Tags:** Discovery

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `q` | query | Yes | `string` | Brand name, shop domain, Facebook page id, or Instagram handle. |
| `type` | query | No | `auto` \| `brandtracker` \| `advertiser` \| `shop` | Limit lookup to one resource type, or search brandtrackers, advertisers, and shops with auto. |
| `limit` | query | No | `integer` |  |

## Responses

### 200 - Lookup results linking known brandtracker, advertiser, and shop public identifiers. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": [
    {
      "type": "shop",
      "matchType": "exact",
      "matchField": "domain",
      "score": 1,
      "brandtracker": {
        "id": "1e08fa85-625a-4ba5-b673-d2a4b7bc7c55",
        "name": "Example Brand",
        "facebookPageId": "61554990830184"
      },
      "advertiser": {
        "id": "61554990830184",
        "name": "Example Brand",
        "facebookPageId": "61554990830184"
      },
      "shop": {
        "id": "3f8aa146-6f96-46e8-9781-64db5166f9a8",
        "domain": "examplebrand.com",
        "name": "Example Brand"
      },
      "signals": {
        "activeAds": 42,
        "liveAdsCount": 42,
        "reach30d": 152340,
        "totalReach": 842100,
        "monthlyVisits": 1200000,
        "workspaceAddedAt": "2026-04-20T12:34:56.000Z",
        "hasBrandtracker": true,
        "hasAdvertiser": true,
        "hasShop": true
      }
    }
  ],
  "meta": {
    "q": "examplebrand.com",
    "type": "auto",
    "limit": 10,
    "returned": 3,
    "partial": true,
    "warnings": [
      {
        "code": "upstream_timeout",
        "type": "advertiser",
        "message": "advertiser lookup timed out. Returned available matches from other resource types."
      }
    ]
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
| `type` | `brandtracker` \| `advertiser` \| `shop` | Yes |  |
| `matchType` | `exact` \| `fuzzy` | Yes |  |
| `matchField` | `name` \| `domain` \| `facebookPageId` \| `instagramHandle` | Yes |  |
| `score` | `number` | Yes | Lookup confidence score. Exact identifier/domain/name matches return 1; fuzzy candidates return lower scores. |
| `brandtracker` | `object` | Yes |  |
| `advertiser` | `object` | Yes |  |
| `shop` | `object` | Yes |  |
| `signals` | `object` | Yes | Additive disambiguation signals derived from existing lookup candidate ranking/resource metadata. |

**`brandtracker` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes |  |
| `name` | `string` | Yes |  |
| `facebookPageId` | `string` | Yes |  |

**`advertiser` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes |  |
| `name` | `string` | Yes |  |
| `facebookPageId` | `string` | Yes |  |

**`shop` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes |  |
| `domain` | `string` | Yes |  |
| `name` | `string` | Yes |  |

**`signals` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `activeAds` | `number` | Yes | Active ads signal when available from lookup candidate ranking metadata. |
| `liveAdsCount` | `number` | Yes | Live ads signal alias when available (same source as activeAds when only one is present). |
| `reach30d` | `number` | Yes | 30-day reach signal when available from lookup ranking metadata. |
| `totalReach` | `number` | Yes | Total/current reach signal when available from lookup ranking metadata. |
| `monthlyVisits` | `number` | Yes | Monthly visits signal when available from lookup candidate ranking metadata. |
| `workspaceAddedAt` | `string` | Yes | Workspace-added timestamp signal when available from lookup candidate ranking metadata. |
| `hasBrandtracker` | `boolean` | Yes |  |
| `hasAdvertiser` | `boolean` | Yes |  |
| `hasShop` | `boolean` | Yes |  |

**`meta` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `q` | `string` | Yes |  |
| `type` | `auto` \| `brandtracker` \| `advertiser` \| `shop` | Yes |  |
| `limit` | `number` | Yes |  |
| `returned` | `number` | Yes |  |
| `partial` | `boolean` | No | Present when type=auto returned successful resource matches while one or more lookup branches timed out. |
| `warnings` | `array`[] | No |  |

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

# Resolve Facebook page and shop relationships

`GET /v1/lookup/facebook-shop`

Zero-credit resolver for deterministic Facebook page ↔ shop/site relationships. Provide exactly one Facebook page alias or one shop/site alias.

**Tags:** Discovery

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `facebook_id` | query | No | `string` | Facebook page id alias. Provide one Facebook page alias or one shop/site alias. |
| `facebookPageId` | query | No | `string` | Facebook page id alias. Provide one Facebook page alias or one shop/site alias. |
| `fb_page_id` | query | No | `string` | Facebook page id alias. Provide one Facebook page alias or one shop/site alias. |
| `shopId` | query | No | `string` | Shop/site id alias. Provide one shop/site alias or one Facebook page alias. |
| `website_id` | query | No | `string` | Shop/site id alias. Provide one shop/site alias or one Facebook page alias. |
| `limit` | query | No | `integer` |  |

## Responses

### 200 - Ordered linked shops or Facebook pages, with a primary relationship convenience field. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": {
    "input": {
      "type": "facebookPage",
      "id": "61554990830184"
    },
    "primaryShop": {
      "id": "3f8aa146-6f96-46e8-9781-64db5166f9a8",
      "domain": "examplebrand.com",
      "name": "Example Brand",
      "rank": "Main",
      "isMainRelation": true,
      "isPrimary": true,
      "trafficNumber": 125000,
      "profilePhotoUrl": "https://cdn.example.com/shop.png"
    },
    "shops": [
      {
        "id": "3f8aa146-6f96-46e8-9781-64db5166f9a8",
        "domain": "examplebrand.com",
        "name": "Example Brand",
        "rank": "Main",
        "isMainRelation": true,
        "isPrimary": true,
        "trafficNumber": 125000,
        "profilePhotoUrl": "https://cdn.example.com/shop.png"
      }
    ],
    "primaryFacebookPage": {
      "id": "61554990830184",
      "facebookPageId": "61554990830184",
      "name": "Example Brand",
      "rank": "Main",
      "isMainRelation": true,
      "isPrimary": true,
      "runningAds": 42
    },
    "facebookPages": [
      {
        "id": "61554990830184",
        "facebookPageId": "61554990830184",
        "name": "Example Brand",
        "rank": "Main",
        "isMainRelation": true,
        "isPrimary": true,
        "runningAds": 42
      }
    ]
  },
  "meta": {
    "limit": 50,
    "returnedShops": 2,
    "returnedFacebookPages": 0
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
| `input` | `object` | Yes |  |
| `primaryShop` | `object` | Yes |  |
| `shops` | `object`[] | Yes |  |
| `primaryFacebookPage` | `object` | Yes |  |
| `facebookPages` | `object`[] | Yes |  |

**`input` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `facebookPage` \| `shop` | Yes |  |
| `id` | `string` | Yes |  |

**`primaryShop` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes |  |
| `domain` | `string` | Yes |  |
| `name` | `string` | Yes |  |
| `rank` | `string` | Yes |  |
| `isMainRelation` | `boolean` | Yes |  |
| `isPrimary` | `boolean` | Yes |  |
| `trafficNumber` | `number` | Yes |  |
| `profilePhotoUrl` | `string` | Yes |  |

**`shops[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes |  |
| `domain` | `string` | Yes |  |
| `name` | `string` | Yes |  |
| `rank` | `string` | Yes |  |
| `isMainRelation` | `boolean` | Yes |  |
| `isPrimary` | `boolean` | Yes |  |
| `trafficNumber` | `number` | Yes |  |
| `profilePhotoUrl` | `string` | Yes |  |

**`primaryFacebookPage` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes |  |
| `facebookPageId` | `string` | Yes |  |
| `name` | `string` | Yes |  |
| `rank` | `string` | Yes |  |
| `isMainRelation` | `boolean` | Yes |  |
| `isPrimary` | `boolean` | Yes |  |
| `runningAds` | `number` | Yes |  |

**`facebookPages[]` item properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes |  |
| `facebookPageId` | `string` | Yes |  |
| `name` | `string` | Yes |  |
| `rank` | `string` | Yes |  |
| `isMainRelation` | `boolean` | Yes |  |
| `isPrimary` | `boolean` | Yes |  |
| `runningAds` | `number` | Yes |  |

**`meta` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `limit` | `number` | Yes |  |
| `returnedShops` | `number` | Yes |  |
| `returnedFacebookPages` | `number` | Yes |  |

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
