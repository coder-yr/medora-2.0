# Medora 2.0 Migration Status

## Overview
- **Project**: Medora 2.0 (Migration of ICTHospital legacy hospital management system)
- **Current Phase**: **Phase 5: Backend Domain Migration, First Module (`PatientModule`)**
- **Status**: **FIRST MODULE COMPLETED**
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
| **Phase 5** | Clinical & Financial Domain Modules | **First Module Completed**: `PatientModule` (registration, walk-in support, sequential MRN generation, derived age, CNIC formatting, single-box search, granular RBAC). Remaining domain modules pending | **IN PROGRESS** |
| **Phase 6** | React Clinical Client Development | Modern accessible UI, clinical workflows, Vite packaging | Pending |
| **Phase 7** | Data Migration & Dual-Run Validation | ETL scripts, cents-level financial reconciliation, cutover | Pending |

---

## 2. Phase 5 First Module: `PatientModule` Summary

| Property | Value | Evidence / Command |
| :--- | :--- | :--- |
| **Selected Domain** | **`PatientModule`** (Foundational Master Entity) | Pure identity/demographics; zero coupling to pending billing/appointment engines |
| **Target Database Mapping** | `patient` table aligned in Prisma (26 mapped columns) | `npm run prisma:validate` (Exit code 0), `npm run prisma:generate` |
| **Legacy Source Parity** | `legacy/app/Http/Controllers/PatientController.php`, `legacy/app/Models/Patient.php`, `legacy/tests/Feature/PatientTest.php` | Parity verified against all legacy rules & test cases |
| **Endpoints Implemented** | `POST`, `GET`, `GET :id`, `PATCH :id`, `DELETE :id` at `/api/v1/patients` | Versioned REST endpoints with Swagger OpenAPI decorators |
| **Business Rules Preserved** | 1. Walk-in registration (only `name` required)<br>2. Sequential 6-digit MRN (`000001`, `000002`...) derived from max numeric ID to prevent reuse on delete<br>3. Age dynamically derived from `birthdate` (no guessing)<br>4. Pakistani CNIC validation & formatting (`XXXXX-XXXXXXX-X`)<br>5. BigInt JSON serialization safety | `PatientService` unit test suite (8 tests) |
| **Authorization & Security** | Granular RBAC (`patient_view`, `patient_add`, `patient_update`, `patient_delete`) | Receptionist can create/update (403 on delete); Doctor can view/search; Admin can delete |
| **Unit Test Coverage** | **9 suites passed, 32 tests passed** (8 new tests in `patient.service.spec.ts`) | `npm test` (Exit code 0) |
| **E2E Integration Tests**| **2 suites passed, 13 tests passed** (8 new tests in `patient.e2e-spec.ts`) | `npm run test:e2e` (Exit code 0) |
| **Total Test Baseline** | **45 passing automated tests** | Verified across all backend layers |
| **Linting & Code Quality**| **ESLint 9 + Prettier + Strict TypeScript** | `npm run lint` (Exit code 0), `npx tsc --noEmit` (Exit code 0) |
| **Build Validation** | **NestJS Production Build** | `npm run build` (Exit code 0) |
| **Legacy Source Integrity**| **100% Preserved** | `legacy/` 0 modifications; unstaged `app/Models/SMS.php` artifact preserved |

---

## 3. Key Findings & Domain Parity Details

1. **Walk-in Registrations Without Onerous Requirements**:
   - In Pakistani hospital OPD workflows, emergency and walk-in patients frequently arrive without CNIC cards or exact birth dates. Legacy parity ensures only `name` is required on creation.
2. **Safe Atomic Sequential MR Number Generation**:
   - Sequential MRNs are calculated by parsing the numeric value of the highest existing patient ID, ensuring that deleting a patient does not cause collision or ID reuse.
3. **No Age Guesswork**:
   - Age is strictly computed from `birthdate`. If `birthdate` is omitted, `age` is kept as `""` rather than fabricated.
4. **Clean Serialization of Prisma BigInts**:
   - Standard JavaScript `JSON.stringify` throws `TypeError: Do not know how to serialize a BigInt`. All response DTOs map BigInt primary and foreign keys (`id`, `ionUserId`) to strings.
5. **No Production Database or Hardcoded Credentials**:
   - Tests run entirely in-memory and against isolated test configurations without touching production Supabase resources.

---

## 4. Next Module Readiness

`PatientModule` provides the root patient reference required for subsequent domain modules. The next recommended module in Phase 5 is:
- **`DoctorModule` / `StaffModule` (Reference Data)** or **`AppointmentModule` (OPD Scheduling)**, pending approval of scheduling business rules.
