# Medora 2.0 Migration Status

## Overview
- **Project**: Medora 2.0 (Migration of ICTHospital legacy hospital management system)
- **Current Phase**: **Phase 8: AppointmentModule Migration**
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
| **Phase 7** | Clinical Staff Register (3rd Module) | `DoctorModule` (doctor register, only name required, email uniqueness without blank clash, appointment deletion protection, upcoming load tracking, department suggestion merge, optional staff login linking, RBAC), commit `2b94b19` | **COMPLETED** |
| **Phase 8** | Outpatient Scheduling & Visits (4th Module) | `AppointmentModule` (double-booking overlap protection, transaction locks, doctor clinic hours & slot blocks, free slots calculator, day view, vitals recording, Jitsi video visits, RBAC) | **COMPLETED** |
| **Phase 9** | Clinical Consultations & Prescriptions | Consultation notes, diagnosis templates, prescriptions | Pending |

---

## 2. Phase 8 Domain Migration Summary: `AppointmentModule`

| Property | Value | Evidence / Command |
| :--- | :--- | :--- |
| **Selected Domain** | **`AppointmentModule`** (Outpatient Scheduling & Visits) | Essential clinical scheduling workflow connecting patients, doctors, and front-desk reception |
| **Target Database Mapping** | `appointment` table aligned in Prisma with all 27 legacy columns, foreign keys, and indexes | `npm run prisma:validate` (Exit code 0), `npm run prisma:generate` |
| **Legacy Source Parity** | `legacy/app/Http/Controllers/AppointmentController.php`, `legacy/app/Support/DoctorSchedule.php`, `legacy/app/Support/Telemedicine.php`, `legacy/tests/Feature/AppointmentTest.php` | Parity verified against all legacy rules & test cases |
| **Endpoints Implemented** | `GET /api/v1/appointments`<br>`GET /api/v1/appointments/free-slots`<br>`GET /api/v1/appointments/:id`<br>`POST /api/v1/appointments`<br>`PATCH /api/v1/appointments/:id`<br>`DELETE /api/v1/appointments/:id` | Versioned REST endpoints with OpenAPI annotations and RBAC guards |
| **Business Rules Preserved** | 1. Double-booking overlap protection (`existing.s_time < new.e_time AND existing.e_time > new.s_time`) under transactional row locking<br>2. Touching boundaries do NOT clash (09:00-09:15 and 09:15-09:30 allowed)<br>3. Cancelled/no-show slots freed immediately for rebooking<br>4. Doctor clinic hours validation across active weekly slots (`doctor_slot`)<br>5. Doctor slot blocks (`slot_block`) enforced against bookings (leaves, meetings)<br>6. Front-desk day view defaults to today's date ordered by `s_time`<br>7. Video visits generate unique cryptographically secure Jitsi rooms (`icthospital-<24hex>`) persisted across edits<br>8. Patient and doctor deletion protection: cannot delete records with appointments on file | `AppointmentService` unit & E2E test suites (12 unit tests, 10 E2E tests) |
| **Authorization & Security** | Granular RBAC (`appointment_view`, `appointment_add`, `appointment_update`, `appointment_cancel`) | Doctor restricted from add/cancel; Receptionist/Admin permitted |
| **Unit Test Coverage** | **12 suites passed, 71 tests passed** (12 new tests in `appointment.service.spec.ts`) | `npm test` (Exit code 0) |
| **E2E Integration Tests**| **5 suites passed, 43 tests passed** (10 new tests in `appointment.e2e-spec.ts`) | `npm run test:e2e` (Exit code 0) |
| **Total Test Baseline** | **114 passing automated tests** | Verified across all backend layers |
| **Test Environment Scope** | In-memory & test mock drivers | Local PostgreSQL service and Docker daemon are not active on this host; live PostgreSQL integration tests could not be run |
| **Linting & Code Quality**| **ESLint 9 + Prettier + Strict TypeScript** | `npm run lint` (Exit code 0), `npx tsc --noEmit` (Exit code 0) |
| **Build Validation** | **NestJS Production Build** | `npm run build` (Exit code 0) |
| **Legacy Source Integrity**| **100% Preserved** | `legacy/` 0 modifications; unstaged `app/Models/SMS.php` artifact preserved |

---

## 3. Foundation Verification Summary

1. **Scheduling Concurrency & Row Locking**:
   - Double-booking prevention executes inside an interactive transaction (`this.prisma.$transaction()`) taking a pessimistic lock on the doctor record (`SELECT id FROM doctor WHERE id = ... FOR UPDATE`).
   - Overlap check strictly evaluates `existing.sTime < new.eTime AND existing.eTime > new.sTime`, ignoring cancelled and no-show appointments.
2. **Referential Safeguards & Anti-Orphaning**:
   - `PatientService.remove()` and `DoctorService.delete()` inspect `appointment` table prior to record deletion, rejecting removal if appointments exist on file (`"{name} has appointments on file, so the record stays."`).
   - PostgreSQL foreign key constraints (`patientId -> Patient.id`, `doctorId -> Doctor.id`) enforce engine-level referential integrity.
3. **Telemedicine Parity**:
   - Video visits generate cryptographically secure Jitsi meeting rooms (`icthospital-` + 24 hex characters via `crypto.randomBytes(12)`).
   - Generated meeting rooms are retained on appointment updates and reschedules, ensuring issued meeting links remain valid.

---

## 4. Next Module Readiness

With `PatientModule`, `DepartmentModule`, `DoctorModule`, and `AppointmentModule` completed, outpatient admissions and clinical consultations are unblocked. The next recommended candidate is:
- **`ConsultationModule` (Clinical Records, OPD Templates & Prescriptions)**: Downstream consumer of scheduled outpatient appointments.
