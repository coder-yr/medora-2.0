# Medora 2.0

> **Enterprise Healthcare & Hospital Management Platform Monorepo**  
> Modernized architecture evolved from ICTHospital.

---

## 1. Migration Goal & Target Stack

**Medora 2.0** transitions the monolithic PHP/Laravel clinical application into an enterprise-grade, modular monorepo featuring:

- **Frontend (`frontend/`)**: Modern **React + TypeScript + Vite** client delivering an accessible clinical user experience.
- **Backend (`backend/`)**: Modular **NestJS + TypeScript** service enforcing domain-driven design, clinical permissions, and financial audit trails.
- **Database (`database/`)**: **Supabase PostgreSQL** managed via **Prisma ORM** (superseding earlier MariaDB/MySQL specifications). Uses pooled connections (`DATABASE_URL`) for traffic and direct connections (`DIRECT_URL`) for migrations.
- **Background Processing**: **Redis + BullMQ** for scheduled jobs, SMS/email reminders, and asynchronous queues.
- **Infrastructure (`infra/`)**: Containerized workflows with Docker Compose initially (Kubernetes only if justified).
- **Documentation (`docs/`)**: Comprehensive migration specifications, audit records, and open questions tracker ([`docs/06-open-questions.md`](docs/06-open-questions.md)).
- **Legacy Preservation (`legacy/`)**: Pristine, isolated archive of the original ICTHospital codebase for behavioral reference and schema parity.

---

## 2. Monorepo Repository Structure

```text
.
├── frontend/             # Modern client applications (React + TypeScript + Vite)
├── backend/              # Modular enterprise API (NestJS + TypeScript + Prisma)
├── database/             # Supabase PostgreSQL migrations, Prisma schemas, seed datasets
├── infra/                # Docker Compose, orchestration, CI/CD, proxy configurations
├── docs/                 # Project documentation, status logs, specifications
│   ├── STATUS.md         # Migration phase progress and verification evidence
│   ├── 06-open-questions.md # PostgreSQL compatibility, legacy assumptions & risks
│   └── USER-GUIDE.md     # Reference screenshots and clinical user workflows
└── legacy/               # 100% verified, isolated copy of ICTHospital (Laravel 12)
    ├── app/
    ├── config/
    ├── database/
    ├── resources/
    ├── routes/
    └── ...
```

---

## 3. Security & Governance Rules

1. **Trusted Authority**: The NestJS backend is the sole trusted boundary for all clinical and financial operations. The React frontend never bypasses backend authorization.
2. **Credential Isolation**: Database connection strings, passwords, and the Supabase `SERVICE_ROLE_KEY` must never be exposed to the frontend, logged, or checked into Git.
3. **No Blind Translation**: Migrations are mapped systematically from the legacy Laravel models rather than automated code conversion.
4. **Data Protection**: Development and rehearsals are strictly isolated from production patient data.

---

## 4. Current Status

| Phase | Description | Status |
| :--- | :--- | :--- |
| **Phase 0** | **Workspace and Source Preservation (Supabase PostgreSQL Update)** | **COMPLETED** |
| **Phase 1** | Domain Model & NestJS Core Services (Prisma + Supabase) | Pending |
| **Phase 2** | Modern Clinical Frontend Development (React + Vite) | Pending |
| **Phase 3** | Data Migration & Dual-Run Validation | Pending |
| **Phase 4** | Production Deployment & Decommissioning | Pending |

Detailed verification hashes, integrity logs, and phase documentation are maintained in [`docs/STATUS.md`](docs/STATUS.md) and [`docs/06-open-questions.md`](docs/06-open-questions.md).

---

## 5. Development & Environment Setup

1. **Environment Variables**:
   Copy the master example configuration:
   ```bash
   cp .env.example .env
   ```
2. **Review Status & Guidelines**:
   Check [`docs/STATUS.md`](docs/STATUS.md) and [`docs/06-open-questions.md`](docs/06-open-questions.md) prior to beginning subsequent phases.
