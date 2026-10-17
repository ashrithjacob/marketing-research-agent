# System

---

# Get public API metadata

`GET /v1`

Returns a minimal bootstrap payload describing the current Trendtrack Public API version and status.

**Tags:** System

## Responses

### 200 - Public API metadata. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "name": "Trendtrack Public API",
  "version": "v1",
  "status": "ok"
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | Yes | Public API product name. |
| `version` | `string` | Yes | Current public API version. |
| `status` | `string` | Yes | Bootstrap health indicator. |

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


---

# Check public API health

`GET /v1/health`

Returns a lightweight health payload for the public bootstrap mounted under /v1.

**Tags:** System

## Responses

### 200 - Public bootstrap health snapshot. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "status": "ok",
  "timestamp": "2026-04-20T07:28:18.700Z",
  "uptime": 123
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `status` | `string` | Yes | Health status for the public bootstrap. |
| `timestamp` | `string` | Yes | ISO timestamp captured when the health check was served. |
| `uptime` | `number` | Yes | Process uptime in seconds. |

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


---

# Read public API data freshness

`GET /v1/system/freshness`

Returns the latest ready and latest indexed/scheduled global snapshot dates for public API reach-history data.

**Tags:** System

## Responses

### 200 - Global public API data freshness payload. The response also includes the X-Request-Id header.

**Content-Type:** `application/json`

```json
{
  "status": "ok",
  "data": {
    "latestReadyDate": "2026-04-23",
    "latestScheduledDate": "2026-04-24",
    "dataFreshnessLagDays": 1,
    "generatedAt": "2026-04-24T14:42:14.123Z"
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `status` | `string` | Yes | System freshness endpoint status. |
| `data` | `object` | Yes |  |

**`data` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `latestReadyDate` | `string` | Yes | Latest global snapshot date with usable reach rows, or null when none exists. |
| `latestScheduledDate` | `string` | Yes | Latest global indexed/scheduled snapshot date observed in reach history, even if not ready yet. |
| `dataFreshnessLagDays` | `number` | Yes | Difference in whole UTC days between today and latestReadyDate. Null when no ready snapshot exists. |
| `generatedAt` | `string` | Yes | ISO timestamp captured when this freshness payload was generated. |

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
