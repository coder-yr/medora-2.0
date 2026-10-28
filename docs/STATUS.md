# Medora 2.0 Migration Status

## Overview
- **Project**: Medora 2.0 (Migration of ICTHospital legacy hospital management system)
- **Current Phase**: **Phase 6: Dependency Audit & Domain Migration (`DepartmentModule`)**
- **Status**: **COMPLETED**
- **Date**: 2026-10-28
- **Approved Target Stack**:
  - **Frontend**: React + TypeScript + Vite
  - **Backend**: NestJS + TypeScript (trusted business logic boundary)
  - **Database Platform**: Supabase PostgreSQL (supersedes MariaDB/MySQL)
  - **ORM / Query Engine**: Prisma ORM 7.10.1 (`@prisma/adapter-pg` driver adapter)
  - **Background Processing**: Redis + BullMQ (when justified in future phases)
  - **Infrastructure**: Docker Compose initially (Kubernetes only if justified)

---

## 1. Migration Phase Matrix

| Phase | Description | Deliverables | Status |
| :--- | :--- | :--- | :--- |
| **Phase 0** | Workspace & Source Preservation | Source archive verified, `legacy/` isolated, commit `a646a86` | **COMPLETED** |
| **Phase 1** | Read-Only Legacy Audit | Inventories, business rules, permissions, security findings (`docs/00` to `06`), commit `86b9bc1` | **COMPLETED** |
| **Phase 2** | Legacy Runtime Baseline | Tool verification, test reproducibility (255 tests), route manifest (271 routes), safe GET smoke tests ([`docs/07-legacy-runtime-baseline.md`](07-legacy-runtime-baseline.md)), commit `e177f10` | **COMPLETED** |
| **Phase 3** | Database Discovery & Prisma Mapping | Schema inventory (`104` tables, `924` cols), PostgreSQL compatibility, Prisma schema (`backend/prisma/schema.prisma`), validation, reconciliation plan, inspection scripts, commit `25e1724` | **COMPLETED** |
| **Phase 4** | NestJS Backend Foundation | NestJS 11 bootstrap, strict TS, Prisma 7 `@prisma/adapter-pg`, safe config validation, versioned routing (`/api/v1`), correlation IDs, OpenAPI docs, truthful readiness probe, RBAC guards (97 permissions, SEC-01 fix), unit & e2e test suites (29 tests), commit `c6c3557` | **COMPLETED** |
| **Phase 5** | Clinical & Financial Domain Modules (1st Module) | `PatientModule` (registration, walk-in support, sequential MRN generation, derived age, CNIC formatting, single-box search, granular RBAC), commit `51c6e80` | **COMPLETED** |
| **Phase 6** | Dependency Audit & Domain Migration (2nd Module) | **Patient Safety Review & Regression**: Verified MRN uniqueness, monotonic non-reuse on deletion of highest-numbered patient, empty table generation, unexpected format handling, BigInt serialization, identity provider independence.<br>**Domain Migration**: `DepartmentModule` (specialty catalogue, alphabetical ordering, doctor usage counting, cascade rename across doctors, deletion protection, unlisted specialty adoption, RBAC) | **COMPLETED** |
| **Phase 7** | Data Migration & Dual-Run Validation | ETL scripts, cents-level financial reconciliation, cutover | Pending |

---

## 2. Phase 6 Domain Migration Summary: `DepartmentModule`

| Property | Value | Evidence / Command |
| :--- | :--- | :--- |
| **Selected Domain** | **`DepartmentModule`** (Foundational Master Reference Entity) | Pure master data; zero foreign dependencies; unblocks `DoctorModule` and `AppointmentModule` |
| **Target Database Mapping** | `department` table aligned in Prisma (id, name, description, x, y, timestamps) | `npm run prisma:validate` (Exit code 0), `npm run prisma:generate` |
| **Legacy Source Parity** | `legacy/app/Http/Controllers/DepartmentController.php`, `legacy/app/Models/Department.php` | Parity verified against all legacy rules & workflows |
| **Endpoints Implemented** | `GET /api/v1/departments`<br>`GET /api/v1/departments/:id`<br>`POST /api/v1/departments`<br>`PATCH /api/v1/departments/:id`<br>`DELETE /api/v1/departments/:id`<br>`POST /api/v1/departments/adopt` | Versioned REST endpoints with OpenAPI annotations and RBAC guards |
| **Business Rules Preserved** | 1. Name required & unique (case-insensitive clash detection)<br>2. Alphabetical ordering with doctor usage counts<br>3. Unlisted specialty discovery across doctor records<br>4. Atomic cascade rename to assigned doctors (`Doctor.department`)<br>5. Deletion protection: rejected if active doctors are assigned<br>6. Batch-adoption of unlisted specialties used by doctors | `DepartmentService` unit & E2E test suites (11 unit tests, 10 E2E tests) |
| **Authorization & Security** | Granular RBAC (`department_view`, `department_add`, `department_update`, `department_delete`) | Receptionist/Doctor restricted (403 on add/update/delete); Admin permitted |
| **Unit Test Coverage** | **10 suites passed, 47 tests passed** (11 new tests in `department.service.spec.ts`, 4 new tests in `patient.service.spec.ts`) | `npm test` (Exit code 0) |
| **E2E Integration Tests**| **3 suites passed, 23 tests passed** (10 new tests in `department.e2e-spec.ts`) | `npm run test:e2e` (Exit code 0) |
| **Total Test Baseline** | **70 passing automated tests** | Verified across all backend layers |
| **Test Environment Scope** | In-memory & test mock drivers | Local PostgreSQL service and Docker daemon are not active on this host; live PostgreSQL integration tests could not be run |
| **Linting & Code Quality**| **ESLint 9 + Prettier + Strict TypeScript** | `npm run lint` (Exit code 0), `npx tsc --noEmit` (Exit code 0) |
| **Build Validation** | **NestJS Production Build** | `npm run build` (Exit code 0) |
| **Legacy Source Integrity**| **100% Preserved** | `legacy/` 0 modifications; unstaged `app/Models/SMS.php` artifact preserved |

---

## 3. PatientModule Safety-Critical Review Results

1. **Database-Enforced Uniqueness**:
   - `patientId` is configured with `@unique` in `backend/prisma/schema.prisma` (`patient_patient_id_key`), enforcing strict PostgreSQL database-level uniqueness.
2. **Monotonic Non-Reuse on Deletion (Including Highest-Numbered Patient)**:
   - Fixed and verified via regression test `Rule 9`: deleting the highest-numbered patient does not decrease the sequence tracker. The next patient receives `highestIssued + 1`, eliminating MR number recycling.
3. **Empty Table & Malformed Format Handling**:
   - Empty table correctly initiates at `000001` (verified via `Rule 10`).
   - Query parser utilizes regex extraction (`regexp_replace(patient_id, '\D', '', 'g')`), safely ignoring unexpected prefixes (e.g., `TEMP-`, `P-`) without producing `NaN` or unpadded values.
4. **All 26 Legacy Columns Mapped**:
   - Verified 1:1 mapping against SQLite `patient` table schema inventory.
5. **BigInt Serialization**:
   - Verified that all response paths (`create`, `findAll`, `findOne`, `update`) serialize BigInt primary and foreign keys (`id`, `patientTypeId`, `branchId`) to strings (verified via `Rule 11`).
6. **Independence from External Identity Providers**:
   - Verified that `ionUserId` defaults safely to empty string/null on front-desk walk-in registration, requiring zero coupling to unresolved staff identity-provider decisions (verified via `Rule 12`).

---

## 4. Next Module Readiness

With `PatientModule` and `DepartmentModule` completed, the clinical reference foundation is in place. The next recommended candidate is:
- **`DoctorModule` (Clinical Staff Register)**: Depends on `Department` (now available) and unblocks appointments and consultations.
