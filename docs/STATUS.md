# Medora 2.0 Migration Status

## Overview
- **Project**: Medora 2.0 (Migration of ICTHospital legacy hospital management system)
- **Current Phase**: **Phase 1: Read-only Legacy Audit**
- **Status**: **COMPLETED**
- **Date**: 2026-10-28
- **Approved Target Stack**:
  - **Frontend**: React + TypeScript + Vite
  - **Backend**: NestJS + TypeScript (trusted business logic boundary)
  - **Database Platform**: Supabase PostgreSQL (supersedes MariaDB/MySQL)
  - **ORM / Query Engine**: Prisma ORM (pooled `DATABASE_URL` + direct `DIRECT_URL`)
  - **Background Processing**: Redis + BullMQ (when required)
  - **Infrastructure**: Docker Compose initially (Kubernetes only if justified)

---

## 1. Executive Summary & Audit Completion

Phase 1 completes an exhaustive, read-only audit of the entire ICTHospital legacy codebase preserved in `legacy/`. The audit produced reproducible inventories across all routes, controllers, Blade views, business rules, concurrency locks, permission gates, and security posture.

No business features were scaffolded, no application code was ported, and `legacy/` remained strictly untouched.

| Audit Document | File Path | Scope & Verified Findings |
| :--- | :--- | :--- |
| **Current-State Architecture** | [`docs/00-current-state.md`](00-current-state.md) | Verified stack baseline (Laravel 12.61, PHP ^8.2), reproducible inventories, integrations, and operational dependencies. |
| **Endpoint Inventory** | [`docs/01-endpoint-inventory.md`](01-endpoint-inventory.md) | **251 total routes** (250 Web + 1 API) audited with controller actions, middleware, validations, and provisional NestJS module mappings. |
| **Screen Inventory** | [`docs/02-screen-inventory.md`](02-screen-inventory.md) | **134 Blade views** audited and categorized into 96 functional screens, 16 standalone/auth screens, 5 printables, 12 partials, 3 layouts, and 2 error pages. |
| **Business Rules** | [`docs/03-business-rules.md`](03-business-rules.md) | In-depth audit of 12 core domains: Billing, Doctor Share, Scheduling, Lab Orders, Pricing, Permissions, Cash Closing, Pharmacy Stock, Bed Allocation, Patient ID generation, and Reminders. |
| **Permissions Matrix** | [`docs/04-permissions-matrix.md`](04-permissions-matrix.md) | Complete matrix of **96 permissions** across **7 role groups** (`admin`, `doctor`, `nurse`, `accountant`, `receptionist`, `pharmacist`, `laboratorist`) and middleware mechanics. |
| **Security Findings** | [`docs/05-security-findings.md`](05-security-findings.md) | **9 security findings** (1 Critical, 3 High, 4 Medium, 1 Low), including hardcoded SuperAdmin backdoor, unauthenticated cron endpoints, and plaintext secrets. |
| **Risks & Open Questions**| [`docs/06-open-questions.md`](06-open-questions.md) | PostgreSQL compatibility, legacy MySQL assumptions, connection pooling, and **10 documented open questions**. |

---

## 2. Source Archive & Workspace Verification

| Property | Value |
| :--- | :--- |
| **Archive File Name** | `ICTHospital-main.zip` |
| **Resolved Path** | `C:\Users\Acer\Downloads\ICTHospital-main.zip` |
| **File Size** | `18,714,856 bytes` (17.85 MB) |
| **SHA-256 Checksum** | `67C8DA292DF5A64F68F3B413E874F8AE7778A5210D3320C7DD47A9A2545BBC69` |
| **Workspace Base Commit** | `a646a86` (`phase-0: establish migration workspace`) |
| **Legacy Directory Status** | 2,359 files in `legacy/` — **100% verified, unmodified, and preserved** |
| **Working Tree Artifact** | `app/Models/SMS.php` — preserved unstaged and untouched (Windows NTFS casing artifact) |
| **Automated Test Execution** | `php vendor/bin/phpunit` — **255 tests, 857 assertions, 0 failures, Exit Code 0** |

---

## 3. Key Findings from the Phase 1 Legacy Audit

### A. Architecture & Stack Baseline
- **Framework**: Laravel 12.61 running on PHP ^8.2 (tested CLI: PHP 8.4.27).
- **Frontend Architecture**: Blade templates rendered server-side, styled with Bootstrap 4.1, FontAwesome 4 & 5, jQuery 3.2.1, DataTables, Select2, and Chart.js. Packaged via Vite 5 (`vite.config.js`).
- **Authentication & Sessions**: State-based session authentication with bcrypt password hashing; API guard configured for Laravel Passport (`auth:api`). Role stored in `users.group`.
- **Concurrency & Pessimistic Locks**:
  The legacy system identified 5 write operations vulnerable to race conditions, protected by `DB::transaction()` and pessimistic locking (`lockForUpdate()`):
  1. **Appointment booking** (`AppointmentController` double-booking overlap guard)
  2. **Bed admission** (`AdmissionController` bed and patient mutual exclusivity)
  3. **Patient ID allocation** (`PatientController` sequential `MAX(CAST(patient_id AS UNSIGNED)) + 1`)
  4. **Pharmacy stock deduction** (`PharmacyController` atomic stock decrement during sale)
  5. **Invoice payments** (`InvoiceController` balance check and overpayment refusal)

### B. Business Logic & Financial Integrity
- **Doctor Share Calculations**: Calculated net of discounts on every line item, excluding taxes; rule priority scoring based on service, department, and patient type. Approval strictly gated on full invoice payment.
- **Cash Closing**: 5 payment buckets (`cash`, `bank_transfer`, `card`, `cheque`, `other`), with physical drawer counts compared against collected totals and shift discrepancy tracking.

### C. Security Posture Summary
- Discovered **1 Critical backdoor** (`SuperAdmin.php` checking `login == 'ictkashif'`).
- Discovered **3 High-severity risks**: unauthenticated public cron execution (`/cronjob/payment-reminder`), plaintext payment gateway secret storage, and historical public medical history attachments.
- Discovered **4 Medium-severity issues**: plaintext SMS gateway passwords, insecure cURL calls without TLS verification, predictable default admin seed password (`admin / 123456`), and discrepancy between UI sidebar navigation and server-side route checks.

---

## 4. Next Phase Readiness: Phase 2

Phase 1 audit requirements are completely satisfied. The project is prepared for:
**Phase 2: Domain Modeling & Supabase PostgreSQL Schema Design**
- Map the audited domain models, 50+ database tables, and foreign keys into a clean Prisma schema (`database/prisma/schema.prisma`).
- Implement PostgreSQL constraints, data types, and transactional semantics.
- Design initial NestJS core domain entities.
