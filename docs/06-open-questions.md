
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
