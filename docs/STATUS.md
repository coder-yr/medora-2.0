# Medora 2.0 Migration Status

## Overview
- **Project**: Medora 2.0 (Migration of ICTHospital legacy hospital management system)
- **Current Phase**: **Phase 12: Medicine & Pharmacy Catalogue Migration**
- **Status**: **COMPLETED**
- **Date**: 2026-10-31
- **Approved Target Stack**:
  - **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS / Modern CSS (scaffolded in `frontend/`)
  - **Backend**: NestJS 11 + TypeScript (trusted business logic boundary)
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
| **Phase 8** | Outpatient Scheduling & Visits (4th Module) | `AppointmentModule` (double-booking overlap protection, transaction locks, doctor clinic hours & slot blocks, free slots calculator, day view, vitals recording, Jitsi video visits, RBAC), commit `eb0ed18` | **COMPLETED** |
| **Phase 9** | Clinical Consultations & Encounters (5th Module) | `ConsultationModule` (outpatient consultation notes, Naegele obstetric math, history carry-forward, vitals sync, note templates, printable summaries, completed note immutability, RBAC), commit `1b09259` | **COMPLETED** |
| **Phase 10** | Invoicing & Billing Domain Migration (6th Module) | `InvoiceModule` (patient invoicing, multi-item breakdown, server calculations, installment payments, pessimistic row lock, overpayment rejection, deletion guards, doctor share calculations, RBAC), commit `ee05734` | **COMPLETED** |
| **Phase 10.5** | Backend Stabilization & Security Remediation | Backdoor removal, Argon2id + legacy bcrypt upgrade, session management (refresh token rotation, reuse detection), Helmet headers, login throttling, removal of all fake in-memory stores, real PostgreSQL row locking concurrency tests (`SELECT FOR UPDATE`), 100% clean CI lockfile, >= 80% coverage across all 6 services (`docs/security-hardening-report.md`), commit `e39efd1` | **COMPLETED** |
| **Phase 11** | Prescription Domain & Frontend Clinical Screen (7th Module) | `PrescriptionModule` (catalog search, relational items, legacy summary sync, atomic transactions, RBAC), React 19 + TypeScript + Vite clinical prescription hub (role switcher, live auto-complete, dosage shortcuts, summary preview, print modal), Prisma migration to Supabase PostgreSQL, 100% unit and E2E pass rate, commit `f07c760` | **COMPLETED** |
| **Phase 11.1** | Prescription SQLite Schema Verification & Hardening | Authentic PRAGMA audit of SQLite `prescription`, `prescription_medicine`, `medicine`, `patient`, `doctor`, column-by-column reconciliation ([`docs/prescription-schema-reconciliation.md`](prescription-schema-reconciliation.md)), `medicine_id` index alignment, PostgreSQL runtime audit, migration-history gap documentation, frontend persona switcher production security hardening (Vite tree-shaking verified), commit `b430ff9` | **COMPLETED** |
| **Phase 11.2** | Prisma Migration Baseline & Database Change Management | Baseline migration (`0_init/migration.sql`), `migration_lock.toml` (`postgresql`), verified zero drift against live Supabase PostgreSQL, official baseline resolution (`prisma migrate resolve --applied 0_init`), clean disposable PostgreSQL schema replication test, database migration runbook ([`docs/database-migration-runbook.md`](database-migration-runbook.md)), and documentation discrepancy reconciliation ([`docs/prescription-schema-reconciliation.md`](prescription-schema-reconciliation.md)), commit `64e7949` | **COMPLETED** |
| **Phase 12** | Medicine & Pharmacy Catalogue Migration (8th Module) | `MedicineModule` (modernized medicine master catalogue, category/manufacturer/dosage/unit/supplier CRUD, normalized foreign keys, pack format reconciliation, duplicate prevention, prescription deletion guards, soft deactivation, doctor view permissions), React 19 catalogue management dashboard (formulary table, category/manufacturer filters, stock indicators, detail & add/edit modals, supporting entity management), Supabase migration `20261031120000_phase_12_medicine_catalogue`, [`docs/medicine-catalogue-mapping.md`](medicine-catalogue-mapping.md) | **COMPLETED** |

---

## 2. Phase 11 Domain Migration Summary: `PrescriptionModule` & Frontend Screen

| Property | Value | Evidence / Command |
| :--- | :--- | :--- |
| **Selected Domain** | **`PrescriptionModule`** (Clinical Medication Orders & Regimens) & **Frontend Clinical Screen** | Core outpatient clinical prescribing workflow, migrating legacy string-packed prescriptions to typed relational models with React 19 clinical UI |
| **Target Database Mapping** | `prescription` & `prescription_medicine` models aligned in Prisma schema and pushed to live Supabase PostgreSQL | `npx prisma db push` (Exit code 0, 7.19s), `npm run prisma:generate` |
| **Legacy Source Parity** | `legacy/app/Http/Controllers/PrescriptionController.php`, `legacy/app/Models/Prescription.php`, `legacy/app/Models/PrescriptionMedicine.php`, `legacy/tests/Feature/PrescriptionTest.php` | Complete parity across prescription generation, catalog lookup, line item management, editing, deletion, and legacy summary text generation |
| **Backend Endpoints** | `GET /api/v1/prescriptions/medicines/search`<br>`GET /api/v1/prescriptions`<br>`GET /api/v1/prescriptions/:id`<br>`POST /api/v1/prescriptions`<br>`PUT /api/v1/prescriptions/:id`<br>`DELETE /api/v1/prescriptions/:id` | Versioned REST endpoints with OpenAPI Swagger documentation and RBAC guards |
| **Frontend Deliverables** | React 19 + TypeScript + Vite + Tailwind CSS / Modern CSS in `frontend/` | Role switcher (Doctor vs. Admin), real-time medicine catalogue search, dynamic prescription item builder with dosage shortcuts (`1+0+1`, `1+1+1`), live legacy summary preview, searchable Rx table, and clinical print modal |
| **Business Rules Preserved** | 1. Relational line items in `prescription_medicine` linked to catalog `Medicine` entity<br>2. Catalog name copying on create/update ensures historical prescriptions remain intact even if catalog names change<br>3. Support for custom unlisted drugs when `medicine_id` is null<br>4. Rejection of empty drug regimens (`400 Bad Request: Add at least one medicine, or this prescription says nothing.`)<br>5. Bidirectional legacy string synchronization: automatically derives and writes legacy summary string (`prescription.medicine`) for backwards compatibility<br>6. Atomic wholesale replacement of line items upon update within interactive PostgreSQL transactions (`tx.$transaction`)<br>7. Cascade deletion of child prescription lines upon parent removal<br>8. Search and filter by patient, doctor, and drug name (case-insensitive substring match) | `PrescriptionService` unit & E2E test suites (19 unit tests, 15 E2E tests) |
| **Authorization & Security** | Granular RBAC (`prescription_view`, `prescription_add`, `prescription_update`, `prescription_delete`) | Doctor authorized for prescribing; Receptionist/Accountant restricted (403); Admin full management; unauthenticated calls rejected (401) |
| **Unit Test Coverage** | **15 suites passed, 122 tests passed** (19 new tests in `prescription.service.spec.ts`, 100% line coverage) | `npm test` (Exit code 0) |
| **Service Line Coverage** | All 7 migrated domain services exceed 80% line coverage:<br>- `prescription.service.ts`: **100%**<br>- `department.service.ts`: **98.48%**<br>- `invoice.service.ts`: **93.24%**<br>- `patient.service.ts`: **90.09%**<br>- `auth.service.ts`: **89.77%**<br>- `appointment.service.ts`: **87.97%**<br>- `doctor.service.ts`: **85.86%**<br>- `consultation.service.ts`: **83.44%** | `npm test -- --coverage` |
| **E2E Integration Tests**| **9 suites passed, 89 tests passed** across all modules against live Supabase PostgreSQL (15 new tests in `prescription.e2e-spec.ts`) | `npm run test:e2e` (Exit code 0, 110s) |
| **Linting & Code Quality**| **ESLint 9 + Prettier + Strict TypeScript** | Backend: `npm run lint` (0 errors), `npx tsc --noEmit` (0 errors)<br>Frontend: `tsc -b && vite build` (0 errors) |
| **Production Builds** | Backend: `npm run build` (Exit code 0)<br>Frontend: `npm run build` (Exit code 0, 305ms) | Ready for containerization |
| **Legacy Source Integrity**| **100% Preserved** | `legacy/` 0 modifications; unstaged `app/Models/SMS.php` artifact strictly preserved |

---

## 3. Frontend Architecture & Clinical Experience

The Medora 2.0 frontend in `frontend/` is built on React 19, TypeScript, and Vite, with a modern clinical aesthetic designed for rapid physician entry:

1. **Role Switcher & Automatic Token Management**:
   - Allows instant switching between Doctor (`doctor.test@medora.hospital`) and Administrator (`admin.test@medora.hospital`) personas to evaluate role-based UI states without manual re-login.
2. **Real-time Catalogue Auto-complete**:
   - Queries `GET /api/v1/prescriptions/medicines/search?q=...` with debouncing, displaying medication generic names, brands, categories, and inventory stock hints.
3. **Smart Dosage Shortcuts**:
   - Provides one-click dosage chips (`1+0+1`, `1+1+1`, `1+0+0`, `0+0+1`, `SOS / PRN`) and duration pickers (`3 days`, `5 days`, `7 days`, `14 days`, `1 month`) to minimize keyboard fatigue.
4. **Live Legacy Summary Preview**:
   - Automatically computes and previews the legacy human-readable regimen string in real-time as the physician adds or edits medications.
5. **Printable Clinical Rx Sheet**:
   - A dedicated modal renders a formal hospital prescription header, patient MRN and demographics, attending physician credentials, tabular drug regimen, and signature block with CSS `@media print` rules for paper and PDF output.

---

## 4. Phase 11.2 Database Migration Baseline & Change Management Summary

| Property | Value | Evidence / Command |
| :--- | :--- | :--- |
| **Baseline Migration SQL** | `backend/prisma/migrations/0_init/migration.sql` (1,043 lines of clean, non-destructive DDL covering 39 models, sequences, primary keys, foreign keys, and indexes) | `npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script -o prisma/migrations/0_init/migration.sql` |
| **Provider Locking** | `backend/prisma/migrations/migration_lock.toml` (`provider = "postgresql"`) | Required by Prisma 7 migrate diff CLI |
| **Schema Drift Audit** | **0 differences detected** between current `schema.prisma` and live Supabase PostgreSQL database | `npx prisma migrate diff --from-schema prisma/schema.prisma --to-config-datasource` (Exit code 0) |
| **Supabase Baseline Resolution** | Marked `0_init` as applied on live database without re-executing or altering existing data | `npx prisma migrate resolve --applied 0_init` (Exit code 0) |
| **Migration Recognition Status** | `1 migration found in prisma/migrations. Database schema is up to date!` | `npx prisma migrate status` (Exit code 0) |
| **Clean Disposable Reproduction** | Created disposable PostgreSQL test schema `disposable_migration_test`, executed `0_init/migration.sql`, verified all 39 tables, constraints, foreign keys, and indexes, and cleanly dropped test schema | `node scratch/test_disposable_migration.js` (Exit code 0) |
| **Change Management Runbook** | Documented standard 6-step migration lifecycle, safe schema evolution patterns, concurrent index rules, and emergency procedures | [`docs/database-migration-runbook.md`](database-migration-runbook.md) |
| **Schema Reconciliation Corrections** | Corrected SQLite `prescription.date` nullability (`notnull: 0`) vs. Medora 2.0 `NOT NULL` with ETL coalesce rules, and documented legacy patient/doctor string ID conversions | [`docs/prescription-schema-reconciliation.md`](prescription-schema-reconciliation.md) & [`docs/06-open-questions.md`](06-open-questions.md) |

---

## 5. Phase 12 Domain Migration Summary: Medicine & Pharmacy Catalogue

| Property | Value | Evidence / Command |
| :--- | :--- | :--- |
| **Selected Domain** | **`MedicineModule`** (Medicine Master Catalogue & Pharmacy Metadata) & **Frontend Catalogue Dashboard** | Core hospital medicine master data, category hierarchy, manufacturer directory, dosage forms, measurement units, and supplier registry |
| **Target Database Mapping** | Modernized `medicine` model with normalized foreign keys (`category_id`, `manufacturer_id`, `dosage_form_id`, `measurement_unit_id`, `supplier_id`), `box` package format reconciled to `VARCHAR(100)`, dual price semantics (`price` hospital cost vs `s_price` retail), and supporting normalized entities (`medicine_category`, `manufacturer`, `dosage_form`, `measurement_unit`, `supplier`) | `backend/prisma/migrations/20261031120000_phase_12_medicine_catalogue/migration.sql`, verified on disposable PostgreSQL schema, applied to Supabase PostgreSQL |
| **Legacy Source Parity** | `legacy/app/Http/Controllers/MedicineController.php`, `legacy/app/Models/Medicine.php`, `legacy/app/Models/MedicineCategory.php`, `legacy/resources/views/app/medicines/` | Complete 12-field legacy mapping documented in [`docs/medicine-catalogue-mapping.md`](medicine-catalogue-mapping.md) |
| **Backend Endpoints** | `GET /api/v1/medicines`<br>`GET /api/v1/medicines/:id`<br>`POST /api/v1/medicines`<br>`PUT /api/v1/medicines/:id`<br>`DELETE /api/v1/medicines/:id`<br>`PATCH /api/v1/medicines/:id/toggle-active`<br>`GET /api/v1/medicines/search`<br>`GET /api/v1/medicines/meta/categories`<br>`POST /api/v1/medicines/meta/categories`<br>`DELETE /api/v1/medicines/meta/categories/:id`<br>`GET /api/v1/medicines/meta/manufacturers`<br>`POST /api/v1/medicines/meta/manufacturers`<br>`DELETE /api/v1/medicines/meta/manufacturers/:id`<br>`GET /api/v1/medicines/meta/dosage-forms`<br>`POST /api/v1/medicines/meta/dosage-forms`<br>`DELETE /api/v1/medicines/meta/dosage-forms/:id`<br>`GET /api/v1/medicines/meta/measurement-units`<br>`POST /api/v1/medicines/meta/measurement-units`<br>`DELETE /api/v1/medicines/meta/measurement-units/:id`<br>`GET /api/v1/medicines/meta/suppliers`<br>`POST /api/v1/medicines/meta/suppliers`<br>`PUT /api/v1/medicines/meta/suppliers/:id`<br>`DELETE /api/v1/medicines/meta/suppliers/:id` | Full OpenAPI Swagger documented endpoints with granular RBAC permissions |
| **Frontend Deliverables** | React 19 + TypeScript + Vite modern medicine catalogue suite in `frontend/src/components/MedicineCatalogue.tsx` | Formulary inventory KPIs (Total, In Stock, Out of Stock, Categories), live 300ms debounced search across brand/generic/strength, multi-criteria filters (category, manufacturer, status), tabular overview with status indicators, clinical detail modal, Add/Edit formulation modal with validation, and category/supporting entity CRUD management with inline deletion guards |
| **Business Rules & Data Integrity** | 1. Duplicate prevention: Rejects medicines with matching brand name and pack size/strength (`409 Conflict`)<br>2. Prescription snapshot immutability: Updates to catalogue brand/generic names never mutate historical `prescription_medicine` snapshot names<br>3. Deletion guards: Hard deletion is strictly blocked (`400 Bad Request`) if referenced by clinical prescriptions or pharmacy sale items; soft deactivation (`PATCH /:id/toggle-active`) supported instead<br>4. Category deletion guards: Blocks category deletion (`400 Bad Request`) while medicines remain mapped<br>5. Doctor prescribing permission: Granted `HospitalPermission.MEDICINE_VIEW` to `Doctor` persona so physicians can search and select formulary drugs | `MedicineService` unit test suite (25 unit tests) & PostgreSQL E2E suite (18 integration tests) |
| **Authorization & Security** | Granular RBAC (`medicine_view`, `medicine_add`, `medicine_update`, `medicine_delete`) | Pharmacist & Admin authorized for management; Doctor authorized for read/autocomplete (`medicine_view`); unauthenticated or unauthorized operations rejected (401/403) |
| **Unit Test Coverage** | **16 suites passed, 147 tests passed** (25 new tests in `medicine.service.spec.ts`) | `npm test` (Exit code 0) |
| **E2E Integration Tests**| **10 suites passed, 107 tests passed** across all modules against live Supabase PostgreSQL (18 new tests in `medicine.e2e-spec.ts`) | `npm run test:e2e` (Exit code 0) |
| **Linting & Code Quality**| **ESLint 9 + Prettier + Strict TypeScript** | Backend: `npm run lint` (0 errors), `npx tsc --noEmit` (0 errors)<br>Frontend: `npm run lint` (0 errors), `tsc -b && vite build` (0 errors) |
| **Production Builds** | Backend: `npm run build` (Exit code 0)<br>Frontend: `npm run build` (Exit code 0, 1.48s) | Ready for containerization |
| **Legacy Source Integrity**| **100% Preserved** | `legacy/` 0 modifications; unstaged `app/Models/SMS.php` artifact strictly preserved |

---

## 6. Next Module Readiness

With `PatientModule`, `DepartmentModule`, `DoctorModule`, `AppointmentModule`, `ConsultationModule`, `InvoiceModule`, `PrescriptionModule`, and `MedicineModule` fully migrated and verified on Supabase PostgreSQL:
- **`Phase 13: Pharmacy Inventory & Dispensing Operations`**: Stock purchases, multi-batch tracking, expiry date monitoring, batch allocation, POS dispensing against outpatient prescriptions, inventory adjustment logs, and financial integration with `InvoiceModule`.
- **`Phase 14: Laboratory & Diagnostic Module`**: Lab test catalogues, specimen collection, outpatient diagnostic orders, and formal pathology/radiology report generation.

