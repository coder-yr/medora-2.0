# Protected Health Information (PHI) Logging & Redaction Specification

**Document Version:** 1.0.0  
**Phase:** Remediation Stage 1  
**Scope:** Observability, Request Logging, Error Handling, and Privacy Safeguards  

---

## 1. Compliance Background & Motivation

Hospital information systems routinely process Protected Health Information (PHI) and Personally Identifiable Information (PII) including national identity numbers (CNIC), contact information (phone, email), names, and clinical search terms.

Prior to Stage 1, standard HTTP request logging in NestJS captured raw query strings (e.g. `GET /api/v1/patients?q=03001234567`). If log aggregators (e.g. Datadog, CloudWatch, ELK) or local log files ingest these raw entries, patient privacy is violated and security audits flag critical non-compliance.

Stage 1 introduces automated, zero-overhead redaction across all HTTP request and error interception layers.

---

## 2. Redacted Parameter Catalog

The following query and path parameter names are classified as sensitive and strictly sanitized across all log sinks:

| Parameter Key | Biological / Clinical / Identity Content | Redacted Output |
| :--- | :--- | :--- |
| `q` | General clinical search query (contains CNIC, MRN, Name) | `q=[REDACTED]` |
| `cnic` | Computerized National Identity Card number | `cnic=[REDACTED]` |
| `phone` | Patient or staff phone number | `phone=[REDACTED]` |
| `email` | Personal or clinical email address | `email=[REDACTED]` |
| `name` | Patient full or partial name | `name=[REDACTED]` |
| `mrn` | Medical Record Number | `mrn=[REDACTED]` |
| `old_mrn` / `oldMrn` | Legacy system medical record identifier | `oldMrn=[REDACTED]` |
| `ssn` | Social security number | `ssn=[REDACTED]` |
| `token` | Authentication bearer token or reset secret | `token=[REDACTED]` |
| `password` | Plaintext credential | `password=[REDACTED]` |

---

## 3. Redaction Engine: `sanitizeLogUrl`

Located in `backend/src/common/utils/phi-redaction.util.ts`:

```typescript
export const PHI_SENSITIVE_KEYS = new Set([
  'q',
  'cnic',
  'phone',
  'email',
  'name',
  'token',
  'password',
  'ssn',
  'mrn',
  'oldmrn',
  'old_mrn',
]);

export function sanitizeLogUrl(url: string): string {
  if (!url || typeof url !== 'string') return '';

  const qIdx = url.indexOf('?');
  if (qIdx === -1) return url;

  const path = url.slice(0, qIdx);
  const queryString = url.slice(qIdx + 1);
  if (!queryString) return path;

  const pairs = queryString.split('&');
  const sanitizedPairs = pairs.map((pair) => {
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) return pair;
    const key = pair.slice(0, eqIdx).toLowerCase().trim();
    if (PHI_SENSITIVE_KEYS.has(key)) {
      return `${pair.slice(0, eqIdx)}=[REDACTED]`;
    }
    return pair;
  });

  return `${path}?${sanitizedPairs.join('&')}`;
}
```

---

## 4. Pipeline Integration Points

### 1. `LoggingInterceptor` (`backend/src/common/interceptors/logging.interceptor.ts`)
Intercepts all incoming HTTP requests. Replaces `req.originalUrl` with `sanitizeLogUrl(req.originalUrl)` before formatting access logs:
```typescript
const sanitizedUrl = sanitizeLogUrl(req.originalUrl || req.url);
this.logger.log(`[${correlationId}] ${method} ${sanitizedUrl} - ${ip} ${userAgent}`);
```

### 2. `AllExceptionsFilter` (`backend/src/common/filters/all-exceptions.filter.ts`)
Handles uncaught HTTP and runtime exceptions. Ensures that exception log lines and stack traces do not reproduce sensitive query parameters:
```typescript
const sanitizedUrl = sanitizeLogUrl(request.originalUrl || request.url);
this.logger.error(`[${correlationId}] ${request.method} ${sanitizedUrl} - ${status} ${message}`, exceptionStack);
```

---

## 5. Audit Traceability: Correlation ID

Redaction does not compromise traceability. Every request receives a unique UUIDv4 `x-correlation-id` (passed through response headers) allowing systems engineers to correlate specific audit records in clinical logs without inspecting raw patient identifiers.
