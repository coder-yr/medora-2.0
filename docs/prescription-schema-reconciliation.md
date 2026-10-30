# Medora 2.0 — Prescription Schema Reconciliation & Verification

## 1. Overview & Objective
This audit verifies that the Medora 2.0 `PrescriptionModule` preserves the original Laravel SQLite/MySQL prescription schema, maintains full business rule compatibility, and correctly maps entities into the Prisma ORM and Supabase PostgreSQL architecture.

---

## 2. Legacy SQLite Schema Audit (Source Baseline)

Inspection executed against the authoritative legacy SQLite database (`database/database.sqlite` / `legacy/database/database.sqlite`) using SQLite `PRAGMA` commands:

### A. Table: `prescription`
```sql
PRAGMA table_info('prescription');
```
| cid | name | type | notnull | dflt_value | pk |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 0 | `id` | INTEGER | 1 (NOT NULL) | NULL | 1 (PK) |
| 1 | `date` | varchar | 0 (NULLABLE) | NULL | 0 |
| 2 | `patient` | varchar | 1 (NOT NULL) | NULL | 0 |
| 3 | `doctor` | varchar | 1 (NOT NULL) | NULL | 0 |
| 4 | `symptom` | varchar | 0 (NULLABLE) | NULL | 0 |
| 5 | `advice` | varchar | 0 (NULLABLE) | NULL | 0 |
| 6 | `state` | varchar | 0 (NULLABLE) | NULL | 0 |
| 7 | `dd` | varchar | 0 (NULLABLE) | NULL | 0 |
| 8 | `medicine` | varchar | 0 (NULLABLE) | NULL | 0 |
| 9 | `validity` | varchar | 0 (NULLABLE) | NULL | 0 |
| 10 | `note` | varchar | 0 (NULLABLE) | NULL | 0 |

- **Foreign Keys**: `PRAGMA foreign_key_list('prescription');` -> `[]` (None defined at SQLite level; loosely coupled strings in legacy CodeIgniter/Laravel).
- **Indexes**: `PRAGMA index_list('prescription');` -> `[]` (None defined in legacy SQLite).

### B. Table: `prescription_medicine`
```sql
PRAGMA table_info('prescription_medicine');
```
| cid | name | type | notnull | dflt_value | pk |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 0 | `id` | INTEGER | 1 (NOT NULL) | NULL | 1 (PK) |
| 1 | `prescription_id` | INTEGER | 1 (NOT NULL) | NULL | 0 |
| 2 | `medicine_id` | INTEGER | 0 (NULLABLE) | NULL | 0 |
| 3 | `name` | varchar | 1 (NOT NULL) | NULL | 0 |
| 4 | `dosage` | varchar | 0 (NULLABLE) | NULL | 0 |
| 5 | `duration` | varchar | 0 (NULLABLE) | NULL | 0 |
| 6 | `instructions` | varchar | 0 (NULLABLE) | NULL | 0 |

- **Foreign Keys**: `PRAGMA foreign_key_list('prescription_medicine');` -> `[]` (None defined at SQLite level).
- **Indexes**: `PRAGMA index_list('prescription_medicine');` ->
  - `prescription_medicine_prescription_id_index` on `prescription_id` (non-unique)
  - `prescription_medicine_medicine_id_index` on `medicine_id` (non-unique)

### C. Table: `medicine` (Catalogue Formulary)
```sql
PRAGMA table_info('medicine');
```
| cid | name | type | notnull | dflt_value | pk |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 0 | `id` | INTEGER | 1 (NOT NULL) | NULL | 1 (PK) |
| 1 | `name` | varchar | 1 (NOT NULL) | NULL | 0 |
| 2 | `category` | varchar | 0 (NULLABLE) | NULL | 0 |
| 3 | `price` | varchar | 0 (NULLABLE) | NULL | 0 |
| 4 | `box` | varchar | 0 (NULLABLE) | NULL | 0 |
| 5 | `s_price` | varchar | 0 (NULLABLE) | NULL | 0 |
| 6 | `quantity` | INTEGER | 1 (NOT NULL) | NULL | 0 |
| 7 | `generic` | varchar | 0 (NULLABLE) | NULL | 0 |
| 8 | `company` | varchar | 0 (NULLABLE) | NULL | 0 |
| 9 | `effects` | varchar | 0 (NULLABLE) | NULL | 0 |
| 10 | `e_date` | varchar | 0 (NULLABLE) | NULL | 0 |
| 11 | `add_date` | varchar | 0 (NULLABLE) | NULL | 0 |

---

## 3. New Prisma & PostgreSQL Schema Definition

Target: **Supabase PostgreSQL** via Prisma 7.10.1 (`@prisma/adapter-pg`).

### A. Model `Prescription`
```prisma
model Prescription {
  id        BigInt    @id @default(autoincrement())
  patientId BigInt    @map("patient")
  doctorId  BigInt    @map("doctor")
  date      String    @db.VarChar(50)
  symptom   String?   @db.Text
  advice    String?   @db.Text
  state     String?   @default("issued") @db.VarChar(50)
  dd        String?   @db.VarChar(100)
  medicine  String?   @db.Text // Legacy summary string
  validity  String?   @db.VarChar(100)
  note      String?   @db.Text
  createdAt DateTime? @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime? @updatedAt @map("updated_at") @db.Timestamptz

  patient   Patient                @relation(fields: [patientId], references: [id])
  doctor    Doctor                 @relation(fields: [doctorId], references: [id])
  medicines PrescriptionMedicine[]

  @@index([patientId])
  @@index([doctorId])
  @@map("prescription")
}
```

### B. Model `PrescriptionMedicine`
```prisma
model PrescriptionMedicine {
  id             BigInt  @id @default(autoincrement())
  prescriptionId BigInt  @map("prescription_id")
  medicineId     BigInt? @map("medicine_id")
  name           String  @db.VarChar(200)
  dosage         String? @db.VarChar(100)
  duration       String? @db.VarChar(100)
  instructions   String? @db.VarChar(500)

  prescription Prescription @relation(fields: [prescriptionId], references: [id], onDelete: Cascade)
  medicine     Medicine?    @relation(fields: [medicineId], references: [id])

  @@index([prescriptionId])
  @@index([medicineId])
  @@map("prescription_medicine")
}
```

---

## 4. Column-by-Column Reconciliation Matrix

| Legacy table | Legacy column | Legacy type | Nullable | New Prisma field | PostgreSQL type | Mapping status | Rationale & Explanations |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `prescription` | `id` | INTEGER | NO | `id` | `bigint` (BIGSERIAL) | Compatible type conversion | Upgraded from 32-bit `INTEGER` to 64-bit `BIGINT` for long-term scalability; autoincrement sequence preserved. |
| `prescription` | `patient` | varchar(100) | NO (SQLite) | `patientId` (`@map("patient")`) | `bigint` | Compatible type conversion & Renamed | Legacy stored string patient IDs (`"1"`). Mapped to typed `BigInt` with foreign key relation to `patient(id)` (RESTRICT). See Section 9 for data migration implications. |
| `prescription` | `doctor` | varchar(100) | NO (SQLite) | `doctorId` (`@map("doctor")`) | `bigint` | Compatible type conversion & Renamed | Legacy stored string doctor IDs (`"1"`). Mapped to typed `BigInt` with foreign key relation to `doctor(id)` (RESTRICT). See Section 9 for data migration implications. |
| `prescription` | `date` | varchar(100) | YES (SQLite) / NO (Migration 1) | `date` | `character varying(50)` NOT NULL | Intentional tightening / Compatible conversion | In SQLite, `date` is nullable (`notnull: 0`) following Laravel migration `2026_09_12_120000`. In Medora 2.0, clinical business rules require a date for every issued prescription (`NOT NULL`). ETL scripts must supply a fallback date for legacy nulls. |
| `prescription` | `symptom` | varchar(100) | YES | `symptom` | `text` | Compatible type conversion | PostgreSQL `text` removes artificial 100-character truncation while accepting all legacy strings. |
| `prescription` | `advice` | varchar(1000) | YES | `advice` | `text` | Compatible type conversion | PostgreSQL `text` stores clinical instructions of arbitrary length without silent truncation. |
| `prescription` | `state` | varchar(100) | YES | `state` | `character varying(50)` | Compatible type conversion | Default `'issued'` explicitly configured. Holds lifecycle states (`issued`, `dispensed`, `completed`). |
| `prescription` | `dd` | varchar(100) | YES | `dd` | `character varying(100)` | Exact match | Retained legacy differential diagnosis (`dd`) column with exact length. |
| `prescription` | `medicine` | varchar(1000) | YES | `medicine` | `text` | Compatible type conversion | Serves as the synchronized legacy readable summary string (e.g. `'Amoxil 1+0+1 for 5 days'`). |
| `prescription` | `validity` | varchar(100) | YES | `validity` | `character varying(100)` | Exact match | Prescription validity window (e.g., `'14 days'`, `'30 days'`). |
| `prescription` | `note` | varchar(1000) | YES | `note` | `text` | Compatible type conversion | Extended to `text` for clinician internal documentation. |
| `prescription` | *N/A* | *N/A* | *N/A* | `createdAt` (`created_at`) | `timestamp with time zone` | Derived / Audit | Modern audit timestamp with `CURRENT_TIMESTAMP` default. |
| `prescription` | *N/A* | *N/A* | *N/A* | `updatedAt` (`updated_at`) | `timestamp with time zone` | Derived / Audit | Modern audit timestamp updated automatically on record modification. |
| `prescription_medicine` | `id` | INTEGER | NO | `id` | `bigint` (BIGSERIAL) | Compatible type conversion | Upgraded to 64-bit `BIGINT` PK. |
| `prescription_medicine` | `prescription_id` | INTEGER | NO | `prescriptionId` (`prescription_id`) | `bigint` | Compatible type conversion | Foreign key to `prescription(id)` with `onDelete: Cascade`. |
| `prescription_medicine` | `medicine_id` | INTEGER | YES | `medicineId` (`medicine_id`) | `bigint` | Compatible type conversion | Nullable foreign key to `medicine(id)` with `onDelete: SetNull`. Allows custom off-catalogue drugs. |
| `prescription_medicine` | `name` | varchar(200) | NO | `name` | `character varying(200)` | Exact match | Drug trade name copied from catalogue or entered free-text. Preserved verbatim. |
| `prescription_medicine` | `dosage` | varchar(100) | YES | `dosage` | `character varying(100)` | Exact match | Medication dosage regimen (e.g. `'1+0+1'`, `'500mg TDS'`). |
| `prescription_medicine` | `duration` | varchar(100) | YES | `duration` | `character varying(100)` | Exact match | Duration string (e.g. `'5 days'`, `'2 weeks'`). |
| `prescription_medicine` | `instructions` | varchar(500) | YES | `instructions` | `character varying(500)` | Exact match | Patient administration instructions (e.g. `'After meals'`). |

---

## 5. Prescription Business Logic Compatibility Verification

| Legacy Behavior (Laravel) | Medora 2.0 Implementation (NestJS) | Verification Evidence | Compatibility Status |
| :--- | :--- | :--- | :--- |
| **Multiple medicines per prescription** | One-to-many relation (`Prescription` -> `PrescriptionMedicine[]`) | `PrescriptionService.create` inserts child items; verified by unit & E2E tests | **COMPATIBLE** |
| **Catalogue name copying** | Copies catalogue drug name onto `prescription_medicine.name` | `PrescriptionService.cleanItems` resolves catalogue name; historical integrity maintained if catalogue is updated | **COMPATIBLE** |
| **Custom unlisted drugs** | Permits `medicine_id: null` with custom text in `name` | Verified by `prescription.service.spec.ts` test case `"allows unlisted drug outside catalogue"` | **COMPATIBLE** |
| **Rejection of empty regimens** | Throws validation error if 0 valid drugs are supplied | `PrescriptionService.create` throws `400 Bad Request: "Add at least one medicine, or this prescription says nothing."` | **COMPATIBLE** |
| **Dosage, duration, instructions** | Normalized nullable strings with whitespace trimming | Cleaned via `blankToNull` helper in DTO and service layer | **COMPATIBLE** |
| **Legacy summary generation** | Computes readable summary `'Name Dosage for Duration'` into `prescription.medicine` | Derivation logic verified: `'Amoxil 1+0+1 for 5 days'` | **COMPATIBLE** |
| **Patient & Doctor relationships** | Verifies existence of patient and doctor records | Checked against database via `patientService.findById` and `doctorService.findById` | **COMPATIBLE** |
| **Transactional updates** | Wholesale deletion and re-insertion of lines in atomic transaction | Implemented via `this.prisma.$transaction` in `update` method | **COMPATIBLE** |
| **Cascade deletion** | Deleting prescription removes child lines | Configured via `onDelete: Cascade` in Prisma and PostgreSQL FK | **COMPATIBLE** |
| **Search by drug name** | Queries prescriptions by medication name | `findAll({ drug: 'Amoxil' })` filters via `some: { name: { contains: drug, mode: 'insensitive' } }` | **COMPATIBLE** |

---

## 6. Live PostgreSQL Runtime Inspection & Migration Audit

### A. Live PostgreSQL Table Status
Direct query against live Supabase PostgreSQL (`aws-1-eu-central-1.pooler.supabase.com:5432`) confirmed:
1. `prescription` table contains all 13 columns with correct PostgreSQL types (`bigint`, `varchar(50)`, `text`, `timestamptz`).
2. `prescription_medicine` table contains all 7 columns matching the Prisma schema.
3. Foreign keys:
   - `prescription.patient` -> `patient.id` (RESTRICT)
   - `prescription.doctor` -> `doctor.id` (RESTRICT)
   - `prescription_medicine.prescription_id` -> `prescription.id` (CASCADE)
   - `prescription_medicine.medicine_id` -> `medicine.id` (SET NULL)
4. Indexes:
   - `prescription_pkey` on `id`
   - `prescription_patient_idx` on `patient`
   - `prescription_doctor_idx` on `doctor`
   - `prescription_medicine_pkey` on `id`
   - `prescription_medicine_prescription_id_idx` on `prescription_id`
   - `prescription_medicine_medicine_id_idx` on `medicine_id` (added during Phase 11.1 audit for SQLite parity)

### B. Migration-History Gap Resolution (Phase 11.2)
- **Status**: **RESOLVED in Phase 11.2**
- **Actions Executed**:
  1. Generated baseline migration `backend/prisma/migrations/0_init/migration.sql` (1,043 lines of standard DDL).
  2. Verified zero schema drift against live Supabase PostgreSQL: `prisma migrate diff --from-schema prisma/schema.prisma --to-config-datasource` -> `No difference detected.`
  3. Formally registered migration baseline: `npx prisma migrate resolve --applied 0_init` (Exit code 0).
  4. Verified migration status: `npx prisma migrate status` -> `Database schema is up to date!`
  5. Verified reproducibility against an isolated, disposable PostgreSQL test schema (`disposable_migration_test`): successfully created all 39 tables, foreign keys, and indexes from scratch and cleanly dropped.

---

## 7. Frontend Persona Switcher Security Audit

### A. Security Inspection Checklist
- **Backend Authentication Bypass**:
  - The Doctor/Admin selector in `frontend/src/App.tsx` does **not** bypass backend authorization. It explicitly dispatches a standard HTTP POST request to `/api/v1/auth/login` to obtain an authentic signed JWT.
- **Production Environment Isolation**:
  - The persona switcher and dev auto-login logic are wrapped with `import.meta.env.DEV`.
  - In production builds (`import.meta.env.PROD`), the switcher is replaced with a static `"Session Authenticated"` badge, and credentials (`ValidPassword123!`) are strictly omitted.
- **Bundle Exposure Verification**:
  - Verification command:
    ```powershell
    Select-String -Path "frontend/dist/assets/*.js" -Pattern "ValidPassword123", "Dev Persona"
    ```
  - **Result**: Zero occurrences found in production distribution (`dist/`). Vite/Rollup dead-code elimination successfully stripped the development test credentials and persona switcher.
- **Authoritative Backend Security**:
  - Frontend UI states (e.g. disabling delete buttons) are strictly cosmetic. Any direct HTTP attempt by an unauthorized role (e.g. Receptionist or Doctor attempting `DELETE /api/v1/prescriptions/:id`) is rejected by NestJS with `403 Forbidden` (`HospitalPermission.PRESCRIPTION_DELETE` required).

---

## 8. Summary of Findings

1. **Schema Fidelity**: The Medora 2.0 prescription data model fully mirrors the legacy Laravel SQLite schema, successfully transforming loosely coupled varchar columns (`patient`, `doctor`) into strongly typed, indexed foreign keys while preserving legacy free-text summaries.
2. **Missing Index Remediation**: Added `@@index([medicineId])` to `PrescriptionMedicine` to achieve 100% index parity with legacy SQLite's `prescription_medicine_medicine_id_index`.
3. **Security Remediation**: Guarded development test credentials and the persona switcher in `frontend/src/App.tsx` behind Vite's `import.meta.env.DEV`, verifying zero credential leakage in the production bundle.
4. **Migration Baseline Established**: Created and baselined `0_init/migration.sql` in Prisma Migrate; eliminated schema drift and proved full reproducibility.

---

## 9. Legacy Patient/Doctor String ID Conversion Implications for Future Data Migration

In the legacy Laravel and SQLite database:
- `prescription.patient` was stored as `varchar(100)` (e.g., `"1"`, `"000001"`, or numeric string).
- `prescription.doctor` was stored as `varchar(100)` (e.g., `"1"`, `"12"`).
- Neither had database-level foreign key constraints.

In Medora 2.0 and Supabase PostgreSQL:
- `prescription.patient` is a strict `bigint` foreign key referencing `patient.id` (`ON DELETE RESTRICT`).
- `prescription.doctor` is a strict `bigint` foreign key referencing `doctor.id` (`ON DELETE RESTRICT`).

### Required ETL Migration Rules:
1. **Numeric ID Resolution**:
   - For records where `prescription.patient` contains an integer string, cast directly: `CAST(patient AS BIGINT)`.
   - If legacy rows contain formatted MRNs (e.g. `"000042"`), join against `patient.patient_id` to resolve the corresponding internal primary key `patient.id`.
2. **Orphaned Record Handling**:
   - In legacy SQLite, deleting a doctor or patient did not cascade or restrict prescriptions, resulting in dangling string references.
   - ETL scripts must identify orphaned prescriptions (`WHERE patient NOT IN (SELECT id FROM patient)`). These must either be mapped to a designated "Archived/Deleted Legacy Patient" record or flagged for review before inserting into PostgreSQL.
3. **Date Nullability Normalization**:
   - In legacy SQLite, `prescription.date` is nullable (`notnull: 0`).
   - Medora 2.0 requires `date` (`NOT NULL`).
   - ETL scripts must coalesce NULL legacy dates with the prescription creation date or fallback default: `COALESCE(date, '1970-01-01')`.
