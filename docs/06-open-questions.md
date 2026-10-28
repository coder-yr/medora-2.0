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
