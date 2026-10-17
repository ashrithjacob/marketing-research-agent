# Google Ads

---

# Query Google Ads

`POST /v1/google-ads/query`

Queries the dedicated Google Ads library. Networks, audience countries, and Google category ids map to verified google-ads-search fields.

**Tags:** Google Ads

## Request Body

**Content-Type:** `application/json`

**US Shopping ads in Women’s Clothing:**

```json
{
  "status": "active",
  "networks": [
    "shopping"
  ],
  "categoryIds": [
    24
  ],
  "audienceCountries": {
    "include": [
      "US"
    ]
  },
  "sortBy": "newest",
  "order": "desc",
  "page": 1,
  "limit": 25
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `search` | `string`[] | No | Optional Google advertiser/domain search terms. |
| `status` | `active` \| `inactive` \| `all` | No |  |
| `networks` | `search` \| `shopping` \| `maps` \| `youtube` \| `other`[] | No | Google delivery networks. Values are normalized to the casing used by the Google Ads search index. |
| `categoryIds` | `number`[] | No | Google category ids returned by GET /v1/google-ads/facets/categories. These correspond to the app legacy niches parameter. |
| `audienceCountries` | `object` | No | Audience-country filter. This is intentionally distinct from advertiser/shop creation country. |
| `publishedAfter` | `string` | No |  |
| `publishedBefore` | `string` | No |  |
| `minDaysRunning` | `number` | No |  |
| `maxDaysRunning` | `number` | No |  |
| `minReach` | `number` | No |  |
| `maxReach` | `number` | No |  |
| `sortBy` | `newest` \| `reach` \| `longestRunning` | No |  |
| `order` | `asc` \| `desc` | No |  |
| `page` | `object` | No |  |
| `limit` | `object` | No |  |

**`audienceCountries` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `include` | `string`[] | No | ISO 3166-1 alpha-2 audience countries to include. Google Ads matches targeting.main_country. |
| `exclude` | `string`[] | No | ISO 3166-1 alpha-2 audience countries to exclude. Google Ads matches targeting.main_country. |

## Responses

### 200 - Paginated Google Ads response. One returned ad is one billable ads credit.

**Content-Type:** `application/json`

```json
{
  "requestId": "string",
  "data": [
    {
      "id": "google_123",
      "googleAdId": "string",
      "status": "active",
      "network": "search",
      "firstSeenAt": "2026-01-01T00:00:00.000Z",
      "lastSeenAt": "2026-01-01T00:00:00.000Z",
      "daysRunning": 0,
      "media": {
        "type": "image",
        "url": "string",
        "format": "string"
      },
      "advertiser": {
        "id": "string",
        "name": "string",
        "shopName": "string",
        "domain": "string",
        "websiteId": "string",
        "logoUrl": "string",
        "liveAds": {
          "google": 0,
          "all": 0
        }
      },
      "reach": {
        "value": 0,
        "lowerBound": 0,
        "upperBound": 0
      },
      "audience": {
        "mainCountry": "string",
        "countries": [
          {
            "code": "US",
            "percentage": 80,
            "reach": 0
          }
        ],
        "remarketing": true,
        "interest": true
      }
    }
  ],
  "pagination": {
    "page": 0,
    "limit": 0,
    "total": 0,
    "totalPages": 0
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
| `googleAdId` | `string` | Yes |  |
| `status` | `active` \| `inactive` | Yes |  |
| `network` | `search` \| `shopping` \| `maps` \| `youtube` \| `other` | Yes |  |
| `firstSeenAt` | `string` | Yes |  |
| `lastSeenAt` | `string` | Yes |  |
| `daysRunning` | `number` | Yes |  |
| `media` | `object` | Yes |  |
| `advertiser` | `object` | Yes |  |
| `reach` | `object` | Yes |  |
| `audience` | `object` | Yes |  |

**`media` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `image` \| `video` | Yes |  |
| `url` | `string` | Yes |  |
| `format` | `string` | Yes |  |

**`advertiser` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes |  |
| `name` | `string` | Yes |  |
| `shopName` | `string` | Yes |  |
| `domain` | `string` | Yes |  |
| `websiteId` | `string` | Yes |  |
| `logoUrl` | `string` | Yes |  |
| `liveAds` | `object` | Yes |  |

**`liveAds` properties:**


**`reach` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `value` | `number` | Yes |  |
| `lowerBound` | `number` | Yes |  |
| `upperBound` | `number` | Yes |  |

**`audience` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `mainCountry` | `string` | Yes |  |
| `countries` | `object`[] | Yes |  |
| `remarketing` | `boolean` | Yes |  |
| `interest` | `boolean` | Yes |  |

**`countries[]` item properties:**


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

# List Google Ads network facets

`GET /v1/google-ads/facets/networks`

Returns the normalized Google delivery networks accepted by POST /v1/google-ads/query.

**Tags:** Google Ads

## Responses

### 200 - Google delivery networks with live ad counts.

**Content-Type:** `application/json`

```json
{
  "requestId": "string",
  "data": [
    {
      "value": "shopping",
      "label": "Shopping",
      "adsCount": 0
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
| `value` | `string` | Yes |  |
| `label` | `string` | Yes |  |
| `adsCount` | `number` | Yes |  |

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

# List Google Ads audience-country facets

`GET /v1/google-ads/facets/countries`

Returns audience country codes observed in the Google Ads search index.

**Tags:** Google Ads

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `search` | query | No | `string` |  |
| `limit` | query | No | `object` |  |
| `offset` | query | No | `object` |  |

## Responses

### 200 - Google audience countries with live ad counts.

**Content-Type:** `application/json`

```json
{
  "requestId": "string",
  "data": [
    {
      "value": "shopping",
      "label": "Shopping",
      "adsCount": 0
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
| `value` | `string` | Yes |  |
| `label` | `string` | Yes |  |
| `adsCount` | `number` | Yes |  |

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

# List Google Ads category facets

`GET /v1/google-ads/facets/categories`

Returns the Google category ids accepted by categoryIds on POST /v1/google-ads/query.

**Tags:** Google Ads

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `search` | query | No | `string` |  |
| `limit` | query | No | `object` |  |
| `offset` | query | No | `object` |  |

## Responses

### 200 - Paginated Google categories with advertiser usage counts.

**Content-Type:** `application/json`

```json
{
  "requestId": "string",
  "data": [
    {
      "id": 24,
      "name": "Women's Clothing",
      "path": "string",
      "parentId": 0,
      "advertiserUsageCount": 0
    }
  ],
  "pagination": {
    "limit": 0,
    "offset": 0,
    "total": 0
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
| `id` | `number` | Yes |  |
| `name` | `string` | Yes |  |
| `path` | `string` | Yes |  |
| `parentId` | `number` | Yes |  |
| `advertiserUsageCount` | `number` | Yes |  |

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
