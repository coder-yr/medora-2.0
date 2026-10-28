# Medora 2.0 Migration Status

## Overview
- **Project**: Medora 2.0 (Migration of ICTHospital legacy hospital management system)
- **Current Phase**: **Phase 7: DoctorModule Migration**
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
| **Phase 6** | Dependency Audit & Domain Migration (2nd Module) | `DepartmentModule` (specialty catalogue, alphabetical ordering, doctor usage counting, cascade rename across doctors, deletion protection, unlisted specialty adoption, RBAC), commit `46f7ac2` | **COMPLETED** |
| **Phase 7** | Clinical Staff Register (3rd Module) | `DoctorModule` (doctor register, only name required, email uniqueness without blank clash, appointment deletion protection, upcoming load tracking, department suggestion merge, optional staff login linking, RBAC) | **COMPLETED** |
| **Phase 8** | Data Migration & Dual-Run Validation | ETL scripts, cents-level financial reconciliation, cutover | Pending |

---

## 2. Phase 7 Domain Migration Summary: `DoctorModule`

| Property | Value | Evidence / Command |
| :--- | :--- | :--- |
| **Selected Domain** | **`DoctorModule`** (Clinical Staff Register) | Core practitioner entity required by appointments, prescriptions, consultations, and invoices |
| **Target Database Mapping** | `doctor` table aligned in Prisma (14 mapped legacy columns) | `npm run prisma:validate` (Exit code 0), `npm run prisma:generate` |
| **Legacy Source Parity** | `legacy/app/Http/Controllers/DoctorController.php`, `legacy/app/Models/Doctor.php`, `legacy/app/Support/StaffLogin.php`, `legacy/tests/Feature/DoctorTest.php` | Parity verified against all legacy rules & test cases |
| **Endpoints Implemented** | `GET /api/v1/doctors`<br>`GET /api/v1/doctors/departments`<br>`GET /api/v1/doctors/:id`<br>`POST /api/v1/doctors`<br>`PATCH /api/v1/doctors/:id`<br>`DELETE /api/v1/doctors/:id` | Versioned REST endpoints with OpenAPI annotations and RBAC guards |
| **Business Rules Preserved** | 1. Only name required on creation (locums/visiting doctors start with name only)<br>2. Email unique across doctors when provided; blank emails do NOT clash with each other<br>3. Editing keeps doctor's existing email while allowing department updates<br>4. Appointment deletion protection: doctor with appointments cannot be deleted (`{name} has appointments on file, so the record stays.`)<br>5. Upcoming load calculation (`date >= today`, status not cancelled/no show)<br>6. Merged department suggestion list (Department catalogue + in-use doctor text)<br>7. Optional staff portal sign-in provisioning (`loginUsername` / `loginPassword`) | `DoctorService` unit & E2E test suites (12 unit tests, 10 E2E tests) |
| **Authorization & Security** | Granular RBAC (`doctor_view`, `doctor_add`, `doctor_update`, `doctor_delete`) | Receptionist/Doctor restricted (403 on add/update/delete); Admin permitted |
| **Unit Test Coverage** | **11 suites passed, 59 tests passed** (12 new tests in `doctor.service.spec.ts`) | `npm test` (Exit code 0) |
| **E2E Integration Tests**| **4 suites passed, 33 tests passed** (10 new tests in `doctor.e2e-spec.ts`) | `npm run test:e2e` (Exit code 0) |
| **Total Test Baseline** | **92 passing automated tests** | Verified across all backend layers |
| **Test Environment Scope** | In-memory & test mock drivers | Local PostgreSQL service and Docker daemon are not active on this host; live PostgreSQL integration tests could not be run |
| **Linting & Code Quality**| **ESLint 9 + Prettier + Strict TypeScript** | `npm run lint` (Exit code 0), `npx tsc --noEmit` (Exit code 0) |
| **Build Validation** | **NestJS Production Build** | `npm run build` (Exit code 0) |
| **Legacy Source Integrity**| **100% Preserved** | `legacy/` 0 modifications; unstaged `app/Models/SMS.php` artifact preserved |

---

## 3. Foundation Verification Summary

1. **Patient Identifier Durability & Monotonicity**:
   - `PatientService.nextPatientId()` integrates PostgreSQL sequence creation (`patient_mrn_seq`) aligned with max patient ID.
   - Sequence generation guarantees restart durability and non-reuse of deleted MR numbers (including when the highest-numbered record is deleted).
   - `@unique` on `patientId` provides engine-level enforcement against concurrent duplication.
2. **Department Catalogue**:
   - Case-insensitive name uniqueness verified in `create` and `update` queries.
   - Renaming cascades to assigned doctor records (`Doctor.department`) in a single atomic interactive transaction.
   - `Doctor.department` is preserved as a string (varchar) for backward compatibility with legacy reports and exports.
3. **Staff Identity Boundary**:
   - Staff identity provider decisions remain unresolved per ADR 19.
   - Doctor profiles operate independently of user accounts: doctors can be registered with zero login credentials.
   - Optional portal credentials provision local user entries linked via `ionUserId`, without imposing external identity provider dependencies.

---

## 4. Next Module Readiness

With `PatientModule`, `DepartmentModule`, and `DoctorModule` completed, all upstream prerequisites for clinical scheduling are in place. The next module is:
- **`AppointmentModule` (OPD Scheduling & Calendar)**: Connects patients, doctors, and departments.
