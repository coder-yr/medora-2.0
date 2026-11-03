# Medora 2.0

> **Enterprise Healthcare & Hospital Management Platform Monorepo**  
> Modernized architecture evolved from ICTHospital.

---

## 1. Architecture Overview

**Medora 2.0** is an enterprise-grade hospital management system operating as a clean, modular TypeScript monorepo with complete independence from PHP:

- **Frontend (`frontend/`)**: Modern **React 19 + TypeScript + Vite + Tailwind CSS** client delivering an accessible clinical user experience across 18 hospital domains.
- **Backend (`backend/`)**: Modular **NestJS 11 + TypeScript** service enforcing zero-trust multi-branch authorization, domain-driven design, clinical permissions, and financial audit trails.
- **Database (`backend/prisma/`)**: **PostgreSQL 16+ / Supabase** managed via **Prisma ORM 7** with pooled and direct connection support.
- **Background Processing (`backend/src/modules/notification/`)**: Native **Transactional Outbox Pattern** with exponential backoff and PostgreSQL concurrency row locks.
- **Infrastructure (`infra/`)**: Containerized production workflows with multi-stage Dockerfiles and Docker Compose.
- **Documentation (`docs/`)**: Comprehensive migration specifications, audit records, workflow validations, and system runbooks.
- **Legacy Reference Archive (`legacy/`)**: Pristine, isolated reference archive of the historical ICTHospital PHP application for behavioral reference and audit trail.

---

## 2. Monorepo Structure

```text
.
├── frontend/             # React 19 + TypeScript + Vite clinical application
├── backend/              # NestJS 11 + Prisma ORM 7 enterprise hospital API
│   └── prisma/           # PostgreSQL schema, migrations, and seeds
├── infra/                # Production Docker Compose, Dockerfiles, and Nginx configs
├── docs/                 # System architecture, audit records, and runbooks
│   ├── STATUS.md         # Full project migration status and verification history
│   ├── 06-open-questions.md # Architecture decisions & open questions log
│   └── stage-3-system-validation.md # Full-stack workflow verification report
├── app/Models/SMS.php    # Protected historical artifact preserved in place
└── legacy/               # Isolated historical reference archive (Laravel 12)
```

---

## 3. Quick Start

### Prerequisites
- Node.js 22 LTS or higher
- PostgreSQL 16+ (or Docker)
- npm 10+

### Development Setup

1. **Install Dependencies:**
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```

2. **Database Setup:**
   ```bash
   cd backend
   npx prisma generate
   ```

3. **Start Services:**
   - **Backend API (Port 3000):**
     ```bash
     cd backend && npm run start:dev
     ```
   - **Frontend Web Client (Port 5173):**
     ```bash
     cd frontend && npm run dev
     ```

### Production Container Deployment

```bash
docker compose -f infra/docker-compose.yml up --build
```

---

## 4. Verification & Testing

- **Backend Unit Tests:** `cd backend && npm test` (31 test suites, 329 tests)
- **Backend E2E Validation:** `cd backend && npx jest --config test/jest-e2e.json test/stage3-system-validation.e2e-spec.ts` (34 tests)
- **Frontend Linter:** `cd frontend && npm run lint` (0 errors)
- **Frontend Production Build:** `cd frontend && npm run build` (Clean build in ~200ms)

---

## 5. Security & Governance Rules

1. **Trusted Authority**: The NestJS backend is the sole trusted boundary for all clinical and financial operations.
2. **Zero-Trust Multi-Branch Isolation**: All operations enforce strict branch access boundaries through `BranchAccessGuard` and `BranchAuthorizationService`.
3. **Ledger Immutability**: Posted accounting journals are immutable; corrections require signed reversal entries.
4. **Credential Isolation**: Database credentials, passwords, and secrets are managed via environment variables and never exposed to the frontend or checked into version control.
