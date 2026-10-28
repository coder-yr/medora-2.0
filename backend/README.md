# Medora 2.0 Backend

## Target Stack
- **Framework**: **NestJS + TypeScript**
- **Database**: **Supabase PostgreSQL**
- **ORM / Query Engine**: **Prisma ORM**
- **Background Processing**: **Redis + BullMQ**

## Architecture & Governance
1. **Trusted Authority**: NestJS serves as the sole trusted boundary for clinical operations, role-based access control (RBAC), hospital permissions, financial transactions, and audit logs.
2. **Dual Database Connection Strategy**:
   - Runtime application traffic routes through Supabase's connection pooler (`DATABASE_URL`).
   - Migration tasks and schema operations utilize the direct connection (`DIRECT_URL`).
3. **Background Jobs**: Asynchronous processing (reminders, notifications, SMS dispatch) is orchestrated via BullMQ queues with Redis backoff and retry management.
4. **Secrets Management**: Privileged credentials (e.g., `SUPABASE_SERVICE_ROLE_KEY`, DB passwords) are kept strictly in backend environment configurations and never exposed to clients.

## Status
- **Phase 0**: Monorepo target directory established; rules documented. Scaffolding deferred to Phase 1.
