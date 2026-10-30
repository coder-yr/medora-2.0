# Medora 2.0 — Phase 10.5: Backend Stabilization & Security Remediation Report

**Date**: 2026-10-30  
**Repository**: `F:\yash\projects\full system\ICTHospital`  
**Baseline**: Commit `ee05734` (`phase-10: migrate invoice`)  
**Target Architecture**: NestJS 11 + TypeScript, Prisma 7 (`@prisma/adapter-pg`), Supabase PostgreSQL

---

## Executive Summary

Phase 10.5 was dedicated exclusively to correcting critical architecture and security defects in the Medora 2.0 backend before migrating any additional hospital modules. Prior to this phase, authentication contained a development backdoor, passwords were not verified against database hashes, sessions lacked refresh token rotation and reuse detection, production services used in-memory `Map` fallbacks when database connectivity lagged, and PostgreSQL concurrency guarantees were untested.

All defects have been completely remediated, verified with live Supabase PostgreSQL integration testing, and proven with 100% automated test passes across 103 unit tests and full PostgreSQL concurrency suites.

---

## 1. Defect Inventory & Remediation Matrix

| Defect ID | Severity | Root Cause | Remediation Applied | Verification |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-AUTH-01** | **Critical** | Development backdoor in `AuthService.login`: arbitrary `@medora.hospital` emails could log in with any password >= 8 characters. | Backdoor completely removed. All authentication attempts strictly query the PostgreSQL `users` table and verify password hashes. Non-existent users or empty passwords immediately throw 401. | `auth.service.spec.ts`, `app.e2e-spec.ts` |
| **SEC-AUTH-02** | **Critical** | Passwords were not verified against stored database hashes. Legacy hashes were ignored. | Implemented dual-engine verification: Argon2id (primary modern standard) with legacy bcrypt `$2y$` compatibility. Upon successful authentication of a legacy `$2y$` hash, the hash is transparently re-hashed to Argon2id in PostgreSQL. | `auth.service.spec.ts`, live DB seed upgrade verified |
| **SEC-AUTH-03** | **Medium** | Email enumeration vulnerability: differing error responses for invalid email vs wrong password. | Replaced error handling with uniform 401 Unauthorized response: `"Invalid email or password"`. Zero information leaked regarding user existence. Failed password verification never mutates stored hash. | `auth.service.spec.ts` |
| **SEC-AUTH-04** | **High** | Session management lacked refresh tokens; long-lived tokens could not be revoked without global secret rotation. | Implemented secure session management: short-lived access tokens (15m, 900s), cryptographically random refresh tokens (stored as SHA-256 hashes in `user_session` table), automatic token rotation, and family-based reuse detection. Presenting an already-revoked refresh token revokes the entire session family immediately. | `schema.prisma` (`UserSession`), `auth.service.spec.ts` |
| **SEC-API-01** | **High** | Missing standard security HTTP headers (CSP, HSTS, X-Content-Type-Options, etc.). | Integrated Helmet middleware (`helmet()`) globally in `main.ts`. | `backend/src/main.ts` |
| **SEC-API-02** | **High** | Authentication endpoint was vulnerable to brute-force credential stuffing. | Registered `@nestjs/throttler` (`ThrottlerModule`, `ThrottlerGuard`) with strict rate limiting on `/api/v1/auth/login` (limit 5 requests per 60 seconds). | `app.module.ts`, `auth.controller.ts` |
| **SEC-API-03** | **Medium** | CORS origin fallback could allow insecure wildcards in production. | Enforced strict environment validation: `*` wildcard explicitly disallowed when `NODE_ENV=production`. | `backend/src/main.ts` |
| **ARCH-DATA-01** | **Critical** | Production services (`PatientService`, `DepartmentService`, `DoctorService`, `AppointmentService`, `ConsultationService`, `InvoiceService`) had in-memory `Map` fallbacks and test-pollution methods (`clearMemory`, `seedMemoryDoctor`). | Completely removed all in-memory `Map` stores and mock fallback logic from production code. All services now operate purely and transactionally against Supabase PostgreSQL. Unit tests decouple test mocks from production services. | All 6 services refactored; `npm run lint` & `tsc --noEmit` pass |
| **ARCH-CONC-01** | **High** | High-concurrency operations (invoice payments, appointment double-booking) relied on application-level checks without verified PostgreSQL row locks. | Implemented explicit pessimistic row locking within interactive transactions: `SELECT id, gross_total FROM payment WHERE id = $id FOR UPDATE` and `SELECT id FROM doctor WHERE id = $id FOR UPDATE`. Configured interactive transaction timeout options (`maxWait: 15s`, `timeout: 30s`) to accommodate cloud database latency. | `test/postgres-concurrency.e2e-spec.ts` (6.1 & 6.2 passed) |
| **ARCH-SEQ-01** | **High** | Patient MRN generation lacked guaranteed durability across transaction rollbacks and record deletions. | Implemented PostgreSQL sequence `patient_mrn_seq`. Verified that deleting the highest-numbered patient does not recycle or reuse the deleted MRN; sequence values monotonically increase. | `test/postgres-concurrency.e2e-spec.ts` (6.3 passed) |
| **ARCH-TYPE-01** | **Medium** | Codebase contained 8 unsafe `as any` type casts, bypassing TypeScript type safety on appointments and consultations. | Eliminated all 8 `as any` casts. Restructured Prisma types, appointment status enums, and JSON input definitions. | Zero `as any` casts in production code; `npx tsc --noEmit` clean |

---

## 2. Real PostgreSQL Concurrency & Integrity Test Results

Automated integration test suite: `backend/test/postgres-concurrency.e2e-spec.ts` executed against live Supabase PostgreSQL:

```text
PASS test/postgres-concurrency.e2e-spec.ts (47.947 s)
  PostgreSQL Concurrency & Data Integrity Integration Tests
    6.1 Invoice Concurrency & Pessimistic Row Locking
      √ prevents double-spending and overpayment race conditions with SELECT FOR UPDATE (27390 ms)
    6.2 Appointment Concurrency & Doctor Row Lock
      √ prevents overlapping double-booking race conditions using doctor row lock (4823 ms)
    6.3 Patient MRN Sequence Durability & Monotonicity
      √ ensures patient_mrn_seq persists across transactions and never reuses deleted IDs (3583 ms)
    6.4 Consultation 1:1 Constraint & Completed Immutability
      √ enforces 1:1 constraint between consultation and appointment, and guarantees record immutability once completed (8696 ms)
```

### Key Concurrency Mechanics Verified:
1. **Invoice Double-Payment Race Prevention**:
   Two concurrent payment attempts of 600.00 each against a 1000.00 invoice fired simultaneously (`Promise.allSettled`). Pessimistic row locking (`SELECT FOR UPDATE`) serialized the operations: exactly one succeeded, and the second was immediately rejected with `400 Bad Request: Only 400.00 is outstanding on this invoice.` Invoice final balance verified at exactly 400.00, paid at 600.00.
2. **Doctor Overlapping Appointment Lock**:
   Two simultaneous booking requests for the same doctor and overlapping timeslot fired simultaneously. The doctor record row lock prevented race conditions; exactly one appointment was confirmed, and the other was rejected with `400 Bad Request: That doctor is already booked...`
3. **Sequence Durability**:
   `patient_mrn_seq` verified. Deleting patient `000002` followed by creating a third patient produced `000003`, confirming non-recycling durability.
4. **Consultation 1:1 & Immutability**:
   Once consultation status transitions to `completed`, any subsequent alteration request is rejected with `400 Bad Request: Cannot modify a completed consultation record.`

---

## 3. Test Coverage Across Business Services

All 6 business domain services significantly exceed the >= 80% line and statement coverage requirement:

| Service File | % Statements | % Branch | % Functions | % Lines | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `src/modules/department/department.service.ts` | **98.55%** | 70.58% | 100.00% | **98.48%** | **PASS (Target >= 80%)** |
| `src/modules/invoice/invoice.service.ts` | **91.77%** | 68.63% | 83.87% | **93.24%** | **PASS (Target >= 80%)** |
| `src/modules/patient/patient.service.ts` | **91.37%** | 78.77% | 100.00% | **90.09%** | **PASS (Target >= 80%)** |
| `src/modules/auth/auth.service.ts` | **90.00%** | 72.54% | 100.00% | **89.77%** | **PASS (Target >= 80%)** |
| `src/modules/appointment/appointment.service.ts` | **87.73%** | 73.49% | 91.30% | **87.97%** | **PASS (Target >= 80%)** |
| `src/modules/consultation/consultation.service.ts` | **83.63%** | 66.92% | 89.47% | **83.44%** | **PASS (Target >= 80%)** |
| `src/modules/doctor/doctor.service.ts` | **83.65%** | 60.95% | 100.00% | **85.86%** | **PASS (Target >= 80%)** |

**Total Unit Test Results**: 14 test suites passed, 103 unit tests passed (0 failed).

---

## 4. Verification Gates Summary

- **Lockfile & Clean Install**: `npm ci` succeeds cleanly (0 errors).
- **TypeScript Compilation**: `npx tsc --noEmit` succeeds cleanly (0 errors).
- **ESLint Quality**: `npm run lint` succeeds cleanly (0 errors, 0 warnings).
- **Production Build**: `npm run build` succeeds cleanly (`dist/` generated).
- **Database Schema**: Supabase PostgreSQL synchronized with Prisma schema (`UserSession` added, 39 tables active).
- **Legacy Preservation**: `legacy/` directory 100% clean and unmodified. Unstaged `app/Models/SMS.php` artifact preserved.
- **Git Hygiene**: Committed locally only. No remote push.
