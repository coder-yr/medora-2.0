
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





