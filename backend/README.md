# Medora 2.0 — Backend Foundation

## 1. Overview
The Medora 2.0 backend is the sole trusted authority for hospital business logic, clinical records, Role-Based Access Control (RBAC), and financial operations. Built on **NestJS 11**, **Prisma 7**, and **TypeScript (Strict Mode)**, it targets **Supabase PostgreSQL** as its persistence layer.

---

## 2. Architecture & Design Principles

### A. Trusted Security Boundary
- **Zero Frontend Trust**: Frontend navigation state or client-supplied role assertions are never trusted for authorization. Every mutating action and protected resource is strictly validated on the backend via NestJS guards.
- **SEC-01 Remediation**: The legacy hardcoded super-administrator backdoor (`ictkashif` bypass in `SuperAdmin.php`) has been completely eliminated. Administrative access is granted purely through cryptographically verified JWT claims and stored database role permissions.
- **Granular RBAC Primitives**: Enforces the 97 legacy permissions catalogue (from `legacy/config/hospital_permissions.php` and `docs/04-permissions-matrix.md`) via declarative `@RequirePermissions(...)` decorators and `PermissionsGuard`.

### B. Standardized API Protocol & Observability
- **Versioned API Routes**: All functional endpoints are prefixed under `/api/v1` (e.g. `/api/v1/health`, `/api/v1/auth/login`).
- **Request Correlation IDs**: Every inbound request is stamped with a unique correlation ID via `CorrelationIdMiddleware` (header: `x-correlation-id`). If provided by the client (or reverse proxy), it is preserved; otherwise a new `UUIDv4` is assigned.
- **Standardized Response Envelope**:
  ```json
  {
    "success": true,
    "data": { ... },
    "timestamp": "2026-10-28T18:00:00.000Z",
    "correlationId": "8f7a9c1e-4b2d-4e9f-8a1c-3d2e1f0a9b8c"
  }
  ```
- **Consistent Error Sanitization**: Handled by `AllExceptionsFilter`. In production, internal database errors and stack traces are suppressed and replaced with sanitized status payloads.
- **OpenAPI Documentation**: Interactive Swagger documentation is automatically generated at `/api/docs`.

---

## 3. Truthful Health & Readiness Probes

In strict compliance with architectural integrity rules, readiness checks **never falsely report database connectivity if no live connection was tested**:
- **Liveness Probe (`GET /api/v1/health`)**:
  - Unauthenticated (`@Public()`).
  - Returns `200 OK` with service name, version (`2.0.0`), uptime, and memory statistics.
- **Readiness Probe (`GET /api/v1/health/ready`)**:
  - Unauthenticated (`@Public()`).
  - Calls `PrismaService.checkHealth()`, which performs an active round-trip `SELECT 1` ping using `@prisma/adapter-pg`.
  - If PostgreSQL is reachable: returns `200 OK` with `{ status: "ready", checks: { database: { status: "connected", latencyMs: 5 } } }`.
  - If PostgreSQL is unreachable or offline: returns `503 Service Unavailable` with `{ status: "not_ready", checks: { database: { status: "disconnected", message: "Database unreachable: Connection refused" } } }`.

---

## 4. Local Development Without Production Credentials

The backend is fully functional in an offline, zero-credential development and testing mode without requiring connection to production Supabase:

1. **Environment Setup**:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. **Environment Validation**:
   At application bootstrap, `validateEnv()` strictly inspects environment parameters (`NODE_ENV`, `PORT`, `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`). If an invalid variable is supplied, startup aborts with a sanitized error that **never logs secrets or credentials**.

3. **Development Staff Credentials (Offline Simulation)**:
   In `development` or `test` mode, when no live PostgreSQL instance is available, staff authentication can be tested using simulated accounts:
   - **Administrator**: `admin.test@medora.hospital` (Password: `StrongPassword123!`) — Possesses all 97 permissions.
   - **Doctor**: `doctor.test@medora.hospital` (Password: `StrongPassword123!`) — Possesses clinical permissions (`patient_view`, `prescription_add`, etc.).
   - **Receptionist**: `receptionist.test@medora.hospital` (Password: `StrongPassword123!`) — Possesses front-desk permissions (`appointment_add`, `invoice_add`, etc.).

---

## 5. Available Scripts

| Script | Command | Purpose |
| :--- | :--- | :--- |
| **Build** | `npm run build` | Compiles NestJS TypeScript into production bundle (`dist/`) |
| **Development** | `npm run start:dev` | Starts application with hot-reload watch mode |
| **Unit Tests** | `npm test` | Executes Jest test suites across all guards, pipes, filters, and services |
| **E2E Tests** | `npm run test:e2e` | Runs end-to-end HTTP integration tests against NestJS app |
| **Linting** | `npm run lint` | Runs ESLint 9 across all TypeScript files |
| **Formatting** | `npm run format` | Auto-formats code with Prettier |
| **Prisma Validation** | `npm run prisma:validate` | Validates `prisma/schema.prisma` against Prisma 7 CLI |
| **Prisma Generation** | `npm run prisma:generate` | Generates typed `@prisma/client` |

---

## 6. Authentication Identity Provider Boundary

As documented in `docs/06-open-questions.md`:
- **Current Architecture**: NestJS issues and signs its own cryptographically secure JWTs (`JwtService`), extracting permissions and role claims on every request.
- **Supabase Auth Bridge**: `AuthService.validateSupabaseToken()` is prepared to ingest and verify external Supabase Auth tokens if project ownership approves Supabase Auth as the primary IdP.
- **Owner Decision Tracking**: Detailed in `docs/06-open-questions.md` Question 2.
