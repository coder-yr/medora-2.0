# Medora 2.0 Migration Status

## Overview
- **Project**: Medora 2.0 (Migration of ICTHospital legacy hospital management system)
- **Current Phase**: **Phase 3: Database Discovery and Prisma Mapping**
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
| :--- | :--- | :--- | :--- |
| **Phase 0** | Workspace & Source Preservation | Source archive verified, `legacy/` isolated, commit `a646a86` | **COMPLETED** |
| **Phase 1** | Read-Only Legacy Audit | Inventories, business rules, permissions, security findings (`docs/00` to `06`), commit `86b9bc1` | **COMPLETED** |
| **Phase 2** | Legacy Runtime Baseline | Tool verification, test reproducibility (255 tests), route manifest (271 routes), safe GET smoke tests ([`docs/07-legacy-runtime-baseline.md`](07-legacy-runtime-baseline.md)), commit `e177f10` | **COMPLETED** |
| **Phase 3** | Database Discovery & Prisma Mapping | Schema inventory (`104` tables, `924` cols), PostgreSQL compatibility, Prisma schema (`backend/prisma/schema.prisma`), validation, reconciliation plan, inspection scripts | **COMPLETED** |
| **Phase 4** | NestJS Core Services & Clinical Modules | Trusted backend APIs, RBAC guards, financial ledgers, BullMQ queues | Pending |
| **Phase 5** | React Clinical Client Development | Modern accessible UI, clinical workflows, Vite packaging | Pending |
| **Phase 6** | Data Migration & Dual-Run Validation | ETL scripts, cents-level financial reconciliation, cutover | Pending |

---

## 2. Phase 3 Database Discovery & Prisma Mapping Summary

| Property | Value | Evidence / Artifact |
| :--- | :--- | :--- |
| **Legacy Database Engine** | SQLite 3.53.4 (`database/database.sqlite`) | 104 tables, 113 migrations executed |
| **Discovered Tables / Columns** | **104 tables, 924 columns** | [`database/schema-inventory.md`](../database/schema-inventory.md) generated via deterministic script |
| **Legacy Foreign Key Count** | **0 explicit database-level FKs** | Enforced purely at Laravel application level; formalized with relations in Prisma |
| **Retired School Models** | **7 models dropped from schema** | `Diary`, `FeeCol`, `FeeSetup`, `GPA`, `Marks`, `Question`, `Subject` dropped by migration `2026_09_09_140000_remove_school_tables.php`; excluded from Prisma |
| **PostgreSQL Compatibility** | **18 technical domains analyzed** | [`database/postgres-compatibility.md`](../database/postgres-compatibility.md) (AUTO_INCREMENT, DECIMAL, TIMESTAMPTZ, JSONB, concurrency) |
| **Prisma Schema File** | `backend/prisma/schema.prisma` | PostgreSQL datasource, `@map` / `@@map` preserved, `Decimal(12,2)`, `DateTime @db.Timestamptz`, `BigInt` PKs + `uuid String @unique` |
| **Prisma Config** | `backend/prisma.config.ts` | Prisma 7 datasource configuration adhering to Prisma 7 decoupled CLI spec |
| **Prisma Static Validation** | **VALID (Exit code 0)** | `npx prisma validate --schema=backend/prisma/schema.prisma` passed cleanly |
| **Source-to-Target Mapping** | Field-by-field clinical & billing mapping | [`database/source-to-target-mapping.md`](../database/source-to-target-mapping.md) with risk tiers & validation queries |
| **Reconciliation Plan** | Financial & clinical integrity gates | [`database/reconciliation-plan.md`](../database/reconciliation-plan.md) with zero-tolerance balance verification & rollback plan |
| **Inspection & Profiling Tools**| Read-only PHP inspection tools | [`database/scripts/inspect-schema.php`](../database/scripts/inspect-schema.php), [`database/scripts/profile-data-quality.php`](../database/scripts/profile-data-quality.php) |
| **Legacy Source Integrity** | **100% Preserved** | `legacy/` 0 modifications; unstaged `app/Models/SMS.php` artifact preserved |

---

## 3. Key Findings & Architectural Recommendations

1. **Hybrid Primary Key Strategy**:
   - Hospital operations depend heavily on sequential integers (MR numbers `ICT-P-{id}`, paper invoice printouts `INV-{id}`).
   - Schema implements `id BigInt @id @default(autoincrement())` with secondary `uuid String @unique @default(uuid())` for public external API routes, preventing sequential record enumeration attacks while preserving clinical identifiers.
2. **Financial Data Type Hardening**:
   - Legacy stored money totals (`gross_total`, `amount_received`) as `VARCHAR(255)` with implicit MariaDB casting.
   - Prisma schema enforces `Decimal(12, 2)` across all billing, payroll, and pharmacy records, preventing floating-point rounding errors.
3. **Pessimistic Concurrency & Exclusion Constraints**:
   - Legacy application executed vulnerable non-atomic read-then-write logic for bed allocation and medicine inventory.
   - Prisma schema & NestJS transaction design mandate `SELECT ... FOR UPDATE` inside `$transaction` for stock decrements and partial unique index constraints (`bed_id` WHERE status = 'OCCUPIED') for physical room allocations.
4. **Soft-Delete Normalization**:
   - Standardized `deletedAt DateTime? @map("deleted_at") @db.Timestamptz` across core clinical entities, enforced via Prisma client extensions.

---

## 4. Next Phase Readiness: Phase 4

Phase 3 is complete. The schema and database architectures are mapped and statically validated. The repository is prepared for:
**Phase 4: NestJS Core Services & Domain Modules**
- Scaffold NestJS backend architecture with modular domain structure (`AuthModule`, `PatientModule`, `AppointmentModule`, `BillingModule`, `PharmacyModule`).
- Integrate Prisma Client module and client extensions for soft-deletes and tenant isolation.
- Implement trusted business logic, financial ledgers, and concurrency-safe transactions.

