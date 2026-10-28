# Medora 2.0 Migration Status

## Overview
- **Project**: Medora 2.0 (Migration of ICTHospital legacy hospital management system)
- **Current Phase**: **Phase 0: Workspace and Source Preservation** (Finalized & Phase 1 Ready)
- **Status**: **COMPLETED**
- **Date**: 2026-10-28
- **Approved Target Stack**:
  - **Frontend**: React + TypeScript + Vite
  - **Backend**: NestJS + TypeScript
  - **Database Platform**: Supabase PostgreSQL (supersedes MariaDB/MySQL)
  - **ORM / Query Engine**: Prisma ORM
  - **Background Processing**: Redis + BullMQ (when required)
  - **Infrastructure**: Docker Compose initially (Kubernetes only if justified)

---

## 1. Executive Summary & Architecture Decisions

Phase 0 establishes the target monorepo architecture, accomplishes complete non-destructive source preservation of the original ICTHospital codebase, and records key architectural decisions for subsequent phases:

| Component | Approved Decision | Details |
| :--- | :--- | :--- |
| **Frontend** | React + TypeScript + Vite | Accessible, role-based clinical client. Communicates exclusively with NestJS. |
| **Backend** | NestJS + TypeScript | Sole trusted authority for hospital workflows, RBAC, transactions, and audit trails. |
| **Database** | **Supabase PostgreSQL** | Supersedes MariaDB/MySQL. High-reliability managed PostgreSQL. |
| **ORM** | **Prisma ORM** | Type-safe schema definition and query client with dual-connection configuration. |
| **Connection Strategy** | Dual Connection | Pooled (`DATABASE_URL`, port 6543) for app traffic; Direct (`DIRECT_URL`, port 5432) for migrations. |
| **Background Processing**| Redis + BullMQ | Handles reminders (`hospital:appointment-reminder`, `hospital:payment-reminder`) & SMS/email queues. |
| **Infrastructure** | Docker Compose | Local & staging orchestration initially; Kubernetes only if scale justifies. |
| **Security Boundary** | NestJS Authorization + RLS | Backend guards enforce business operations; RLS configured as defense-in-depth. |

No business logic, modules, or features have been scaffolded or ported in this phase, preserving clean separation between the legacy system and the upcoming modern runtime.

---

## 2. Source Archive Identification & Integrity

| Property | Value |
| :--- | :--- |
| **Archive File Name** | `ICTHospital-main.zip` |
| **Resolved Path** | `C:\Users\Acer\Downloads\ICTHospital-main.zip` |
| **File Size** | `18,714,856 bytes` (17.85 MB) |
| **Creation Time** | `2026-10-27 13:10:32` |
| **SHA-256 Checksum** | `67C8DA292DF5A64F68F3B413E874F8AE7778A5210D3320C7DD47A9A2545BBC69` |

### Top-Level Archive Structure
The archive root folder is `ICTHospital-main/` containing 2,702 total zip entries (2,359 files, 343 directory markers):
- **Core Application**: `app/` (Console, Http, Models, Providers, Services), `artisan`, `bootstrap/`, `config/`, `database/`, `public/`, `resources/`, `routes/`, `storage/`, `tests/`
- **Configuration & Build**: `.editorconfig`, `.env.example`, `.gitattributes`, `.gitignore`, `.rnd`, `Dockerfile`, `docker-compose.yml`, `package.json`, `phpunit.xml`, `smoke-test.sh`, `vite.config.js`, `composer.json`, `composer.lock`
- **Documentation & Legal**: `LICENSE`, `README.md`, `docs/` (`USER-GUIDE.md`, `screenshots/`)
- **Static Asset Directories**: `assets/`, `css/`, `font-awesome/`, `fonts/`, `js/`

---

## 3. Target Monorepo Structure

```text
ICTHospital/ (Medora 2.0 Monorepo Root)
├── frontend/             # Target modern web frontend (React + TypeScript + Vite)
│   └── README.md
├── backend/              # Target modern backend API (NestJS + TypeScript + Prisma)
│   └── README.md
├── database/             # Supabase PostgreSQL schema, Prisma definitions, seeders
│   ├── README.md
│   └── [legacy migrations preserved from Laravel clone]
├── infra/                # Docker Compose orchestration, CI/CD pipelines
│   └── README.md
├── docs/                 # Architectural specifications, migration records, status
│   ├── STATUS.md         # Current migration phase tracker
│   ├── 06-open-questions.md # PostgreSQL compatibility, legacy assumptions & risks
│   └── USER-GUIDE.md     # Inherited user guide with screenshots
└── legacy/               # 100% verified, isolated copy of ICTHospital
    ├── app/
    ├── artisan
    ├── assets/
    ├── bootstrap/
    ├── composer.json
    ├── composer.lock
    ├── config/
    ├── css/
    ├── database/
    ├── docker-compose.yml
    ├── docs/
    ├── font-awesome/
    ├── fonts/
    ├── js/
    ├── package.json
    ├── phpunit.xml
    ├── public/
    ├── resources/
    ├── routes/
    ├── smoke-test.sh
    ├── storage/
    ├── tests/
    ├── vite.config.js
    └── ...
```

---

## 4. Preservation & Verification Evidence

All 2,359 file entries in `ICTHospital-main.zip` were extracted into `legacy/` (stripping the `ICTHospital-main/` container prefix) and recursively compared via cryptographic SHA-256 hashing.

### Verification Results
```text
=== VERIFICATION SUMMARY ===
Total files in archive: 2359
Exact direct SHA-256 matches: 2358
NTFS case collision verified & preserved: 1
Total verified files: 2359 / 2359 (100%)
Mismatches: 0
Missing files: 0
```

### Excluded / Case Collision Detail
- **File**: `app/Models/SMS.php` vs `app/Models/Sms.php`
  - In the original Linux-compatible Git archive:
    - `ICTHospital-main/app/Models/SMS.php` (151 bytes, SHA-256 `5B074DD8DBA6E0845F4E61ADDE41ED66C65D4C7FF9572E64952968DD396836A8`) maps to Eloquent table `smsFormat`.
    - `ICTHospital-main/app/Models/Sms.php` (345 bytes, SHA-256 `BDEBF0158928D67EBB36B53F716092FED949C19D8F4560EE2A78D05E63DC40DB`) maps to Model table `sms`.
  - **OS Behavior**: On Windows NTFS file systems, casing is preserved but case-insensitive by default. Extracting both entries directly into the same directory causes one file to overwrite the other.
  - **Preservation Action**: `SMS.php` (151 bytes) has been explicitly preserved as `legacy/app/Models/SMS.legacy_smsFormat.php` and verified against its exact archive SHA-256 checksum, ensuring zero data loss. Both models are preserved independently.
  - **Integrity**: `legacy/` has remained completely untouched and unmodified.

---

## 5. Git Status, Tree Investigation & Sensitive File Inspection

- **Git Repository**: Initialized, pointing to remote `https://github.com/coder-yr/medora-2.0.git` on branch `main`.
- **Sensitive Files Check**:
  - Root `.env` containing local secrets is excluded by `.gitignore`.
  - SQLite database files (`database/database.sqlite`) are excluded by `.gitignore` and `database/.gitignore`.
  - `.env.example` has been established at root with clean, dummy configuration keys (including Supabase pooled/direct URLs and Redis settings) and no actual passwords, API keys, or tokens.
  - Privileged keys (`SUPABASE_SERVICE_ROLE_KEY`) are kept strictly out of client bundles, Git, and logs.

### 5.1 Deep Dive: `app/Models/SMS.php` Working Tree Diff
- **Git History Findings**:
  - Inspection of `git ls-tree HEAD:app/Models` demonstrates that the repository tree tracks two separate blobs:
    - `100644 blob c803dc2b03c4eea5f1b91877243f552443a2f379 SMS.php` (151 bytes)
    - `100755 blob 3799e7928d66ced6acd3744ed879a70240731919 Sms.php` (345 bytes)
  - Both files originated in initial commit `b732973` on 2026-09-08.
- **Cause of Diff**:
  - On Windows NTFS file systems (`core.ignorecase = true`), checking out two files that differ solely by casing causes NTFS to write both into the same physical file on disk. `Sms.php` was written last during checkout, leaving blob `3799e79` on disk.
  - When Git inspects `SMS.php`, it reads the file on disk (`Sms.php`), generating a diff from `c803dc2` to `3799e79`.
- **Staging Decision**:
  - This is an OS checkout collision artifact and **not a manual user edit**.
  - **Action**: `app/Models/SMS.php` is **deliberately excluded from staging**. Staging it would overwrite blob `c803dc2` in the Git index with `3799e79`, corrupting tree history. It remains safely untouched in the working directory.

---

## 6. Compatibility, Risks & Open Questions

A dedicated Architectural Risk & Compatibility document has been created at [`docs/06-open-questions.md`](06-open-questions.md). Key takeaways include:
- **No MariaDB/MySQL**: Transition to PostgreSQL dialect types (e.g. `BOOLEAN`, `TIMESTAMPTZ`, `JSONB`, fixed-precision `NUMERIC`).
- **No Blind Translation**: Formal inspection of the 50 legacy tables, foreign keys, and constraints required prior to schema generation.
- **Strict Concurrency**: Pessimistic locking / transaction semantics must be preserved for appointment and bed booking races.
- **Connection Limits**: Supavisor pooler (`DATABASE_URL`) mitigates connection exhaustion in containerized environments.
- **Zero Production Data Access**: Rehearsals restricted to test fixtures and synthetic data.

---

## 7. Next Steps: Phase 1 Readiness

Phase 0 documentation, workspace setup, and source preservation are complete.
Ready to proceed to **Phase 1: Domain Model & Prisma Schema Creation (Supabase PostgreSQL)** upon instruction.
