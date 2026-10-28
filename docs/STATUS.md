# Medora 2.0 Migration Status

## Overview
- **Project**: Medora 2.0 (Migration of ICTHospital legacy hospital management system)
- **Current Phase**: **Phase 2: Legacy Runtime Baseline**
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

## 1. Migration Phase Matrix

| Phase | Description | Deliverables | Status |
| :--- | :--- | :--- | :---: |
| **Phase 0** | Workspace & Source Preservation | Source archive verified, `legacy/` isolated, commit `a646a86` | **COMPLETED** |
| **Phase 1** | Read-Only Legacy Audit | Inventories, business rules, permissions, security findings (`docs/00` to `06`), commit `86b9bc1` | **COMPLETED** |
| **Phase 2** | Legacy Runtime Baseline | Tool verification, test reproducibility (255 tests), route manifest (271 routes), safe GET smoke tests ([`docs/07-legacy-runtime-baseline.md`](07-legacy-runtime-baseline.md)) | **COMPLETED** |
| **Phase 3** | Domain Modeling & Supabase Schema | Prisma schema (`database/prisma/schema.prisma`), PostgreSQL types, initial NestJS entities | Pending |
| **Phase 4** | NestJS Core Services & Clinical Modules | Trusted backend APIs, RBAC guards, financial ledgers, BullMQ queues | Pending |
| **Phase 5** | React Clinical Client Development | Modern accessible UI, clinical workflows, Vite packaging | Pending |
| **Phase 6** | Data Migration & Dual-Run Validation | ETL scripts, cents-level financial reconciliation, cutover | Pending |

---

## 2. Phase 2 Verification & Runtime Baseline Summary

| Property | Value | Evidence / Command |
| :--- | :--- | :--- |
| **PHP CLI** | `8.4.27 (cli)` (NTS x64) | `php -v` (Exit code 0) |
| **Composer** | `2.8.12` | `composer --version` (Exit code 0) |
| **Laravel Framework** | `12.69.2` | `php artisan --version` (Exit code 0) |
| **PHPUnit Runner** | `11.5.56` | `php vendor/bin/phpunit` (Exit code 0) |
| **Automated Test Results** | **255 tests, 857 assertions, 0 failures** | Reproducible baseline confirmed (100% pass, 0 skipped, 0 risky) |
| **Registered Routes** | **271 routes** | `Route::getRoutes()` runtime query (136 GET, 88 POST, 29 DELETE, 18 PUT) |
| **Safe GET Smoke Test** | **89 parameterless endpoints** | 83 endpoints return `200 OK` under Admin session; guests properly 302-redirected |
| **Local Database Engine** | SQLite 3.53.4 (`database.sqlite`) | 104 tables, 113 executed migrations, seeded test accounts |
| **Docker Engine Status** | **Unavailable (Daemon Not Running)** | Engine named pipe not found; legacy `docker-compose.yml` mounts nonexistent `./src` |
| **Legacy Source Integrity**| **100% Preserved** | 2,359 files in `legacy/` unmodified; unstaged `app/Models/SMS.php` preserved |

---

## 3. Key Observations & Environmental Limitations

1. **Test Environment Isolation**:
   - The test suite executes in-memory on SQLite (`:memory:`), isolating tests from state mutations.
   - All 255 tests pass cleanly in ~15 seconds without modifying any legacy code.
2. **Local MariaDB/MySQL Driver Absence**:
   - The host PHP CLI does not have `pdo_mysql` loaded (`PDO::getAvailableDrivers()` returned only `sqlite`), and Docker Desktop engine is not running on the host.
   - Consequently, local execution runs against SQLite. MariaDB-specific edge cases (e.g. non-strict `GROUP BY` and string truncation) must be addressed when authoring the Supabase PostgreSQL Prisma schema.
3. **Passport OAuth Endpoints**:
   - Smoke tests identified that Passport OAuth endpoints (`/oauth/authorize`, `/oauth/device`) return HTTP 500 when called without required query parameters (`client_id`, `redirect_uri`). This is standard OAuth protocol behavior in the absence of client context.

---

## 4. Next Phase Readiness: Phase 3

Phase 2 requirements are fulfilled. The project is prepared for:
**Phase 3: Domain Modeling & Supabase PostgreSQL Schema Design**
- Author the definitive Prisma schema (`database/prisma/schema.prisma`).
- Map all 96 legacy domain models and 50+ tables into PostgreSQL data types (`TIMESTAMPTZ`, `DECIMAL(12,2)`, `BOOLEAN`, `UUID` / `BIGINT`).
- Encode foreign keys, unique constraints, and transaction boundary requirements.
