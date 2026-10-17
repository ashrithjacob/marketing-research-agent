# Usage

---

# Read the current workspace usage snapshot

`GET /v1/usage`

Returns the current public API billing, included quota, and credit balance snapshot for the authenticated workspace.

**Tags:** Usage

## Responses

### 200 - Current usage snapshot for the authenticated workspace. The response also includes the X-Request-Id, X-Usage-Cost, X-Credits-Used, and X-Credits-Remaining headers.

**Content-Type:** `application/json`

```json
{
  "requestId": "d96c0824-7083-4cb6-a968-ecc694117367",
  "workspace": {
    "id": "ws_123",
    "slug": "my-workspace",
    "name": "My Workspace"
  },
  "credential": {
    "id": "cred_123",
    "accessLevel": "full_access",
    "lastUsedAt": "2026-04-20T07:28:18.700Z"
  },
  "billing": {
    "configured": false,
    "planCode": null,
    "currentPeriodStart": null,
    "currentPeriodEnd": null,
    "updatedAt": null
  },
  "includedQuota": {
    "limit": 0,
    "used": 0,
    "remaining": 0
  },
  "credits": {
    "balance": 0,
    "recurring": {
      "limit": 0,
      "used": 0,
      "remaining": 0
    },
    "topup": {
      "balance": 0
    },
    "totalRemaining": 0
  }
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `requestId` | `string` | Yes | Request identifier mirrored in the X-Request-Id response header. |
| `workspace` | `object` | Yes |  |
| `credential` | `object` | Yes |  |
| `billing` | `object` | Yes |  |
| `includedQuota` | `object` | Yes | Deprecated compatibility block. Use credits.recurring and credits.totalRemaining instead. |
| `credits` | `object` | Yes |  |

**`workspace` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes |  |
| `slug` | `string` | Yes |  |
| `name` | `string` | Yes |  |

**`credential` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes |  |
| `accessLevel` | `full_access` \| `delegated_user` | Yes |  |
| `lastUsedAt` | `string` | Yes |  |

**`billing` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `configured` | `boolean` | Yes | Whether the workspace currently has billing configuration for the public API. |
| `planCode` | `string` | Yes | Current billing plan code when configured. |
| `currentPeriodStart` | `string` | Yes |  |
| `currentPeriodEnd` | `string` | Yes |  |
| `updatedAt` | `string` | Yes |  |

**`includedQuota` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `limit` | `number` | Yes |  |
| `used` | `number` | Yes |  |
| `remaining` | `number` | Yes |  |

**`credits` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `balance` | `number` | Yes | Deprecated compatibility alias of credits.topup.balance. |
| `recurring` | `object` | Yes |  |
| `topup` | `object` | Yes |  |
| `totalRemaining` | `number` | Yes | Total remaining recurring + top-up credits. |

**`recurring` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `limit` | `number` | Yes |  |
| `used` | `number` | Yes |  |
| `remaining` | `number` | Yes |  |

**`topup` properties:**


| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `balance` | `number` | Yes |  |

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
