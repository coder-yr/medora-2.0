# Medora 2.0 Database Architecture

## 1. Approved Database Decision: Supabase PostgreSQL

**Target Database**: **Supabase PostgreSQL**  
**ORM / Query Engine**: **Prisma ORM**  
*(This decision supersedes all previous MariaDB/MySQL requirements.)*

---

## 2. Connection Strategy with Prisma

Supabase utilizes the Supavisor connection pooler. The Prisma configuration will require a dual-connection setup:

1. **Application Traffic (`DATABASE_URL`)**:
   - Routes through the connection pooler on port `6543` in **transaction mode** (`?pgbouncer=true&connection_limit=15`).
   - Prevents connection exhaustion across multiple NestJS worker nodes.
2. **Prisma Migrations & Schema Engine (`DIRECT_URL`)**:
   - Connects directly to the PostgreSQL instance on port `5432`.
   - Required by `prisma migrate` to acquire advisory locks and execute schema modifications.

---

## 3. Database Governance Rules

1. **No MariaDB/MySQL**: MariaDB and MySQL are strictly prohibited for the Medora 2.0 target application.
2. **No Blind Translations**: Migrations will not be created by running automatic syntax converters over Laravel migrations. The 50 legacy tables, foreign keys, constraints, and Eloquent relationships in `legacy/database/` must be analyzed first.
3. **Source-to-Target Mapping**: Every entity must have documented data type mappings, index strategies, and constraint definitions before schema finalization.
4. **NestJS as the Trusted Boundary**:
   - All clinical operations, financial transactions, and sensitive workflows must execute through NestJS.
   - The React frontend is strictly prohibited from bypassing NestJS authorization.
5. **Credential & Key Security**:
   - Supabase `SERVICE_ROLE_KEY` and direct database connection strings must remain exclusively in private backend environment variables.
   - Never commit secrets to Git or expose them in client bundles.
6. **Row-Level Security (RLS)**:
   - Any tables accessible via Supabase Data APIs must have strict RLS policies enabled and tested.
   - RLS serves as defense-in-depth and does not replace NestJS authorization guards.
7. **Production Data Protection**:
   - Never connect to or modify live production clinical data during development or migration rehearsals.
8. **Compatibility Documentation**:
   - All dialect differences, legacy assumptions, and open architectural questions are tracked in [`docs/06-open-questions.md`](../docs/06-open-questions.md).

---

## 4. Status
- **Phase 0**: Approved architecture updated; legacy source preserved in `legacy/database/`.
- **Phase 1 (Upcoming)**: Inspection of legacy Laravel migrations and formal Prisma schema creation.
