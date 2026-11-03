
# Medora 2.0 — PostgreSQL Compatibility, Legacy Assumptions, & Open Questions

## 1. Architectural Decision Record (ADR)
- **Approved Target Database**: **Supabase PostgreSQL** (superseding earlier MariaDB/MySQL requirements).
- **ORM / Query Engine**: **Prisma ORM**.
- **Backend Service**: **NestJS + TypeScript** (sole trusted boundary for clinical and business logic).
- **Frontend Client**: **React + TypeScript + Vite**.
- **Background Processing**: **Redis + BullMQ**.
- **Infrastructure**: **Docker Compose** initially (Kubernetes only if justified).

---

## 2. PostgreSQL Compatibility & Type Mapping Considerations

When transitioning the 50+ legacy Laravel tables from MySQL/MariaDB/SQLite to Supabase PostgreSQL, the following dialect changes must be observed:

| Legacy MySQL/Laravel Concept | PostgreSQL / Supabase Equivalent | Migration Consideration |
| :--- | :--- | :--- |
| `TINYINT(1)` / `boolean` | `BOOLEAN` (`true`/`false`) | Legacy PHP often stores `0`/`1` or evaluates loose truthiness. Prisma maps `Boolean` strictly. Data migration scripts must cast `0/1` integers to boolean primitives. |
| `AUTO_INCREMENT` Primary Keys | `IDENTITY` / `BIGSERIAL` / `UUID` | Modern PostgreSQL prefers `BIGINT GENERATED ALWAYS AS IDENTITY` or `UUID` (e.g. `gen_random_uuid()`). A decision is required on whether to preserve existing auto-increment IDs for backwards compatibility or migrate to UUIDs. |
| `DATETIME` | `TIMESTAMPTZ` (`TIMESTAMP WITH TIME ZONE`) | MySQL `DATETIME` lacks timezone awareness. PostgreSQL best practice is `TIMESTAMPTZ` stored in UTC. All legacy timestamps must be explicitly assigned UTC offsets. |
| MySQL Zero Dates (`0000-00-00 00:00:00`) | `NULL` | PostgreSQL strictly rejects zero dates. Legacy columns with `0000-00-00` must be migrated to `NULL`. |
| `ENUM(...)` | PostgreSQL `ENUM` type or Foreign Key Lookup | Laravel uses schema enums. PostgreSQL supports native `CREATE TYPE ... AS ENUM`, but modifying enum values requires alter statements. Lookup tables or Prisma enums need evaluation per entity. |
| String Case Sensitivity & Collation | Case-sensitive (`ILIKE` / `citext`) | MySQL default collations (e.g. `utf8mb4_unicode_ci`) are case-insensitive for searches. In PostgreSQL, standard text searches are case-sensitive; case-insensitive lookups require `ILIKE` or `citext` extensions. |
| Financial Columns (`DECIMAL(x, y)`) | `DECIMAL(12, 2)` / `NUMERIC` | Critical for doctor shares, invoice lines, discounts, and payments. Floating point types are prohibited; precise fixed-point decimal arithmetic is required. |
| JSON Storage | `JSONB` | Legacy text columns storing serialized PHP arrays or JSON strings should map to native `JSONB` for indexing and query performance. |

---

## 3. Unsupported Legacy Assumptions in ICTHospital

1. **Implicit Group By & Strict Aggregations**:
   - Legacy CodeIgniter / early Laravel queries in ICTHospital occasionally rely on MySQL non-strict `GROUP BY` behavior (e.g., selecting columns without grouping or aggregating them). PostgreSQL rejects non-grouped, non-aggregate columns in `GROUP BY` queries.
2. **Silent String Truncation**:
   - MySQL in non-strict modes silently truncates strings exceeding column length. PostgreSQL strictly throws `value too long for type character varying(n)`.
3. **Double-Booking Race Condition Handling**:
   - The legacy Laravel codebase addressed appointment and bed booking collisions using `DB::transaction()` and pessimistic locking (`lockForUpdate()`).
   - In NestJS + Prisma with PostgreSQL, concurrency must use explicit transactions (`prisma.$transaction`) with appropriate isolation levels (`SERIALIZABLE` or `SELECT FOR UPDATE` raw/interactive transactions) to prevent double-booking.

---

## 4. Connection Strategy & Supabase Infrastructure

1. **Pooled Connection vs. Direct Connection**:
   - **Application Traffic (`DATABASE_URL`)**: Connects through Supabase's Supavisor connection pooler (transaction mode, typically port 6543). This avoids exhausting PostgreSQL connection limits under concurrent NestJS requests.
   - **Prisma Migrations (`DIRECT_URL`)**: Prisma CLI commands (`prisma migrate deploy`, `prisma migrate dev`) require a direct TCP session to execute schema operations and advisory locks, connecting to port 5432.
2. **Row-Level Security (RLS) vs. Backend Authorization**:
   - NestJS is the **primary trusted boundary** for all hospital workflows, authentication, role-based access control, and audit logging.
   - Frontend clients must **never** call Supabase Data APIs directly to execute clinical transactions or bypass NestJS.
   - If any tables are exposed via Supabase Data APIs, strict PostgreSQL RLS policies must be applied as a defense-in-depth safeguard.
3. **Credential & Secret Key Isolation**:
   - The Supabase `SERVICE_ROLE_KEY` bypasses all RLS policies and possesses superuser capabilities.
   - It must **never** be bundled into the React frontend, exposed in client bundles, logged to console, or committed to Git.
   - Only backend environment variables in NestJS may access privileged keys.

---

## 5. Background Processing with Redis & BullMQ

The legacy Laravel application relies on scheduled console commands:
- `hospital:appointment-reminder` (daily appointment reminders via SMS)
- `hospital:payment-reminder` (billing reminders via SMS)
- Asynchronous notification dispatches

**Target Architecture**:
- In Medora 2.0, background jobs will be powered by **BullMQ** running on **Redis**.
- NestJS worker modules will handle queue scheduling, retry backoff, dead-letter queues, and rate-limited SMS/email gateways.

---

## 6. Migration Risks & Guardrails

1. **No Production Data Access**:
   - Development and migration rehearsals must strictly use synthesized fixtures or anonymized staging data. No connections to live production databases are permitted.
2. **No Blind Translation**:
   - PostgreSQL migrations will not be generated by automated syntax converters. Each of the 50 legacy tables, foreign keys, triggers, and indices will be mapped with formal source-to-target documentation.
3. **Data Integrity & Financial Preservations**:
   - Ledger entries (invoices, part-payments, doctor revenue splits, shift cash reconciliations) must match legacy cents-level arithmetic exactly.

---

## 7. Open Questions Prior to Phase 1 Execution

1. **Primary Key Strategy**: Should existing auto-increment integer IDs (`BIGINT`) be retained for direct record mapping during data migration, or should new records use UUIDv7 while preserving legacy integer IDs in a `legacy_id` column?
2. **Auth Identity Provider**: Will user authentication rely on Supabase Auth (with NestJS validating Supabase JWTs), or custom NestJS JWT auth with user credentials stored directly in PostgreSQL?
3. **Soft Deletes**: Legacy Laravel models heavily utilize `SoftDeletes` (`deleted_at`). Should Prisma models implement a standard `deletedAt DateTime?` field and middleware filter, or will historical records use an archive/status table?
4. **Pessimistic Locking in Prisma**: Since Prisma's high-level API abstracts row locks, how will critical concurrency sections (bed allocations, appointment slots) be structured—via raw queries (`SELECT ... FOR UPDATE`) inside interactive transactions or optimistic concurrency tokens (`version` field)?

---

## 8. Additional Unresolved Questions Discovered in Phase 1 Audit

5. **Legacy Financial `VARCHAR` Data Cleansing**:
   - In legacy MariaDB/MySQL, columns such as `payment.gross_total` and `payment.amount_received` are declared as `VARCHAR(255)`, requiring runtime SQL `CAST` operations.
   - For Supabase PostgreSQL, Prisma models must enforce `Decimal(12, 2)`.
   - *Decision needed*: What automated sanitization or fallback rules should apply if historical migration extracts encounter non-numeric strings, empty spaces, or invalid currency symbols?
6. **Retirement of Hardcoded SuperAdmin Backdoor**:
   - Audit finding `SEC-01` confirmed a hardcoded bypass in `SuperAdmin.php` for `login == 'ictkashif'`.
   - *Decision needed*: In Medora 2.0, will initial administrator provisioning rely on environment variables (`INITIAL_ADMIN_EMAIL`), an automated seed script, or Supabase Auth console provisioning?
7. **Background Job Triggering & Manual Overrides**:
   - The legacy system allowed triggering payment reminders via public HTTP `GET /cronjob/payment-reminder`.
   - In Medora 2.0, scheduled reminders will run on Redis + BullMQ.
   - *Decision needed*: Should front-desk supervisors or accountants have an authenticated, rate-limited "Run Reminder Batch Now" action button in the React UI in addition to automated cron schedules?
8. **Clinical Attachment Storage & HIPAA/GDPR Compliance**:
   - Audit finding `SEC-04` revealed historical patient attachments residing on public storage disks.
   - In Medora 2.0, documents will be stored in private Supabase Storage buckets served via short-lived pre-signed URLs.
   - *Decision needed*: What cryptographic retention policy and patient consent rules apply when patients request data deletion under soft-delete versus hard-purge mandates?
9. **Telemedicine Provider & Room Encryption**:
   - Legacy telemedicine generates unauthenticated public Jitsi Meet links (`https://meet.jit.si/icthospital-...`).
   - *Decision needed*: Should Medora 2.0 continue using Jitsi Meet (with JWT moderation tokens), deploy a self-hosted Jitsi instance, or transition to a HIPAA-compliant WebRTC platform (e.g. Daily.co, LiveKit, or Twilio Video)?
10. **Telephony & Multi-Channel Gateway Architecture**:
    - Legacy notifications depend tightly on ICTCore and Telenor SMS APIs.
    - *Decision needed*: Should the NestJS `NotificationModule` implement an extensible adapter pattern supporting international providers (Twilio, AWS SNS, Vonage) alongside local telecom APIs?
---

## 9. Phase 3 Database Discovery & Prisma Mapping Decisions

The Phase 3 database discovery investigated the 104 SQLite tables, 924 columns, legacy Eloquent relationships, and financial schemas. Below are the architectural findings, engineer recommendations, and explicitly marked decisions required from project ownership.

### 11. UUID versus BIGINT Primary Keys
- **Evidence**: Legacy tables use auto-incrementing integer identifiers (`BIGINT` / `INTEGER`). Crucially, physical hospital processes rely on these numbers: patient MR numbers (`ICT-P-{id}`), appointment slips, invoice numbers (`INV-{id}`), prescription printouts, and barcoded specimen vials.
- **Recommendation**: Maintain a **Hybrid Identifier Pattern**:
  - Retain `id BigInt @id @default(autoincrement())` as the primary key and internal/physical display identifier.
  - Introduce `uuid String @unique @default(uuid())` as the public API identifier (for REST/GraphQL endpoints, client route URLs, and external webhook callbacks) to prevent integer enumeration attacks.
- **Owner Decision Required**:
  - [ ] **Option A (Recommended)**: Adopt hybrid `id (BigInt PK)` + `uuid (UUID Unique Public Identifier)`.
  - [ ] **Option B**: Transition purely to `UUIDv7` as the primary key, mapping legacy IDs into a `legacy_id BigInt?` column, and generating human-readable sequential sequence codes separately for physical printouts.

### 12. Legacy Identifier Preservation & Sequence Offsets
- **Evidence**: Over 100,000 historical records may exist across patient registers, lab reports, and ledger entries. In PostgreSQL, inserting explicit legacy primary keys requires manually synchronizing sequences via `SELECT setval(pg_get_serial_sequence('...', 'id'), max(id) + 1000)`.
- **Recommendation**: During initial migration load, insert historical rows with their exact legacy integer IDs. Run sequence elevation scripts immediately after staging load to reserve a buffer of 5,000 IDs before new records are inserted by Medora 2.0.
- **Owner Decision Required**:
  - [ ] **Option A (Recommended)**: Explicitly preserve legacy integer IDs 1:1, synchronizing PostgreSQL sequences with a safety buffer (+5000).
  - [ ] **Option B**: Re-key records sequentially starting from 1 with a separate lookup cross-reference table `legacy_id_mapping`.

### 13. Soft-Delete Architecture & Prisma Middleware
- **Evidence**: In legacy SQLite, only `hospital_branch` had an actual `deleted_at` column in the migration schema, despite multiple Laravel models including the `SoftDeletes` trait without migration columns. Clinical audit regulations (HIPAA, ISO 27001) prohibit physical hard deletes of medical consultations, lab results, prescriptions, and financial ledgers.
- **Recommendation**: Standardize soft-deletes across all clinical and operational entities in Prisma with `deletedAt DateTime? @map("deleted_at") @db.Timestamptz`. Enforce non-deleted filtering via Prisma client extensions (`prisma.$extends`) or a repository base class in NestJS, rather than ad-hoc controller queries.
- **Owner Decision Required**:
  - [ ] **Option A (Recommended)**: Standardize `deletedAt DateTime? @db.Timestamptz` on all core clinical and billing models, backed by automated Prisma client extension filters and hard-delete prohibition.
  - [ ] **Option B**: Use explicit status enums (`status: ACTIVE | ARCHIVED | CANCELLED`) instead of timestamp-based soft deletes.

### 14. Hospital Timezone Policy & UTC Normalization
- **Evidence**: Legacy MariaDB/SQLite instances stored datetimes as naive local strings (e.g. `2026-10-28 14:30:00` in Asia/Karachi `UTC+5`). PostgreSQL supports `TIMESTAMPTZ` (UTC internally, client timezone representation).
- **Recommendation**: Store all database timestamps as UTC `TIMESTAMPTZ`. Store the facility/branch default timezone (e.g. `Asia/Karachi`) in `hospital_branch.timezone`. The NestJS backend transforms timestamps to UTC on write and serializes ISO-8601 strings to the React frontend.
- **Owner Decision Required**:
  - [ ] **Option A (Recommended)**: Full UTC normalization (`TIMESTAMPTZ`) in Supabase PostgreSQL; frontend renders local hospital time based on user or branch profile.
  - [ ] **Option B**: Store naive timestamps with an explicit hospital timezone configuration fixed globally.

### 15. PostgreSQL Concurrency & Row-Locking Implementation
- **Evidence**: Legacy PHP controllers executed vulnerable non-atomic read-then-write sequences for pharmacy stock reduction, room/bed allocation, and appointment slot booking (Audit findings `SEC-06`, `SEC-08`).
- **Recommendation**:
  - For **Pharmacy Inventory & Payments**: Use PostgreSQL pessimistic locking via raw interactive queries inside Prisma transactions: `await tx.$queryRaw\`SELECT id, stock FROM medicine WHERE id = ${id} FOR UPDATE\``.
  - For **Appointments & Bed Allocation**: Use PostgreSQL exclusion constraints (`EXCLUDE USING gist`) and unique compound partial indexes (`UNIQUE (bed_id) WHERE status = 'OCCUPIED'`) to make overlapping bookings physically impossible at the database engine level.
- **Owner Decision Required**:
  - [ ] **Option A (Recommended)**: Adopt pessimistic row locks (`SELECT FOR UPDATE`) for financial/inventory mutations and PostgreSQL exclusion/unique constraints for bed/appointment occupancy.
  - [ ] **Option B**: Rely solely on optimistic concurrency tokens (`version Int @default(1)`) with application-level retry loops.

### 16. Supabase Connection Strategy: Connection Pooler (PgBouncer/Supavisor) vs Direct URL
- **Evidence**: Supabase provides two connection strings:
  - Port 6543 (Transaction Pooled / Supavisor): Required for serverless / auto-scaling instances to prevent max connection exhaustion. Cannot use prepared statements without configuration.
  - Port 5432 (Session Direct): Required for long-lived Prisma migration runners, advisory locks, and DDl operations.
- **Recommendation**: Configure both connection URLs in `prisma.config.ts` and NestJS environment variables:
  - `DATABASE_URL` (pooled, port 6543) with `?pgbouncer=true` for normal application queries and worker jobs.
  - `DIRECT_URL` (direct, port 5432) for running Prisma migrations and CLI introspections.
- **Owner Decision Required**:
  - [ ] **Option A (Recommended)**: Adopt dual pooled/direct configuration (`DATABASE_URL` + `DIRECT_URL`).
  - [ ] **Option B**: Connect directly via port 5432 with NestJS controlling a fixed connection pool size (10-20 connections).

### 17. Migration Ownership & Deployment Pipeline
- **Evidence**: Medora 2.0 requires seamless cutover from legacy MariaDB to Supabase PostgreSQL without data loss or prolonged hospital downtime.
- **Recommendation**:
  - Use `prisma migrate dev` exclusively during local and staging development.
  - For production deployment, use `prisma migrate deploy` driven by GitHub Actions CI/CD with mandatory backup verification prior to execution.
  - Historical data extraction will run via dedicated read-only PHP/Node ETL scripts writing directly to the staging Supabase instance during rehearsed maintenance windows.
- **Owner Decision Required**:
  - [ ] **Option A (Recommended)**: Automated Prisma deployment (`prisma migrate deploy`) integrated into CI/CD pipeline with pre-migration snapshot triggers.
  - [ ] **Option B**: Manual DBA execution of generated raw SQL migration scripts for every production schema modification.

### 18. Ambiguous Legacy Relationships & Retired Domain Entities
- **Evidence**:
  - Migration `2026_09_09_140000_remove_school_tables.php` dropped school tables, but 7 models (`Diary`, `FeeCol`, `FeeSetup`, `GPA`, `Marks`, `Question`, `Subject`) remained in `legacy/app/Models/`.
  - `hospital_setting` is a multi-tenant or key-value store lacking consistent foreign keys.
  - `package` and `package_item` link to treatments and laboratory tests using implicit numeric IDs without foreign keys.
- **Recommendation**:
  - Explicitly omit all 7 retired ICTSchool models from Prisma.
  - Normalize `hospital_setting` into typed config JSONB columns where appropriate or a typed key-value table with branch foreign key.
  - Define explicit foreign key constraints in Prisma for `package_item` (`service_id`, `lab_test_id`).
- **Owner Decision Required**:
  - [ ] **Option A (Recommended)**: Permanently deprecate legacy school entities and formalize implicit package/setting links with foreign keys.
  - [ ] **Option B**: Retain flexible polymorphic identifiers for package items without foreign key enforcement.

---

## 10. Phase 4 NestJS Backend Foundation Decisions

### 19. Identity Provider Boundary: Custom NestJS JWT vs Supabase Auth
- **Evidence**: The prompt mandates: *"Do not silently combine Supabase Auth with custom NestJS authentication. Record the chosen boundary and required owner decisions."*
- **Implementation State**:
  - The foundation implements a trusted **NestJS JWT Authentication Service** (`AuthService` + `JwtStrategy`) where NestJS signs and verifies JWTs containing user claims (`sub`, `email`, `group`, `permissions`, `branchId`).
  - An adapter method `validateSupabaseToken()` is prepared in `AuthService` to verify Supabase Auth RS256/HS256 tokens using `SUPABASE_JWT_SECRET` if Supabase Auth is adopted as the primary identity provider.
- **Recommendation**: Retain custom NestJS JWT as the default trusted authority for staff logins, which preserves hospital multi-branch staff profiles and avoids tight external vendor coupling. If external OAuth/SSO is required later, Supabase Auth can serve as the OAuth provider with NestJS mapping the external JWT.
- **Owner Decision Required**:
  - [ ] **Option A (Recommended)**: Custom NestJS JWT with staff credentials stored securely in PostgreSQL (Argon2id hashing), allowing full standalone operation and offline local development.
  - [ ] **Option B**: Fully delegate identity to Supabase Auth (staff accounts managed in Supabase Auth console/API), with NestJS validating inbound Supabase JWTs.

### 20. Initial System Administrator Bootstrap
- **Evidence**: Legacy audit finding `SEC-01` confirmed a hardcoded backdoor in `SuperAdmin.php` (`login == 'ictkashif'`). This has been completely eliminated in Phase 4.
- **Recommendation**: Use a deterministic CLI seed script (`npm run seed:admin`) reading `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` from local environment variables on first deployment, then requiring password rotation on first login.
- **Owner Decision Required**:
  - [ ] **Option A (Recommended)**: Environment variable-driven admin seed script (`INITIAL_ADMIN_EMAIL`) with mandatory first-login password rotation.
  - [ ] **Option B**: Manual database insert by authorized DBA during deployment rehearsal.

### 21. Background Queue Engine (Redis + BullMQ)
- **Evidence**: The approved stack notes that Redis + BullMQ are optional and must not be added unless a concrete, justified requirement exists in this phase.
- **Assessment**: Phase 4 focuses strictly on foundation (bootstrap, config, logging, correlation IDs, health, auth/RBAC primitives). No background queue is required for Phase 4. Queue infrastructure will be introduced in subsequent phases when scheduled payment reminders (remediating `SEC-02`) or SMS batch dispatching are implemented.
- **Recommendation**: Defer Redis + BullMQ integration until the domain module requiring asynchronous background jobs is scaffolded.
- **Owner Decision Required**:
  - [ ] **Option A (Recommended)**: Confirm deferral of Redis + BullMQ until background job domain features are implemented.
  - [ ] **Option B**: Pre-scaffold empty BullMQ module in backend foundation.

---

## 11. Phase 9 Clinical Consultation Decisions & Open Questions

### 22. Clinical Record Amendment & Retention Policy
- **Evidence**: In legacy ICTHospital, consultations had basic status transitions (`draft`, `completed`). Completed consultations in Phase 9 are made immutable by default to prevent silent overwriting of medical records (`400 Bad Request: Cannot modify a completed consultation record.`).
- **Recommendation**: Introduce a formal clinical amendment workflow in a future phase (e.g. `POST /consultations/:id/amend`) that captures the reason for addendum, preserves the original note verbatim with author timestamp, and creates an append-only audit trail (`ConsultationAddendum`).
- **Owner Decision Required**:
  - [ ] **Option A (Recommended)**: Append-only clinical addendum model where finalized notes cannot be edited, only supplemented with signed addenda.
  - [ ] **Option B**: Allow authoring doctor to unlock and amend completed notes within a 24-hour grace period with revision logging.

---

## 12. Phase 10 Billing & Invoice Decisions & Open Questions

### 23. Cashier Shift Closeout & Physical Cash Reconciliation
- **Evidence**: Legacy ICTHospital contains a separate `CashController` managing cashier shifts (`shift_close` table), where `invoice_payment.shift_close_id` binds receipts to a daily till handover. Phase 10 migrated core invoice issuance, installment tracking, and pessimistic locking, leaving `shift_close_id` nullable.
- **Recommendation**: Maintain nullable `shift_close_id` until the dedicated Cashier / Financial Reporting domain is migrated, then enforce cashier session binding upon collecting payments.
- **Owner Decision Required**:
  - [ ] **Option A (Recommended)**: Migrate Cashier Shift Closeout in a subsequent finance phase, linking open shifts to invoice payments.
  - [ ] **Option B**: Keep invoice payments decoupled from physical cashier till sessions, recording only `received_by` staff ID.

### 24. Direct Refund & Credit Balance Policy
- **Evidence**: Legacy source code strictly refuses any payment exceeding outstanding balance (`400 Bad Request: Only X is outstanding on this invoice.`), preventing negative balances or implicit customer credit. Furthermore, invoices with recorded payments cannot be deleted (`Money has been taken against this invoice, so it cannot be deleted.`).
- **Recommendation**: Retain the strict legacy overpayment refusal. Implement a dedicated, auditable refund / reversal transaction entity in a future phase rather than allowing negative balances on the main invoice header.
- **Owner Decision Required**:
  - [ ] **Option A (Recommended)**: Retain strict overpayment refusal; require formal refund/credit note records for returns.
  - [ ] **Option B**: Allow customer advance deposits / negative balances stored on patient accounts.

### 25. Clinical Encounter & Service Billing Association
- **Evidence**: Legacy source investigation reveals that clinical consultations do not automatically raise an invoice. Front-desk receptionists or billing accountants raise invoices explicitly, linking charge catalog items (`payment_category`) and optionally specifying the servicing doctor.
- **Recommendation**: Maintain decoupled invoice raising in Medora 2.0 while providing an optional reference linkage (`appointment_id` / `consultation_id`) on invoices for unified reporting.
- **Owner Decision Required**:
  - [ ] **Option A (Recommended)**: Retain manual billing workflow by default, with UI shortcuts to populate invoice charges from completed appointment/consultation services.
  - [ ] **Option B**: Enforce automated invoice creation upon consultation completion.

---

## 13. Phase 10.5 Security Hardening & Session Decisions

### 26. Authentication & Password Migration Architecture (Resolved)
- **Status**: **RESOLVED in Phase 10.5**
- **Decision Implemented**:
  - Strict database password verification against stored hashes.
  - Argon2id is the primary hashing standard for new passwords and accounts.
  - Legacy `$2y$` bcrypt hashes are verified with runtime transparent upgrade: upon successful legacy login, password is automatically re-hashed with Argon2id and updated in PostgreSQL.
  - Development backdoor completely eliminated. Uniform 401 response prevents email enumeration.

### 27. Token Expiry & Session Family Invalidation
- **Status**: **RESOLVED in Phase 10.5**
- **Decision Implemented**:
  - Access tokens expire after 15 minutes (900s).
  - Refresh tokens stored as SHA-256 hashes in `user_session` table with 7-day expiration.
  - Automatic rotation on every refresh request.
  - Family-based reuse detection: if an already-rotated/revoked token is submitted, the entire session family (`family_id`) is instantly revoked.

---

## 14. Phase 11 Prescription Module & Pharmacy Boundary Decisions

### 28. Pharmacy Dispensing Integration & Inventory Deductions
- **Evidence**: Legacy `prescription` and `prescription_medicine` are clinical order records. In the legacy Laravel code, prescribing a medicine does not automatically deduct physical inventory or dispense stock from the pharmacy until a pharmacist dispenses or bills it.
- **Recommendation**: Keep prescription creation as a pure clinical order within `PrescriptionModule`. When `PharmacyModule` is migrated in a subsequent phase, create an explicit dispensing workflow that references `prescription_id` to decrement medicine stock batches and optionally generate invoice items.
- **Owner Decision Required**:
  - [ ] **Option A (Recommended)**: Retain prescription as clinical ordering only; require explicit pharmacy dispensing step for inventory reduction.
  - [ ] **Option B**: Automatically decrement pharmacy inventory upon issuing a prescription.

### 29. Free-text Custom Medications vs. Catalogue-Enforced Items
- **Evidence**: In legacy hospital operations, physicians occasionally prescribe specialized formulations, extemporaneous compounding, or external medications not present in the hospital formulary (`medicine` table).
- **Recommendation**: Support a hybrid model: when `medicine_id` is supplied, validate it against the hospital catalog and copy the official name; if `medicine_id` is omitted/null, permit custom free-text medication names (`name` required).
- **Owner Decision Required**:
  - [ ] **Option A (Recommended)**: Retain hybrid model allowing both catalog drugs and free-text custom medications.
  - [ ] **Option B**: Strictly restrict prescriptions to active items in the hospital pharmacy formulary.

### 30. Regimen Immutability & Clinical Revision Audit
- **Evidence**: Legacy Laravel permitted in-place updates to prescriptions via `PrescriptionController@edit`. In Medora 2.0, updates atomically replace line items in an interactive transaction, refreshing the synchronized legacy summary text.
- **Recommendation**: Once prescriptions transition to an advanced state (e.g. `dispensed` or `completed`), lock the record against further updates and require a clinical revision/cancellation order.
- **Owner Decision Required**:
  - [ ] **Option A (Recommended)**: Lock prescriptions against updates once marked dispensed; require discontinuation order.
  - [ ] **Option B**: Continue permitting attending doctors to edit issued prescriptions prior to pharmacy dispensing.

---

## 15. Phase 11.2 Database Change Management & Data Migration Architecture

### 31. Legacy Data Migration Strategy for Loosely-Coupled String Foreign Keys
- **Evidence**: In legacy SQLite, `prescription.patient` and `prescription.doctor` stored `varchar` strings without database-level foreign key constraints. In Medora 2.0, PostgreSQL enforces strict `BIGINT` foreign keys referencing `patient(id)` and `doctor(id)` (`ON DELETE RESTRICT`).
- **Recommendation**: During full ETL migration from the legacy database, any orphaned records with non-existent patient or doctor IDs should be linked to designated sentinel records (e.g., `Patient #0: Legacy Unlinked Patient`, `Doctor #0: Legacy Unlinked Doctor`) with an audit flag, preserving historical clinical orders without violating relational integrity.
- **Owner Decision Required**:
  - [ ] **Option A (Recommended)**: Map orphaned legacy prescriptions to designated sentinel records to satisfy foreign keys while preserving historical records.
  - [ ] **Option B**: Exclude orphaned legacy records from import into Medora 2.0.

### 32. Legacy NULL Prescription Date Normalization
- **Evidence**: Legacy SQLite PRAGMA audit revealed `prescription.date` is nullable (`notnull: 0`) due to migration `2026_09_12_120000`. Medora 2.0 enforces `date VARCHAR(50) NOT NULL` in Prisma and PostgreSQL.
- **Recommendation**: For any legacy prescriptions lacking a date, the ETL data migration pipeline should populate the date using `COALESCE(date, SUBSTRING(created_at::text, 1, 10), '1970-01-01')`.
- **Owner Decision Required**:
  - [ ] **Option A (Recommended)**: Enforce `NOT NULL` on `date` and populate legacy nulls with creation date or fallback epoch.
  - [ ] **Option B**: Alter schema to allow nullable `date` on `prescription`.

---

## 16. Phase 12 Medicine Catalogue & Pharmacy Master Data

### 33. Normalization and Data Type of Legacy Column `box`
- **Evidence**: In legacy SQLite and Laravel (`MedicineController.php`), `box` is a `varchar(100)` field representing pack size or packaging description (e.g. "10x10 Tablets", "1 Bottle 120ml", "1 Vial"). The legacy system validated `'box' => 'nullable|string|max:100'` and enforced duplicate prevention across `name` and `box`. However, during initial Phase 3 discovery, `box` was tentatively typed as `Decimal(10,2)` in `schema.prisma`.
- **Recommendation**: Alter `medicine.box` to `VARCHAR(100)` to accurately hold pack descriptions and strengths, while normalizing structured `dosage_form_id`, `strength`, and `unit_id` alongside it for fine-grained clinical prescribing.
- **Owner Decision Required**:
  - [ ] **Option A (Recommended)**: Convert `box` to `VARCHAR(100)` to preserve legacy packaging text while introducing structured dosage forms and strength units.
  - [ ] **Option B**: Strictly migrate all pack descriptions into structured dosage form and strength entities, dropping `box`.

### 34. Dual Price Semantics: Cost Price (`price`) vs. Sale Price (`s_price`)
- **Evidence**: Legacy Laravel `DemoDataSeeder` and `form.blade.php` explicitly label `price` as "Cost price" (what the hospital paid to acquire the drug) and `s_price` as "Sale price" (what the patient is charged). Initial schema discovery labeled `price` as selling price.
- **Recommendation**: Clarify both fields: maintain `price` as hospital acquisition cost (default `0.00`), and `s_price` as standard patient retail dispensing price.
- **Owner Decision Required**:
  - [ ] **Option A (Recommended)**: Explicitly document and maintain `price` as purchase/cost price and `s_price` as patient retail price.
  - [ ] **Option B**: Rename columns to `cost_price` and `sale_price` via database migration.

### 35. Catalogue On-Hand Quantity vs. Phase 13 Batch/Lot Inventory Tracking
- **Evidence**: Legacy Laravel tracked stock as a single integer column `medicine.quantity`, which was decremented directly upon dispensing (`$medicine->decrement('quantity', $n)`). Phase 13 will introduce full pharmacy inventory management with lot numbers, supplier purchase invoices, and batch-level expiry tracking.
- **Recommendation**: Retain `medicine.quantity` in Phase 12 with `@default(0)` as a cached total on-hand quantity for backwards compatibility and instant UI display, while preparing normalized supplier references for Phase 13 inventory intake.
- **Owner Decision Required**:
  - [ ] **Option A (Recommended)**: Retain `quantity` as total on-hand balance and sync it with batch transactions in Phase 13.
  - [ ] **Option B**: Deprecate `quantity` immediately and require all stock lookups to calculate sum of active batches.

### 36. Formularies Referenced in Prescriptions: Deletion Blocking vs. Deactivation
- **Evidence**: In `legacy/app/Http/Controllers/MedicineController.php`, if `PrescriptionMedicine::where('medicine_id', $medicine->id)->exists()`, deletion is blocked with `"<name> has been prescribed, so it stays in the catalogue."`
- **Recommendation**: Enforce this deletion guard in Medora 2.0 `MedicineService`. If a drug has historical prescriptions, reject `DELETE` with `400 Bad Request` and advise the user to deactivate the drug (`is_active = false`), which removes it from new prescription autocomplete while preserving historical records.
- **Owner Decision Required**:
  - [ ] **Option A (Recommended)**: Block hard deletion of prescribed medicines and support soft deactivation.
  - [ ] **Option B**: Support soft deletion (`deleted_at`) across all catalogue tables.

---

## 17. Phase 13 Pharmacy & Inventory Management System

### 37. Authoritative Inventory Balance Strategy & Legacy Stock Transition
- **Evidence**: Legacy Laravel tracked stock purely via a single mutable integer column `medicine.quantity`. Medora 2.0 introduces multi-batch inventory (`medicine_batch`) and an immutable movement ledger (`stock_movement`).
- **Implementation**: `MedicineBatch.current_quantity` is the authoritative physical balance. `Medicine.quantity` is retained as a cached summary on the formulation header, atomically synchronized in the same PostgreSQL transaction during all receipts, dispensations, adjustments, and returns. This maintains 100% backward compatibility for legacy queries while guaranteeing that ledger movements explain all balance changes.
- **Owner Decision Required**:
  - [ ] **Option A (Recommended)**: Authoritative batch-level balances with atomic synchronization to `Medicine.quantity` and an append-only stock movement ledger.
  - [ ] **Option B**: Pure event-sourcing calculation where batch balances are derived strictly on-the-fly by summing `stock_movement` records without maintaining `current_quantity`.

### 38. Batch Selection Strategy & Override Policy
- **Evidence**: Clinical pharmacology best practice requires FEFO (First Expiry, First Out) to minimize medication spoilage and prevent administering expired drugs.
- **Implementation**: Automated dispensing default allocates stock from the earliest-expiring active batch (`expiry_date ASC`) with unexpired shelf life (`expiry_date > CURRENT_DATE`). Pharmacists can manually select an alternate batch if clinical or packaging constraints require it, provided the selected batch is active and unexpired.
- **Owner Decision Required**:
  - [ ] **Option A (Recommended)**: Automated FEFO default with optional pharmacist batch selection override for active, unexpired lots.
  - [ ] **Option B**: Strict mandatory FEFO with zero manual override capability.

### 39. Dispensing Billing Contract: Direct Invoice Integration
- **Evidence**: In legacy Laravel, `PharmacyPayment` acted as an isolated billing table parallel to `Payment` (hospital invoices), leading to bifurcated financial reporting.
- **Implementation**: Medora 2.0 links `PharmacyDispensation` to `Payment` (Invoice) via a foreign key `invoice_id`. When medication is dispensed, the pharmacy system can generate an invoice under the `PHARMACY` payment category or settle charges directly, preventing duplicate financial entries while preserving departmental cash accounting.
- **Owner Decision Required**:
  - [ ] **Option A (Recommended)**: Unified billing integration linking `PharmacyDispensation` to `InvoiceModule` (`Payment` header and `InvoiceItem` rows).
  - [ ] **Option B**: Independent pharmacy register maintaining isolated cash collections without integration into patient invoices.

### 40. Returned Medication Disposal vs. Resaleable Restocking Policy
- **Evidence**: When patients return unused medications, safety regulations dictate that contaminated, opened, or cold-chain-broken medicines must not re-enter saleable inventory.
- **Implementation**: `PharmacyReturn` records condition as `SALEABLE`, `DAMAGED`, or `EXPIRED`. Only items explicitly confirmed as `SALEABLE` by a licensed pharmacist are returned to the batch inventory via `CUSTOMER_RETURN`. Damaged or expired returns generate write-off movements (`DAMAGED_WRITE_OFF` / `EXPIRED_WRITE_OFF`) without increasing available stock.
- **Owner Decision Required**:
  - [ ] **Option A (Recommended)**: Condition-based return triage where only verified `SALEABLE` packages re-enter inventory, while others are quarantined or written off.
  - [ ] **Option B**: Universal prohibition of patient medication returns to inventory (100% write-off policy).

---

## 18. Phase 14 Laboratory Management System (LIS)

### 41. Specimen Accessioning & Barcode Rejection Policy
- **Evidence**: Legacy Laravel had no sample collection records (`lab_sample`); requests directly received text results in `lab_test.result`. Medora 2.0 introduces specimen accessioning (`LabSample`) with unique identifiers and rejection tracking (`HEMOLYZED`, `CLOTTED`, `INSUFFICIENT_VOLUME`, `WRONG_CONTAINER`, `MISLABELED`).
- **Implementation**: When an order is raised, sample records are generated in `SAMPLE_PENDING` state. Phlebotomists collect specimens (`COLLECTED`), and laboratory reception accessions them (`RECEIVED`) or rejects them with an explicit clinical rationale (`REJECTED`), which returns the order to `SAMPLE_PENDING` for recollection.
- **Owner Decision Required**:
  - [ ] **Option A (Recommended)**: Explicit accessioning lifecycle where processing and result entry are blocked until specimen receipt is verified.
  - [ ] **Option B**: Streamlined direct result entry without mandatory phlebotomy accessioning steps for rapid walk-in tests.

### 42. Separation of Duties for Lab Result Entry vs. Verification/Approval
- **Evidence**: Clinical laboratory accreditation (ISO 15189 / CAP) requires that high-complexity analytical results entered by a laboratory technician be independently reviewed and verified by a pathologist or senior laboratorist before release to clinicians or patients.
- **Implementation**: Result entry moves test items to `RESULT_ENTERED`. Final clinical release to `COMPLETED` requires authorization with `lab_report_approve` permission, with the verifier identity (`verified_by`) and timestamp recorded. For small outpatient clinics, single-step verification can be permitted by administrators with both permissions.
- **Owner Decision Required**:
  - [ ] **Option A (Recommended)**: Role-based separation of duties requiring verified approval prior to report finalization, with dual-role override for solo practitioners.
  - [ ] **Option B**: Automatic immediate release upon entering all parameter results without a distinct verification stage.

### 43. Final Report Immutability vs. Structured Amendments
- **Evidence**: In legacy Laravel, results could be repeatedly edited by re-submitting the form, risking silent retroactive alterations to patient clinical records.
- **Implementation**: Once an order reaches `COMPLETED`, direct modifications are blocked (`400 Bad Request`). Any amendments must be submitted via `POST /lab/orders/:id/amend`, which records the prior value, the amended value, the reason for amendment, the authorizing pathologist, and the timestamp in an immutable `LabReportAmendment` audit trail.
- **Owner Decision Required**:
  - [ ] **Option A (Recommended)**: Strict report immutability with append-only clinical amendment logs.
  - [ ] **Option B**: Mutable reports with general revision timestamp updates.

### 44. Prepayment vs. Post-service Billing for Outpatient Laboratory Tests
- **Evidence**: The prompt specifies: *"Inspect the existing billing workflow before implementing payment requirements. Do not invent a mandatory prepayment policy."*
- **Implementation**: Medora 2.0 supports both workflows: tests can be ordered with immediate invoice generation (`invoice_id` linked to `InvoiceModule`), or raised as pending clinical orders where payment can be collected at the cashier desk either before sample collection or at report pickup.
- **Owner Decision Required**:
  - [ ] **Option A (Recommended)**: Flexible billing policy where unpaid orders are accepted for processing but clearly flagged in the LIS workspace.
  - [ ] **Option B**: Mandatory prepayment gate where phlebotomy cannot collect samples until payment is verified.

---

## 19. Phase 16 Legacy Gap Analysis & Remaining Modules

### 45. Inpatient Daily Bed Charge Accrual Algorithm
- **Evidence**: Legacy Laravel `alloted_bed` recorded `a_time` and `d_time` as free strings without automated daily billing accrual.
- **Resolution**: **Option A Implemented**. Discrete calendar day interval calculation with minimum 1 full day billing (`Math.max(1, ceil(durationMs / 86400000))`), automatically posting room charges across each stay interval upon discharge.
- **Decision Status**:
  - [x] **Option A (Adopted)**: Midnight/calendar day census calculation where daily rate is accrued per interval with a minimum of 1 day charge.
  - [ ] **Option B**: Exact elapsed hourly stay calculation.

### 46. Tiered Billing on Bed Transfers
- **Evidence**: When a patient is stepped up from a General Ward ($20/day) to an ICU bed ($120/day), legacy ICTHospital lacked transfer logs and overwrote `bed_id` on `alloted_bed`.
- **Resolution**: **Option A Implemented**. `BedAllocationHistory` tracks each room stay interval (`allocatedAt`, `releasedAt`, `rateSnapshot`, `transferReason`, `allocatedBy`, `releasedBy`), computing tiered charges accurately across all historical allocations upon discharge.
- **Decision Status**:
  - [x] **Option A (Adopted)**: Multi-interval bed allotment ledger tracking each room stay interval with rate snapshot under a master `Admission` record, calculating tiered charges accurately upon discharge.
  - [ ] **Option B**: Flat rate billing based on the final bed assigned at discharge.

### 47. Scope of Orphan Skeletons: Blood Bank & Operation Theatre
- **Evidence**: Legacy models `Donor`, `Bankb`, and `OtPayment` exist with database migrations, but have 0 controller routes, 0 Blade templates, and no active user workflows.
- **Owner Decision Required**:
  - [ ] **Option A (Recommended)**: Mark Blood Bank and Operation Theatre as future expansion modules requiring formal stakeholder workflow specification; focus immediate migration on verified core operational modules (Inpatient, Cashier, Staff Directory, Accounting).
  - [ ] **Option B**: Implement complete standalone OT and Blood Bank suites in Medora 2.0 based on greenfield specifications.

---

## 20. Phase 17 Inpatient & Bed Management System (IPD)

### 48. Concurrency Control & Double-Booking Prevention
- **Evidence**: In busy inpatient wards, two admissions clerks could attempt to allocate the same available bed concurrently, or two staff members could transfer patients into the same target bed.
- **Resolution**: Real PostgreSQL row-level pessimistic locking via `SELECT id FROM bed WHERE id = $1 FOR UPDATE` inside `prisma.$transaction`. Conflicting transactions fail immediately with `409 ConflictException: Bed is currently occupied or unavailable`.
- **Decision Status**:
  - [x] **Option A (Adopted)**: Strict row-level pessimistic locking (`FOR UPDATE`) with deterministic ordering on transfers to prevent deadlock and eliminate race conditions.
  - [ ] **Option B**: Optimistic version locking with client retry loops.

### 49. Inpatient Admission Folio vs. Outpatient Billing Boundary
- **Evidence**: Legacy Laravel lacked centralized folio tracking, causing inpatient pharmacy and lab bills to scatter across separate tables without unified settlement.
- **Resolution**: All clinical charges incurred during an inpatient stay (Bed, Pharmacy, Lab, Radiology, and Services) are posted to the patient's active `InpatientFolio` with an idempotent deduplication key (`idempotencyKey`). Outpatient orders retain `admissionId = null` and generate standard standalone invoices, preserving 100% database isolation and backwards compatibility.
- **Decision Status**:
  - [x] **Option A (Adopted)**: Unified Inpatient Admission Folio with idempotent charge posting across all clinical domains and complete outpatient isolation.
  - [ ] **Option B**: Shared generic invoice table with inpatient flags.

### 50. Bed Decontamination Lifecycle & Sanitation State
- **Evidence**: Releasing a bed directly to `AVAILABLE` on discharge risks immediate patient admission before housekeeping sanitizes the unit.
- **Resolution**: Upon patient discharge, the bed transitions automatically to `CLEANING`. It cannot be assigned to another admission until a nurse or ward manager explicitly marks it `AVAILABLE` via `POST /api/v1/inpatient/beds/:id/status`.
- **Decision Status**:
  - [x] **Option A (Adopted)**: Mandatory post-discharge `CLEANING` quarantine state requiring explicit housekeeping clearance.
  - [ ] **Option B**: Immediate automated transition to `AVAILABLE` upon discharge.

---

## 21. Phase 18 Cashier, Shift Close & Treasury Settlement

### 51. Single Active Shift Invariant per Cashier
- **Evidence**: Legacy Laravel `ShiftClose` lacked active shift enforcement, allowing cashiers to accept payments indefinitely without opening floats or formal shift boundaries.
- **Resolution**: A cashier is restricted to at most one active shift (`status IN ('OPEN', 'CLOSING', 'PENDING_APPROVAL')`). Attempting to open a second shift returns `409 ConflictException: Cashier already has an active shift`.
- **Decision Status**:
  - [x] **Option A (Adopted)**: Strict database and service-level invariant restricting each cashier to a single active shift until approved and closed.
  - [ ] **Option B**: Allow concurrent floating shifts across counters without session binding.

### 52. Physical Drawer Cash vs. Non-Cash Isolation
- **Evidence**: In legacy reports, card and bank payments were sometimes conflated with physical cash, leading to false drawer shortages during shift closing.
- **Resolution**: Only payments with `method = 'Cash'` contribute to expected physical drawer cash: `expectedCash = openingFloat + sum(cash_payments) - sum(cash_payouts) + sum(cash_adjustments)`. Non-cash collections (Card, Bank Transfer, Cheque, Online) are tracked in independent treasury buckets and never counted towards physical drawer cash.
- **Decision Status**:
  - [x] **Option A (Adopted)**: Strict financial separation between physical cash drawer balances and non-cash clearing methods.
  - [ ] **Option B**: Conflate all settlement methods into a single generic shift total.

### 53. Dual-Control Shift Approval & Separation of Duties
- **Evidence**: Legacy `CashController.php` allowed the same user closing a shift to mark it reconciled without managerial oversight.
- **Resolution**: Implemented dual-control verification. Cashiers count physical cash, record denomination breakdowns (5000, 1000, 500, etc.), and submit shifts to `PENDING_APPROVAL`. Cashiers cannot approve their own shift (`403 Forbidden: Separation of duties`). An authorized supervisor must review the variance and approve (`CLOSED`) or reject with a mandatory explanation (`REJECTED`). Dual-write backwards compatibility syncs approved closures to the legacy `shift_close` table.
- **Decision Status**:
  - [x] **Option A (Adopted)**: Enforced managerial separation of duties with denomination auditing, variance explanation, and legacy synchronization.
  - [ ] **Option B**: Single-step self-closing by cashiers without supervisor review.

### 54. Inpatient Folio Charge Accrual vs. Cashier Receipt Invariant
- **Evidence**: In hospital accounting, ordering a lab test or incurring a daily bed fee creates accrued hospital debt, but does NOT represent received cash.
- **Resolution**: Inpatient folio charges (`InpatientFolioItem`) do not generate `CashTransaction` records. Only when an actual payment is collected (e.g. folio deposit, direct invoice payment, or discharge folio settlement) does the cashier module create an immutable `CashTransaction` linked to the active shift.
- **Decision Status**:
  - [x] **Option A (Adopted)**: Strict segregation between debt accrual (folio charges) and cash receipts (settled payments).
  - [ ] **Option B**: Create temporary receipt records for uncollected folio charges.

### 55. Multi-Invoice Oldest-First Allocation with Audited Write-Offs
- **Evidence**: Returning outpatient and inpatient clients frequently owe balances across multiple historical invoices, which legacy cashiers struggled to reconcile individually.
- **Resolution**: Implemented unified patient treasury settlement (`POST /api/v1/cashier/settlement/:patientId`) allocating lump-sum payments to the oldest unpaid invoice first. Any approved concession or write-off requires a mandatory textual reason, updates invoice balances atomically within an interactive transaction, and records an auditable `write_off` transaction.
- **Decision Status**:
  - [x] **Option A (Adopted)**: Automated oldest-first debt liquidation with mandatory justification for write-offs.
  - [ ] **Option B**: Require manual line-by-line payment against individual invoices.

---

## 22. Phase 19 Non-Medical Staff Registers & HR Directory Decisions

### 56. Decoupled Employee Identity vs. Authentication Account
- **Evidence**: Legacy Laravel had five duplicate role tables (`nurse`, `pharmacist`, `laboratorist`, `receptionist`, `accountant`) with separate `ion_user_id` strings and zero HR attributes or assignment history.
- **Resolution**: Staff profiles (`StaffProfile`) store real-world human employee attributes (name, contact, qualifications, department, designation, branch, manager). Authentication credentials are delegated entirely to `User` and `AuthModule`. A user account can be linked to at most one staff profile (`userId BigInt? @unique`). Staff profiles can exist without login credentials (e.g. temporary, outsourced, or trainee staff).
- **Decision Status**:
  - [x] **Option A (Adopted)**: Decoupled HR staff profile model with 1-to-1 unique optional user account linkage.
  - [ ] **Option B**: Duplicate login credentials and passwords inside staff profile tables.

### 57. Concurrency-Safe Sequential Employee Numbering (`EMP-YYYYMM-XXXX`)
- **Evidence**: Legacy staff records lacked formal employee identifiers, relying solely on arbitrary database auto-increment IDs.
- **Resolution**: Implemented structured, sortable, monthly employee numbers: `EMP-YYYYMM-XXXX`. Concurrency safety is guaranteed by acquiring a PostgreSQL transaction advisory lock (`pg_advisory_xact_lock(hashtext('staff_employee_number'))`) before querying the maximum sequence and generating the next identifier.
- **Decision Status**:
  - [x] **Option A (Adopted)**: PostgreSQL transaction-level advisory locking for sequential numbering with optimistic retry fallback.
  - [ ] **Option B**: Client-side UUIDs or random alphanumeric strings.

### 58. Auditable Department Transfers & Designation History
- **Evidence**: Legacy systems overwrote department strings directly on staff or doctor records, losing historical department assignments when nurses or technicians transferred between wards.
- **Resolution**: Implemented `StaffDepartmentAssignment` tracking primary status, effective start, and effective end dates. Department transfers close previous active assignments and create new records while logging an immutable `StaffEmploymentHistory` audit event.
- **Decision Status**:
  - [x] **Option A (Adopted)**: Relational assignment tracking preserving historical department and designation tenures.
  - [ ] **Option B**: Overwrite current department on employee record without historical tracking.

### 59. Offboarding & Audit Preservation Invariant
- **Evidence**: In legacy Laravel, clicking "Delete Staff" performed a hard `DELETE`, which orphaned foreign keys or risked cascade-deleting historical records.
- **Resolution**: Offboarding sets `employmentStatus = 'TERMINATED'`, records exit date and mandatory exit justification, closes active department assignments, and optionally revokes active login sessions in `UserSession`. Historical records, cashier shifts, prescriptions, and lab tests remain **100% immutable and intact**.
- **Decision Status**:
  - [x] **Option A (Adopted)**: Strict soft offboarding with mandatory reason, session revocation, and zero deletion of historical financial/clinical data.
  - [ ] **Option B**: Hard deletion of staff profiles.

---

## 23. Phase 20 General Accounting, Chart of Accounts & Expense Ledger Decisions

### 60. Double-Entry General Ledger Invariant vs. Legacy Single-Entry
- **Evidence**: Legacy ICTHospital used flat single-entry tables (`accounting`, `expense`) with unvalidated string amounts and unstructured categories, with zero mathematical equilibrium checks.
- **Resolution**: Implemented enterprise GAAP/IFRS double-entry general ledger (`accounting_journal_entry`, `accounting_journal_line`). Every posted transaction mathematically asserts $\sum \text{Debit} = \sum \text{Credit}$ with decimal(14,2) precision. Unbalanced attempts are strictly rejected with `400 Bad Request`.
- **Decision Status**:
  - [x] **Option A (Adopted)**: Strict double-entry accounting ledger with real-time debit/credit equilibrium invariant.
  - [ ] **Option B**: Retain legacy single-entry cashbook model.

### 61. Immutable Posted Journals & Signed Mirror-Image Reversals
- **Evidence**: Legacy application permitted users to edit or delete accounting records directly without an audit trail.
- **Resolution**: Implemented immutable ledger invariant: posted journal entries cannot be edited or deleted (`403 Forbidden`). Adjustments require signed mirror-image reversal entries (`POST /api/v1/accounting/journals/:id/reverse`) with mandatory audit justification, which swaps all debits and credits and marks the original journal `REVERSED`.
- **Decision Status**:
  - [x] **Option A (Adopted)**: Strictly immutable posted journals with auditable mirror-image reversal workflow.
  - [ ] **Option B**: Mutable accounting records with in-place updates.

### 62. Multi-Stage Expense Lifecycle & Separation of Duties
- **Evidence**: Legacy expenses were directly inserted without review, approval, or validation.
- **Resolution**: Formal state machine: `DRAFT` &rarr; `SUBMITTED` &rarr; `APPROVED` &rarr; `PAID` (or `REJECTED`, `CANCELLED`). Enforced Separation of Duties: submitters are strictly forbidden from approving their own expenses (`expense.createdById !== approverUserId`). Disbursing payment automatically creates and posts a balanced double-entry journal entry.
- **Decision Status**:
  - [x] **Option A (Adopted)**: Dual-control multi-stage expense workflow with mandatory separation of duties.
  - [ ] **Option B**: Single-click unapproved direct expense logging.

### 63. Accounting Period Lockout vs. Historical Back-Posting
- **Evidence**: Legacy had no fiscal periods; users could back-date transactions indefinitely.
- **Resolution**: Implemented `AccountingPeriod` (`OPEN`, `CLOSED`). Closing a period checks for zero unposted drafts and asserts debit/credit balance. Once closed, posting any journal with an accounting date within the period is blocked with `409 Conflict`. Reopening requires high-level administrative authorization and mandatory reason logging.
- **Decision Status**:
  - [x] **Option A (Adopted)**: Strict accounting period locks preventing back-posting into closed books.
  - [ ] **Option B**: Allow unrestricted posting to any historical date without period locks.

---

## 24. Phase 21 Hospital Settings, Branding & Multi-Branch Management Decisions

### 64. Three-Tier Configuration Precedence Architecture
- **Evidence**: In legacy Laravel, settings were stored in a flat single-row table (`settings` / `website_settings`) with zero branch overrides, zero change tracking, and hardcoded values scattered throughout Blade views.
- **Resolution**: Implemented a deterministic 3-tier configuration hierarchy: `EffectiveSettings = Branch Override ?? Hospital Default ?? System Fallback`. Downstream modules query `getEffectiveSettings(branchId)` to obtain unified configuration without duplicating fallback logic.
- **Decision Status**:
  - [x] **Option A (Adopted)**: Formal 3-tier inheritance model (`BranchSettings` overrides `HospitalSettings` overrides System Defaults).
  - [ ] **Option B**: Completely isolated per-branch settings without global fallback inheritance.

### 65. Multi-Branch Access Enforcement & Zero-Trust Server Boundary
- **Evidence**: Legacy Laravel `BranchController.php` relied on client-side session state (`session(['branch_id' => $id])`) and treated users with `users.branch_id === null` as global admins who could switch to any branch without authorization checks.
- **Resolution**: Implemented `UserBranchMembership` allowing users to legitimately hold active assignments across multiple facilities. Introduced `BranchAccessGuard` validating `X-Branch-Id` headers and route parameters on the server side on every request. Cross-branch access by unassigned users is strictly rejected with `403 Forbidden`.
- **Decision Status**:
  - [x] **Option A (Adopted)**: Zero-trust server-side validation via `BranchAccessGuard` checking `UserBranchMembership` and blocking cross-branch tampering.
  - [ ] **Option B**: Client-side session-based branch switching without server validation.

### 66. Concurrency-Safe Branch Document Sequence Allocation
- **Evidence**: Generating invoices (`INV-MAIN-2026-000001`), patient numbers (`MRN-MAIN-2026-000001`), appointments, and admissions across concurrent desks risked race conditions and duplicate reference numbers.
- **Resolution**: Implemented `BranchDocumentSequence` coupled with PostgreSQL transaction advisory locks (`SELECT pg_advisory_xact_lock(hashtext('DOC_SEQ_' || branchId || '_' || docType || '_' || year))`). Guarantees strictly monotonic sequence generation with zero collisions and zero gaps even under concurrent workloads.
- **Decision Status**:
  - [x] **Option A (Adopted)**: PostgreSQL advisory-locked atomic sequence allocation with branch and year scoping.
  - [ ] **Option B**: Random UUID identifiers without sequential ordering.

### 67. Branch Deactivation Safety & Isolation Invariant
- **Evidence**: In legacy Laravel, deactivating a branch was a simple boolean toggle that could strand open cash drawers or unposted clinical encounters.
- **Resolution**: Deactivating a branch (`setBranchStatus(id, false)`) performs safety checks: rejects deactivation if active open cashier shifts exist (`cashierShift.status === 'OPEN'`). Once deactivated, `BranchAccessGuard` isolates the branch, preventing new clinical admissions, appointments, or cashier transactions while preserving historical records for compliance.
- **Decision Status**:
  - [x] **Option A (Adopted)**: Enforced deactivation pre-checks (unclosed shift prevention) and complete operational isolation of inactive branches.
  - [ ] **Option B**: Unrestricted deactivation without validation of open shifts or transactions.

---

## 25. Phase 22 Notifications, Messaging & Background Job Infrastructure Decisions

### 68. Permanent Ban on Legacy Unauthenticated Cron Routes
- **Evidence**: Legacy Laravel `CronjobController.php` exposed an unauthenticated public route `/cronjob/payment-reminder` that iterated over patient balances and triggered external telecom gateways.
- **Resolution**: Legacy unauthenticated public cron routes are permanently decommissioned and banned (`404 Not Found`). All background tasks, reminders, and outbox batch jobs run through authenticated server-side workers (`POST /api/v1/admin/notifications/process-outbox`) protected by `JwtAuthGuard` and `PermissionsGuard`.
- **Decision Status**:
  - [x] **Option A (Adopted)**: Permanent exclusion and ban of public cron endpoints; all jobs triggered via secure background infrastructure.
  - [ ] **Option B**: Recreate public `/cronjob` endpoint with token in URL query parameter.

### 69. Transactional Outbox Pattern for Delivery Atomicity
- **Evidence**: Dispersing notifications synchronously inside clinical or financial request handlers causes transaction timeouts, uncommitted state leaks, or lost notifications if the external provider fails.
- **Resolution**: Implemented the Transactional Outbox Pattern (`NotificationOutbox`). Notifications and their outbox jobs are persisted atomically within the exact same database transaction as the business event. The background worker asynchronously claims, locks, and dispatches jobs with exponential backoff and watchdog recovery.
- **Decision Status**:
  - [x] **Option A (Adopted)**: Transactional outbox with state machine (`PENDING` &rarr; `PROCESSING` &rarr; `DELIVERED` / `RETRYABLE` / `DEAD_LETTER`).
  - [ ] **Option B**: Synchronous network calls to third-party SMS/Email gateways inside HTTP controllers.

### 70. Recipient Isolation & PHI Minimization
- **Evidence**: Legacy SMS and notification logs stored raw telephone numbers and recipient messages in plaintext logs viewable across roles.
- **Resolution**: Enforced zero-trust recipient isolation: `NotificationRecipient.userId` restricts feed access strictly to the authenticated user. In phone dispatch and logging, phone numbers are redacted (e.g., `92300*****12`), and template variables are sanitized with HTML entity encoding to prevent XSS.
- **Decision Status**:
  - [x] **Option A (Adopted)**: Strict recipient query isolation and PHI redaction in logs and provider payloads.
  - [ ] **Option B**: Shared multi-user notification tables without user-bound query filters.

---

## 26. Phase 23 Executive Dashboard & Operational Analytics Decisions

### 71. Real-Time PostgreSQL Aggregations vs. Data Warehousing / BI Tools
- **Evidence**: Legacy Laravel lacked real-time executive visibility and relied on slow client-side Blade iterations or raw SQL queries that risked database performance degradation.
- **Resolution**: Implemented high-performance live server-side aggregations with indexed range boundaries and short-lived in-memory caching (30s TTL). Bounded custom date ranges to 366 days to protect database throughput. Avoided external BI or warehouse complexity in this phase.
- **Decision Status**:
  - [x] **Option A (Adopted)**: PostgreSQL live index-backed aggregations with short-lived memory TTL caching.
  - [ ] **Option B**: Standalone external BI server / dedicated data lake.

### 72. Role-Based Financial KPI Redaction
- **Evidence**: Exposing revenue, cash collections, and accounts receivable to non-financial roles violates hospital confidentiality.
- **Resolution**: Financial analytics are strictly gated on the backend by role/permission. If a Doctor, Nurse, or Receptionist requests the executive overview, the `financial` object is strictly returned as `null`. Frontend hides the financial cards automatically based on user permissions.
- **Decision Status**:
  - [x] **Option A (Adopted)**: Strict backend redaction of financial metrics (`financial: null`) for unauthorized roles.
  - [ ] **Option B**: Client-side CSS hiding while transmitting financial values in the JSON response.

---

## 27. Remediation Stage 1 Security Hardening & Zero-Trust Decisions

### 73. Global Guard Registration Order & Zero-Trust Verification
- **Evidence**: Production Readiness Assessment identified that `BranchAccessGuard` was not registered globally, permitting cross-branch data manipulation if controllers omitted local guards.
- **Resolution**: Registered `BranchAccessGuard` globally as an `APP_GUARD` following `ThrottlerGuard` and `JwtAuthGuard`. Decorated endpoints with `@Public()`, `@SkipBranchCheck()`, or `@OptionalBranch()` to permit global utility routes while enforcing zero-trust membership verification on all clinical and financial operations.
- **Decision Status**:
  - [x] **Option A (Adopted)**: Global `APP_GUARD` execution sequence (`ThrottlerGuard` -> `JwtAuthGuard` -> `BranchAccessGuard`).
  - [ ] **Option B**: Manual controller-by-controller decorator maintenance.

### 74. In-Memory Sliding-Window Account Lockout vs. Database Columns
- **Evidence**: Legacy system was vulnerable to brute-force credential stuffing. The audit recommended implementing 5-attempt thresholds with 15-minute lockouts.
- **Resolution**: Created `AccountLockoutService` with an atomic in-memory sliding window tracking IP and identity attempts. This avoids database schema mutations in Stage 1 while providing immediate defense. Expired locks auto-unlock without database writes.
- **Decision Status**:
  - [x] **Option A (Adopted)**: Lightweight sliding-window in-memory tracking with auto-unlock.
  - [ ] **Option B**: Adding `failed_attempts` and `locked_until` columns to `users` table via Prisma migration.

### 75. Single-Use SHA-256 Ephemeral Password Reset
- **Evidence**: Legacy Laravel password reset relied on Laravel's default table, which was discarded in NestJS migration.
- **Resolution**: Implemented `PasswordResetService` issuing 32-byte cryptographically secure random tokens. Only the SHA-256 token hash is retained with a 15-minute TTL. Endpoint returns uniform 200 OK responses to defeat email enumeration. Consuming a token immediately invalidates active refresh token sessions.
- **Decision Status**:
  - [x] **Option A (Adopted)**: Ephemeral SHA-256 token hashing with refresh token family revocation.
  - [ ] **Option B**: Unhashed plaintext tokens or permanent storage in database tables.

### 76. Deferral of Physical Pharmacy Stock Partitioning to Stage 3
- **Evidence**: While clinical, billing, consultation, and appointment entities have been partitioned by branch, physical warehouse inventory versus clinic dispensary stock requires enterprise business rule signoff (central procurement vs. autonomous branch purchasing).
- **Resolution**: Kept schema stable in Stage 1 & 2; full physical inventory branch partitioning and double-entry ledger refactoring are formally scoped and scheduled for Remediation Stage 3.
- **Decision Status**:
  - [x] **Option A (Adopted)**: Enforce access control in Stage 1; complete frontend in Stage 2; refactor multi-warehouse schema and ledger in Stage 3.
  - [ ] **Option B**: Introduce rushed schema migrations without clinical inventory stakeholder signoff.

---

## 28. Remediation Stage 2 Frontend Completion & End-to-End Workflow Integration Decisions

### 77. Unified Frontend Application Shell & Categorized Navigation
- **Evidence**: The initial frontend only had isolated views for prescriptions, pharmacy, lab, radiology, inpatient, cashier, staff, accounting, and settings, lacking primary workspaces for Patients, Doctors, Departments, Appointments, Consultations, and Invoices.
- **Resolution**: Implemented a responsive 4-tier navigation hierarchy (Clinical Operations, Diagnostics & Pharmacy, Inpatient & Billing, Hospital Administration) in `frontend/src/App.tsx`, providing full access to all 18 backend hospital modules with role-based visibility.
- **Decision Status**:
  - [x] **Option A (Adopted)**: 4-category cohesive application shell with collapsible sidebar and branch-aware top bar.
  - [ ] **Option B**: Fragmented standalone SPAs or disparate micro-frontends without shared context.

### 78. Complete Elimination of Hardcoded Record Identifiers
- **Evidence**: Earlier frontend prototypes and mockups contained hardcoded record identifiers (`patientId = '1'`, `doctorId = '1'`) or hardcoded branch IDs, preventing dynamic clinical workflows.
- **Resolution**: Refactored all components to resolve entity IDs dynamically via API lookups, search modals, and cross-module navigation state (`handleBookAppointment`, `handleRaiseInvoice`, `handleStartConsultation`).
- **Decision Status**:
  - [x] **Option A (Adopted)**: Zero hardcoded entity IDs; fully dynamic API-driven selections across all 18 workspaces.
  - [ ] **Option B**: Retain fallback stub IDs when search endpoints are empty.

### 79. End-to-End Synthetic Outpatient Journey Verification
- **Evidence**: Module-level unit and E2E tests verified individual endpoints in isolation, but lacked validation of the continuous patient lifecycle through registration, scheduling, clinical encounter, prescribing, and financial settlement.
- **Resolution**: Authored and passed `backend/test/stage2-workflow.e2e-spec.ts` executing the complete 6-stage lifecycle across PostgreSQL with role transitions and data assertions.
- **Decision Status**:
  - [x] **Option A (Adopted)**: Formal end-to-end integration test suite verifying the unbroken clinical and financial chain.
  - [ ] **Option B**: Rely solely on disparate module-level integration tests.

---

## 29. Remediation Stage 3 Complete Hospital Workflow Integration & System Validation Decisions

### 80. Comprehensive 8-Workflow Multi-Department System Validation Suite
- **Evidence**: Prior stages tested modules independently or tested isolated subsets (such as outpatient-only). A full hospital application requires verifying interconnected journeys across Outpatient, Pharmacy, Laboratory, Radiology, Inpatient, Cashier, General Accounting, and Administration.
- **Resolution**: Implemented `backend/test/stage3-system-validation.e2e-spec.ts` encompassing 34 comprehensive tests covering Workflows A through H and 5 cross-cutting RBAC security checks. All tests run against PostgreSQL with zero mocked databases.
- **Decision Status**:
  - [x] **Option A (Adopted)**: Comprehensive 8-workflow master validation suite covering all 18 hospital modules.
  - [ ] **Option B**: Rely on disparate unit tests without cohesive multi-department workflow tests.

### 81. Bed Sanitation Quarantine Invariant (`CLEANING` State)
- **Evidence**: When patients transfer beds or are discharged, releasing a bed directly to `AVAILABLE` risks admitting a new patient before housekeeping decontaminates the bed.
- **Resolution**: Bed transfers and patient discharges automatically transition the vacated bed to `CLEANING`. It cannot be assigned to another admission until housekeeping explicitly marks it `AVAILABLE`.
- **Decision Status**:
  - [x] **Option A (Adopted)**: Enforce mandatory `CLEANING` quarantine state on bed release and transfers.
  - [ ] **Option B**: Return beds directly to `AVAILABLE`.

### 82. Strict Double-Entry Ledger Immutability & Reversal Protocol
- **Evidence**: Financial accounting integrity requires preventing silent tampering with posted journals while allowing legitimate ledger corrections.
- **Resolution**: Attempting to delete a posted journal returns `403 Forbidden: Immutable Ledger Invariant`. Correcting an entry requires calling `POST /accounting/journals/:id/reverse`, which atomically creates a mirror reversal journal (`POSTED`) and updates the target journal to `REVERSED`.
- **Decision Status**:
  - [x] **Option A (Adopted)**: Strict ledger immutability with signed reversal journals preserving audit history.
  - [ ] **Option B**: Permit direct deletion or in-place modification of posted journals.

### 83. Role-Based Segregation of Duties Across 10 Personas
- **Evidence**: Clinical and financial safety requires that personas cannot perform operations reserved for other departments (e.g. Receptionist dispensing medication, Nurse posting accounting journals, Doctor signing cashier shifts).
- **Resolution**: Enforced zero-trust RBAC at controller and guard levels, validated by automated negative tests confirming `403 Forbidden` for unauthorized roles and `401 Unauthorized` for unauthenticated requests.
- **Decision Status**:
  - [x] **Option A (Adopted)**: Strict granular permission checks per action with explicit 403 rejection.
  - [ ] **Option B**: Permissive role sharing or coarse admin-only gates.

### 84. Project Scope Boundary: System Validation vs Distributed Production Infrastructure
- **Evidence**: Stage 3 instructions specify: *"This is a project-completion and system-validation phase. It is NOT a full production-readiness exercise. Do not implement Kubernetes, advanced disaster recovery, compliance certification or enterprise deployment infrastructure."*
- **Resolution**: Maintained disciplined adherence to project boundaries by validating application and workflow integrity across the full stack while avoiding speculative cloud infrastructure.
- **Decision Status**:
  - [x] **Option A (Adopted)**: System validation and workflow integration on established Docker/PostgreSQL stack.
  - [ ] **Option B**: Premature enterprise cloud or Kubernetes orchestration.

---

## 30. Legacy PHP/Laravel Removal & Codebase Cleanup Decisions

### 85. Pre-Cleanup Offline Archive Verification Protocol
- **Evidence**: Removing historical source code carries catastrophic risk if unmigrated business rules or edge-case logic are accidentally lost.
- **Resolution**: Created a verified, non-destructive offline archive `icthospital-legacy-backup-20261103.zip` (SHA256 `A241A643...`, 29.19MB, 4,433 files) stored outside the repository before initiating any file deletions.
- **Decision Status**:
  - [x] **Option A (Adopted)**: Mandatory verified offline archive creation with checksum and entry count verification.
  - [ ] **Option B**: Immediate deletion without external archive.

### 86. Protected Legacy Artifact Preservation Invariant (`app/Models/SMS.php`)
- **Evidence**: Project safety guidelines mandate that `app/Models/SMS.php` must never be modified, renamed, deleted, overwritten, or staged. Furthermore, on Windows NTFS (case-preserving, case-insensitive), `SMS.php` and `Sms.php` share the same filesystem entry.
- **Resolution**: Retained `app/Models/` containing `SMS.php` in its exact location without staging or modifications. Cleaned up all other models while preserving the container directory to prevent NTFS case collisions.
- **Decision Status**:
  - [x] **Option A (Adopted)**: Strict preservation of `app/Models/SMS.php` in place, leaving `app/Models/` directory intact.
  - [ ] **Option B**: Force-deleting the entire `app/` hierarchy.

### 87. Root Monorepo Structure & Workspace Normalization
- **Evidence**: Legacy root `package.json` contained Laravel Vite plugin dependencies and root `artisan`/`composer.json` caused ambiguity regarding the primary application stack.
- **Resolution**: Purged root Composer manifests and modernized root `package.json` to define an npm monorepo (`workspaces: ["backend", "frontend"]`) with unified build, test, and lint commands.
- **Decision Status**:
  - [x] **Option A (Adopted)**: Standard npm monorepo root manifest linking NestJS and React workspaces.
  - [ ] **Option B**: Leaving obsolete Laravel Vite and Composer manifests at the root.

### 88. Modern Containerization & CI Architecture in `infra/` and `.github/`
- **Evidence**: The root `Dockerfile`, `docker-compose.yml`, and `.github/workflows/ci.yml` were configured for PHP 8.3, Apache/FPM, and MariaDB.
- **Resolution**: Replaced root legacy Docker files with dedicated Medora 2.0 multi-stage Dockerfiles (`infra/backend.Dockerfile`, `infra/frontend.Dockerfile`, `infra/nginx.conf`, `infra/docker-compose.yml`) targeting Node.js 22, Nginx, and PostgreSQL. Replaced `.github/workflows/ci.yml` with a Node.js 22 GitHub Actions CI pipeline.
- **Decision Status**:
  - [x] **Option A (Adopted)**: Clean Node.js 22 / PostgreSQL container deployment and CI pipeline.
  - [ ] **Option B**: Retain legacy PHP Docker containers.

### 89. Complete Decommissioning & Removal of Legacy PHP Codebase and Backup Archive
- **Evidence**: The user explicitly authorized complete removal of all legacy PHP/Laravel code, including `legacy/`, `app/` (with `app/Models/SMS.php`), temporary scratch PHP scripts, and instructed: *"I do not want to retain the old PHP application or a separate PHP backup archive. The historical Laravel application is no longer required."*
- **Resolution**: Completely deleted `legacy/` (2,360 files), removed remaining `app/` folder (including `app/Models/SMS.php`), removed scratch PHP inspection scripts, purged legacy references from `.gitignore`, and deleted the external backup zip `icthospital-legacy-backup-20261103.zip`. Verified that exactly 0 PHP files remain across the entire repository outside third-party `node_modules`.
- **Decision Status**:
  - [x] **Option A (Adopted)**: Complete decommissioning and removal of legacy PHP application, `app/Models/SMS.php`, and backup archive.
  - [ ] **Option B**: Retain legacy PHP folder or external backup archive.
