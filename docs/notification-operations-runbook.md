# Notification Operations Runbook
## Medora 2.0 — Phase 22 Operations Manual

### 1. Worker Lifecycle & Execution Modes

The Medora 2.0 notification engine operates in two operational modes:

#### Mode A: Embedded Worker / Polling Processor (Default)
In standard single-node or containerized deployments where an external Redis broker is not yet configured:
- The `NotificationOutboxProcessor` runs as an integrated background task inside NestJS.
- Polls `notification_outbox` periodically (default: every 5 seconds) for pending and retryable jobs.
- Safe concurrency: Uses PostgreSQL `FOR UPDATE SKIP LOCKED` or transactional state transition to ensure that multiple cluster nodes do not process the same outbox job.

#### Mode B: Dedicated Queue / CLI Worker
For high-volume background batch dispatching:
```bash
# Run single processing pass
node dist/src/jobs/notification-worker.js --once

# Run continuous worker daemon
node dist/src/jobs/notification-worker.js --watch
```

---

### 2. Error Classification & Retry Policy

When dispatching notifications via channel adapters, errors are categorized into two distinct classes:

| Error Category | Examples | Handler Action | Next State | Max Retries |
| :--- | :--- | :--- | :--- | :--- |
| **TRANSIENT** | Provider 503 / 504, Connection Timeout, Socket Hangup, Rate Limit Exceeded (429) | Calculate exponential backoff delay ($\Delta t = 2^{\text{attempt}} \times 30\text{s}$), update `next_retry_at` | `RETRYABLE` | 5 attempts |
| **PERMANENT** | Invalid Phone Number, Unroutable Email, Recipient Inactive, 401 Unauthorized Credentials | Stop immediately, record error message and error category | `DEAD_LETTER` | 0 (No automated retries) |

#### Exponential Backoff Schedule:
- Attempt 1: $+30\text{ seconds}$
- Attempt 2: $+60\text{ seconds}$
- Attempt 3: $+120\text{ seconds}$ (2 minutes)
- Attempt 4: $+240\text{ seconds}$ (4 minutes)
- Attempt 5: $+480\text{ seconds}$ (8 minutes)
- Exceeded: Transition to `DEAD_LETTER`

---

### 3. Monitoring & Queue Health Diagnostics

Administrators can monitor the health of the notification system via the REST API or Settings Workspace:

#### Health Metrics Endpoint:
`GET /api/v1/admin/notifications/queue-health`

Sample JSON response:
```json
{
  "status": "HEALTHY",
  "pendingCount": 3,
  "processingCount": 1,
  "retryableCount": 2,
  "deadLetterCount": 0,
  "deliveredLast24h": 412,
  "avgLatencyMs": 84,
  "activeProviders": {
    "IN_APP": "OPERATIONAL",
    "EMAIL": "DEV_MOCK",
    "SMS": "DEV_MOCK"
  }
}
```

---

### 4. Incident Response & Manual Dead-Letter Recovery

If an external provider experiences an extended outage (e.g. gateway down for 2 hours) and jobs transition to `DEAD_LETTER`:

1. **Verify Provider Restoration**: Ensure the SMS gateway or SMTP server has returned to operational status.
2. **Execute Manual Batch Retry**:
   An administrator with `NOTIFICATION_RETRY` permission issues a retry request:
   `POST /api/v1/admin/notifications/:id/retry`
   - Resets job `status = 'PENDING'`, `attempts = 0`, and `nextRetryAt = NOW()`.
3. **Audit Verification**:
   Check `configuration_audit_logs` or `notification_deliveries` to confirm that the job re-executed and succeeded.
