# Emails

---

# Query emails

`POST /v1/emails/query`

Returns the advanced public emails discovery surface. This endpoint is the canonical public route for richer email filters while keeping the response aligned with the stable public EmailSummary contract. The API does not expose opens, clicks, conversions, or revenue metrics; sorting is discovery-oriented metadata ordering, not best-performance scoring.

**Tags:** Emails

## Request Body

**Content-Type:** `application/json`

**Find recent promotional emails from high-traffic shops:**

```json
{
  "search": [
    "welcome",
    "discount"
  ],
  "searchType": "email",
  "keywordMode": "any",
  "sortBy": "newest",
  "order": "desc",
  "minMonthlyVisits": 20000,
  "promotionTypes": [
    "Discount"
  ],
  "shopifyPlan": "plus",
  "page": 1,
  "limit": 25
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `search` | `string`[] | No |  |
| `searchType` | `domain` \| `email` \| `shopKeywords` | No | Search mode for this request. Allowed values: `domain`, `email`, `shopKeywords`. |
| `keywordMode` | `any` \| `all` | No | How multiple search keywords are combined. Allowed values: `any`, `all`. |
| `sortBy` | `newest` \| `oldest` \| `relevance` \| `monthlyVisits` \| `bodyLength` \| `shopEmailFrequency` \| `event` \| `promotionType` | No | Sort key for this request. Allowed values: `newest`, `oldest`, `relevance`, `monthlyVisits`, `bodyLength`, `shopEmailFrequency`, `event`, `promotionType`. These are discovery/indexing sorts, not opens/clicks/conversions performance rankings. |
| `order` | `asc` \| `desc` | No | Sort direction for this request. Allowed values: `asc`, `desc`. |
| `page` | `number` | No |  |
| `limit` | `number` | No |  |
| `sentAfter` | `string` | No |  |
| `sentBefore` | `string` | No |  |
| `campaignTypes` | `string`[] | No |  |
| `languages` | `string`[] | No |  |
| `promotionTypes` | `string`[] | No | Stored promotion type names, matched case-insensitively (`Discount %`, `Discount % With Threshold`, `Free Delivery`, `BOGO`, `Bundle Deal`, `No Promotion`, …). |
| `promotionTypeIds` | `number`[] | No |  |
| `categories` | `string`[] | No | Stored email category names, matched case-insensitively (`Promotional Campaign`, `Product Campaign`, `Launch Campaign`, `Relational Campaign`, `Event Campaign`, `Win-back Campaign`, `Survey`). |
| `emailCategoryIds` | `number`[] | No |  |
| `eventNames` | `string`[] | No |  |
| `eventIds` | `number`[] | No |  |
| `eventCategories` | `string`[] | No |  |
| `minBodyLength` | `number` | No |  |
| `maxBodyLength` | `number` | No |  |
| `shopIds` | `string`[] | No | Stable public shop identifiers. |
| `minMonthlyVisits` | `number` | No |  |
| `maxMonthlyVisits` | `number` | No |  |
| `trafficGrowth` | `string` | No | Traffic growth filter DSL using public rolling windows. Valid periods: `last30d`, `last90d`, `last180d`. |
| `minProductsCount` | `number` | No |  |
| `maxProductsCount` | `number` | No |  |
| `creationCountries` | `string`[] | No |  |
| `excludeCreationCountries` | `string`[] | No |  |
| `currencies` | `string`[] | No |  |
| `shopDefaultLanguages` | `string`[] | No |  |
| `mainMarketCountries` | `string`[] | No |  |
| `amongMarketCountries` | `string`[] | No |  |
| `excludeMarketCountries` | `string`[] | No |  |
| `visitorCountries` | `string`[] | No | Alias of amongMarketCountries: matches shops with any of these countries among their markets. No separate visitor-country data is indexed. |
| `shopCreatedAfter` | `string` | No |  |
| `shopCreatedBefore` | `string` | No |  |
| `technologies` | `string`[] | No | Main e-commerce platform slugs or ids (shopify, woocommerce, wordpress, magento, wix, …). Only the shop's main platform is indexed for emails; other technologies are rejected with unsupported_filter. |
| `shopifyPlan` | `all` \| `plus` \| `nonPlus` | No | Enum value accepted by this request. Allowed values: `all`, `plus`, `nonPlus`. |
| `categoryIds` | `number`[] | No |  |
| `minShopEmails90d` | `number` | No |  |
| `maxShopEmails90d` | `number` | No |  |
| `minAvgEmailsPerWeek` | `number` | No |  |
| `maxAvgEmailsPerWeek` | `number` | No |  |
| `minActiveAds` | `number` | No |  |
| `maxActiveAds` | `number` | No |  |
| `adsGrowth` | `string` | No | Ads growth filter DSL using public rolling windows. Valid periods: `last7d`, `last30d`, `last90d`. |
| `minTrustpilotRating` | `number` | No |  |
| `maxTrustpilotRating` | `number` | No |  |
| `minTrustpilotReviewCount` | `number` | No |  |
| `maxTrustpilotReviewCount` | `number` | No |  |

## Responses

### 200 - Paginated advanced emails query response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": [
    {
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
| `id` | `number` | Yes |  |
| `sentAt` | `string` | Yes |  |
| `campaignType` | `string` | Yes |  |
| `classification` | `object` | Yes |  |
| `content` | `object` | Yes |  |
| `shop` | `object` | Yes |  |

**`classification` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `promotionType` | `string` | Yes |  |
| `promotionTypeId` | `number` | Yes |  |
| `category` | `string` | Yes |  |
| `categoryId` | `number` | Yes |  |
| `event` | `object` | Yes |  |

**`event` properties:**


**`content` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `subject` | `string` | Yes |  |
| `preheader` | `string` | Yes |  |
| `bodyPreview` | `string` | Yes |  |
| `bodyLength` | `number` | Yes |  |
| `screenshotUrl` | `string` | Yes |  |

**`shop` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes |  |
| `domain` | `string` | Yes |  |
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

# Get raw email HTML by id

`GET /v1/emails/{emailId}/html`

Returns the raw captured HTML for one public email identifier. Existing emails may have html=null when raw HTML is unavailable.

**Tags:** Emails

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `emailId` | path | Yes | `string` | Stable public email identifier. |

## Responses

### 200 - Raw email HTML response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": {
    "emailId": 123456,
    "html": "<!doctype html><html><body>...</body></html>",
    "htmlLength": 12345
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
| `emailId` | `number` | Yes | Stable public email identifier. |
| `html` | `object` | Yes | Raw captured HTML for the email, when available. |
| `htmlLength` | `number` | Yes | Length of the raw HTML string in characters. Zero when HTML is unavailable. |

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

### 404 - No email matches the requested id.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
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

# Get an email by id

`GET /v1/emails/{emailId}`

Returns one public email detail object by stable email identifier, including the clean public shop context nested under the email.

**Tags:** Emails

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `emailId` | path | Yes | `string` | Stable public email identifier. |

## Responses

### 200 - Public email detail response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": {
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
      "screenshotUrl": "https://cdn.example.com/emails/123.png",
      "body": "Shop the full collection with exclusive offers for this weekend only."
    },
    "shop": {
      "id": "3f8aa146-6f96-46e8-9781-64db5166f9a8",
      "domain": "example.com",
      "name": "Example Shop",
      "createdAt": "2024-01-15T00:00:00.000Z",
      "profile": {
        "countryCode": "US",
        "currency": "USD",
        "defaultLanguage": "en",
        "mainMarket": "US",
        "isShopifyPlus": true,
        "visitorCountries": [
          "US",
          "CA",
          "GB",
          "FR",
          "DE"
        ]
      },
      "traffic": {
        "monthlyVisits": 45231,
        "growth30d": 0.18,
        "growth90d": 0.27,
        "growth180d": 0.41
      },
      "catalog": {
        "productsCount": 124,
        "categoryIds": [
          166,
          204
        ]
      },
      "marketing": {
        "emailsLast90d": 37,
        "avgEmailsPerWeek": 2.8,
        "activeAds": 14,
        "avgActiveAds7d": 9.2,
        "avgActiveAds30d": 11.6,
        "activeAdsGrowth7d": 0.12,
        "activeAdsGrowth30d": 0.34,
        "activeAdsGrowth90d": 0.58
      },
      "technology": {
        "mainTechnologyId": "04504d0b-df46-4f62-98b6-d4d9e14a2282",
        "mainTechnologySlug": "shopify",
        "mainTechnologyName": "Shopify"
      },
      "trustpilot": {
        "rating": 4.6,
        "reviewCount": 1834
      },
      "analytics": {
        "campaignTypes": {
          "Marketing": 75,
          "Newsletter": 25
        },
        "categoryTypes": {
          "Promotional Campaign": 28,
          "Product Campaign": 2
        },
        "emailsByDayOfWeek": {
          "0": 3,
          "1": 2,
          "3": 5,
          "6": 8
        }
      }
    },
    "language": "english"
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
| `id` | `number` | Yes |  |
| `sentAt` | `string` | Yes |  |
| `campaignType` | `string` | Yes |  |
| `classification` | `object` | Yes |  |
| `content` | `object` | Yes |  |
| `shop` | `object` | Yes |  |
| `language` | `string` | Yes |  |

**`classification` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `promotionType` | `string` | Yes |  |
| `promotionTypeId` | `number` | Yes |  |
| `category` | `string` | Yes |  |
| `categoryId` | `number` | Yes |  |
| `event` | `object` | Yes |  |

**`event` properties:**


**`content` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `subject` | `string` | Yes |  |
| `preheader` | `string` | Yes |  |
| `bodyPreview` | `string` | Yes |  |
| `bodyLength` | `number` | Yes |  |
| `screenshotUrl` | `string` | Yes |  |
| `body` | `string` | Yes |  |

**`shop` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes |  |
| `domain` | `string` | Yes |  |
| `name` | `string` | Yes |  |
| `createdAt` | `string` | Yes |  |
| `profile` | `object` | Yes |  |
| `traffic` | `object` | Yes |  |
| `catalog` | `object` | Yes |  |
| `marketing` | `object` | Yes |  |
| `technology` | `object` | Yes |  |
| `trustpilot` | `object` | Yes |  |
| `analytics` | `object` | Yes |  |

**`profile` properties:**


**`traffic` properties:**


**`catalog` properties:**


**`marketing` properties:**


**`technology` properties:**


**`trustpilot` properties:**


**`analytics` properties:**


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

### 404 - No email matches the requested id.

**Content-Type:** `application/json`

```json
{
  "error": {
    "code": "missing_api_key",
    "message": "Provide an API key using Authorization: Bearer <api_key>.",
    "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
    "details": {
      "validationErrors": [
        {
          "field": "query-string.limit",
          "location": "query-string",
          "expected": [
            "limit must not be greater than 100"
          ]
        }
      ]
    }
  }
}
```

**Properties:**

| Property | Type | Required | Description |
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

# List emails for a shop

`GET /v1/shops/{shopId}/emails`

Returns the paginated public emails linked to one shop identifier, with stable recency-oriented filters and the same public EmailSummary response contract as the global emails surface.

**Tags:** Emails

## Parameters

**Query parameter groups:**

- Pagination: `page`, `limit`
- Search: `search`
- Sorting: `sortBy`
- Filters: `sentAfter`, `sentBefore`, `campaignTypes`, `languages`

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `shopId` | path | Yes | `string` | Stable public shop identifier. |
| `search` | query | No | `string`[] | Optional email search keywords. Repeated query params and comma-separated values are both accepted. |
| `sortBy` | query | No | `newest` \| `oldest` \| `relevance` \| `event` \| `promotionType` | Sort key for this request. Allowed values: `newest`, `oldest`, `relevance`, `event`, `promotionType`. These are discovery/indexing sorts, not opens/clicks/conversions performance rankings. |
| `sentAfter` | query | No | `string` |  |
| `sentBefore` | query | No | `string` |  |
| `campaignTypes` | query | No | `string`[] |  |
| `languages` | query | No | `string`[] |  |
| `page` | query | No | `integer` |  |
| `limit` | query | No | `integer` |  |

## Responses

### 200 - Paginated shop emails response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": [
    {
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
| `id` | `number` | Yes |  |
| `sentAt` | `string` | Yes |  |
| `campaignType` | `string` | Yes |  |
| `classification` | `object` | Yes |  |
| `content` | `object` | Yes |  |
| `shop` | `object` | Yes |  |

**`classification` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `promotionType` | `string` | Yes |  |
| `promotionTypeId` | `number` | Yes |  |
| `category` | `string` | Yes |  |
| `categoryId` | `number` | Yes |  |
| `event` | `object` | Yes |  |

**`event` properties:**


**`content` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `subject` | `string` | Yes |  |
| `preheader` | `string` | Yes |  |
| `bodyPreview` | `string` | Yes |  |
| `bodyLength` | `number` | Yes |  |
| `screenshotUrl` | `string` | Yes |  |

**`shop` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes |  |
| `domain` | `string` | Yes |  |
| `name` | `string` | Yes |  |

**`pagination` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `page` | `number` | Yes |  |
| `limit` | `number` | Yes |  |
| `total` | `number` | Yes |  |
| `totalPages` | `number` | Yes |  |

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

# Get shop email stats

`GET /v1/shops/{shopId}/emails/stats`

Returns shop-scoped 90-day email frequency stats and sparse UTC calendar counts for one requested month.

**Tags:** Emails

## Parameters

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `shopId` | path | Yes | `string` | Stable public shop identifier. |
| `month` | query | Yes | `string` | Calendar month to aggregate, formatted as YYYY-MM. |

## Responses

### 200 - Shop email stats response. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "requestId": "5d93d8de-0f6d-46a4-bd10-2e519b7e96bc",
  "data": {
    "last90Days": {
      "totalEmails": 37,
      "avgEmailsPerWeek": 2.8,
      "emailsByDayOfWeek": {
        "1": 4,
        "3": 7
      }
    },
    "calendar": {
      "month": "2026-04",
      "totalEmails": 12,
      "emailsByDate": {
        "2026-04-03": 2,
        "2026-04-18": 1
      }
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
| `last90Days` | `object` | Yes |  |
| `calendar` | `object` | Yes |  |

**`last90Days` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `totalEmails` | `number` | Yes | Total emails sent by this shop in the trailing 90 days. |
| `avgEmailsPerWeek` | `number` | Yes | Average emails sent per week over the trailing 90 days. |
| `emailsByDayOfWeek` | `object` | Yes | Emails sent by day of week using 0=Sunday ... 6=Saturday. |

**`calendar` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `month` | `string` | Yes | Calendar month represented by this aggregate. |
| `totalEmails` | `number` | Yes | Total emails sent in the requested calendar month. |
| `emailsByDate` | `object` | Yes | Sparse UTC calendar counts keyed by YYYY-MM-DD. Dates with zero emails are omitted. |

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
