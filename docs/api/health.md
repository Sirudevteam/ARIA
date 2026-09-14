# Health Check Endpoint

## `GET /api/v1/health`

Returns the application status and database connectivity.

---

### Request

```http
GET /api/v1/health HTTP/1.1
Host: localhost:8000
```

No authentication required.

---

### Response — 200 OK

```json
{
  "status": "ok",
  "app_name": "ARIA",
  "version": "0.1.0",
  "environment": "development",
  "database": "connected"
}
```

| Field | Type | Description |
|---|---|---|
| `status` | string | Always `"ok"` when the API is reachable |
| `app_name` | string | Application name (`ARIA`) from configuration |
| `version` | string | Semantic version |
| `environment` | string | `development` · `staging` · `production` |
| `database` | string | `"connected"` or `"unreachable"` |

---

### Notes

- `database: "unreachable"` does **not** cause a non-200 status. The API is still reachable; only the DB is down.
- Used by Docker Compose and load balancers for readiness probes.
