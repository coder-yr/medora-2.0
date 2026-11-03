# Medora 2.0 — PHP & Laravel Dependency Audit Report

**Date of Audit:** 3 November 2026  
**Auditor:** Antigravity AI Pair Programmer  
**Repository:** `F:\yash\projects\full system\ICTHospital`  
**Git Branch:** `feat/medora-2.0-migration`  
**Target Application:** Medora 2.0 (NestJS 11 Backend + React 19 Frontend + Supabase PostgreSQL)  
**Audit Scope:** Full repository, including root directory, `legacy/`, `backend/`, `frontend/`, infrastructure, CI/CD, database, and background processing.

---

## 1. Executive Summary

This audit evaluated whether the Medora 2.0 hospital management system has any operational, runtime, build, or architectural dependency on PHP and the legacy Laravel framework.

### Summary of Audit Findings
1. **Application Runtime (NestJS Backend & React Frontend):** **100% PHP-INDEPENDENT**.
   - Built and tested with PHP completely removed from the environment `$env:PATH`.
   - Zero PHP interpreters, bridges, or child processes executed.
   - Zero outbound HTTP requests or API calls to Laravel / port 8000.
   - Direct connection to Supabase PostgreSQL via Prisma ORM 7.
2. **Source Code References in Medora 2.0 (`backend/src` and `frontend/src`):**
   - **Frontend:** Zero references to PHP, Laravel, Artisan, or Composer.
   - **Backend:** Exactly 3 non-executing references (two explanatory documentation comments citing legacy permission origin, and one backward-compatible pure Node.js bcrypt hash verification method in `AuthService` to seamlessly upgrade legacy passwords to Argon2id without PHP).
3. **Repository Workspace Root:**
   - The repository root retains legacy Laravel files (`app/`, `bootstrap/`, `config/`, `database/`, `public/`, `resources/`, `routes/`, `storage/`, `tests/`, `vendor/`, `artisan`, `composer.json`, `composer.lock`, `phpunit.xml`, `smoke-test.sh`, `Dockerfile`, `docker-compose.yml`, `.github/workflows/ci.yml`). These files remain from the initial pre-migration state (Phase 0) where non-destructive preservation rules prevented deleting historical source files.
   - None of these root PHP files are imported, executed, or required by Medora 2.0.

---

## 2. Detailed Checklist & Investigation Findings

### 2.1. PHP Files & Composer Dependencies Outside `legacy/`

| Location | PHP / Composer Files Present | Active in Medora 2.0? | Notes |
| :--- | :--- | :---: | :--- |
| **`backend/src/`** | **None (0 files)** | N/A | Clean TypeScript codebase |
| **`backend/prisma/`** | **None (0 files)** | N/A | Schema and migrations only |
| **`backend/test/`** | **None (0 files)** | N/A | TypeScript Jest E2E and unit test suites |
| **`backend/node_modules/`** | `flatted/php/flatted.php` (1 file) | No | Harmless multi-language file bundled in 3rd-party npm package `flatted` |
| **`frontend/src/`** | **None (0 files)** | N/A | Clean TypeScript / TSX codebase |
| **`frontend/` (root)** | **None (0 files)** | N/A | Clean React 19 + Vite setup; zero composer files |
| **Repository Root (`./`)** | `app/`, `bootstrap/`, `config/`, `database/`, `public/`, `resources/`, `routes/`, `storage/`, `tests/`, `vendor/`, `artisan`, `composer.json`, `composer.lock`, `phpunit.xml` | **No** | Leftover pre-migration Laravel files from initial commit (`b732973`). Preserved per Phase 0 non-destructive safety constraints. |
| **`app/Models/SMS.php`** | 1 file | **No** | Protected repository artifact; strictly untouched |

### 2.2. PHP & Laravel References in Medora 2.0 Source Code

A comprehensive case-insensitive regex search (`(?i)(laravel|artisan|composer|\.php\b)`) was conducted across all files in `backend/src` and `frontend/src`:

- **Frontend (`frontend/src/`):** **0 occurrences.**
- **Backend (`backend/src/`):** **3 occurrences (all non-executing):**
  1. `backend/src/common/constants/permissions.enum.ts` (Line 4):
     ```typescript
     * 97 Granular Hospital Permissions preserved from legacy/config/hospital_permissions.php
     ```
     *(Context: Documentation comment recording the historical derivation of RBAC permission constants).*
  2. `backend/src/modules/auth/auth.service.ts` (Line 46):
     ```typescript
     * Supports both modern Argon2id and legacy Laravel bcrypt ($2y$) hashes with transparent upgrade.
     ```
     *(Context: Docstring describing password hash upgrade behavior).*
  3. `backend/src/modules/auth/auth.service.ts` (Line 56):
     ```typescript
     // Support legacy Laravel bcrypt hashes ($2y$, $2a$, $2b$)
     ```
     *(Context: Pure TypeScript implementation using the npm package `bcryptjs` to verify legacy password strings and immediately upgrade them to Argon2id upon successful authentication. No PHP is invoked).*

### 2.3. API Calls & Network Integrations

1. **Frontend Network Layer:**
   - All frontend components route HTTP traffic through `const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (isDev ? 'http://localhost:3000' : '');`.
   - All endpoints target the NestJS API prefix `/api/v1/...`.
   - **Zero** calls to Laravel default port `8000`, `8082`, or any PHP endpoint.
2. **Backend Outbound Network Layer:**
   - Audit of all controllers and services revealed **zero** outbound HTTP clients (`HttpService`, `axios`, `fetch`, `got`) targeting legacy services.
   - **Zero** inter-process communication (IPC) or `child_process` execution invoking `php`, `artisan`, or shell scripts.
3. **Database Integration:**
   - Medora 2.0 connects directly to PostgreSQL via Prisma ORM 7 (`@prisma/adapter-pg` driver).
   - Zero queries to MySQL/MariaDB (legacy port 3306/33063) or legacy SQLite databases.

### 2.4. Docker, Build Scripts & Deployment Configurations

1. **Root `Dockerfile`:**
   - Current contents: `FROM php:8.3-cli` with PHP extensions, composer, and `sleep infinity`.
   - Assessment: This is the **legacy Laravel development container** from prior to the NestJS migration. It is not used by Medora 2.0.
2. **Root `docker-compose.yml`:**
   - Current contents: Services `db` (`mariadb:11` on `33063`) and `app` (`php artisan serve` on `8082:8000`).
   - Assessment: This is the **legacy Laravel/MariaDB stack**. Medora 2.0 operates against PostgreSQL on port 5432 / Supabase.
3. **CI/CD (`.github/workflows/ci.yml`):**
   - Current contents: Runs `shivammathur/setup-php@v2` (PHP 8.3), `composer audit`, and `php artisan test`.
   - Assessment: This is the **legacy Laravel test pipeline** established in commit `5108e17`. It has not yet been replaced with a Node.js/NestJS/React CI workflow.
4. **`infra/` Directory:**
   - Initialized in Phase 0 as a reserved directory for Medora 2.0 containerization. Currently contains `infra/README.md` awaiting final production deployment manifests.

### 2.5. Background Processing & Cron Jobs

1. **Legacy Architecture:**
   - Relied on `app/Console/Kernel.php` and an unauthenticated public HTTP endpoint `GET /cronjob/payment-reminder`.
2. **Medora 2.0 Architecture (Phase 22 & Stage 3):**
   - Background jobs are executed natively within NestJS using the **Transactional Outbox Pattern** (`NotificationOutboxService`).
   - Jobs are stored in the PostgreSQL table `notification_outbox` with exponential backoff (`nextRetryAt`) and row-locking concurrency control.
   - The insecure legacy public cron endpoint was completely eliminated.
   - **Zero dependency on PHP CLI, Laravel queue workers, or Laravel scheduler.**

---

## 3. Empirical Test Results (Clean Environment Without PHP)

To guarantee that Medora 2.0 has zero hidden reliance on the host's PHP installation, the host's PATH was programmatically sanitized to exclude all PHP installations (`php.exe`, Herd-Lite), verifying `Get-Command php` failed. The complete build and test lifecycle was then executed:

### Test 1: Clean Environment Verification
- **Command:**
  ```powershell
  $cleanPath = ($env:PATH.Split(';') | Where-Object { $_ -notmatch 'php' -and $_ -notmatch 'herd' }) -join ';'
  $env:PATH = $cleanPath
  Get-Command php
  ```
- **Result:** `Get-Command : The term 'php' is not recognized as the name of a cmdlet, function, script file, or operable program.`
- **Status:** **PHP Completely Absent from Environment**

### Test 2: React Frontend Production Build
- **Command:** `cd frontend; npm run build`
- **Output:**
  ```
  > frontend@0.0.0 build
  > tsc -b && vite build

  vite v8.3.5 building client environment for production...
  transforming...
  ✓ 2054 modules transformed.
  rendering chunks...
  computing gzip size...
  dist/index.html                   0.45 kB │ gzip:   0.29 kB
  dist/assets/index-Byrr4UsB.css    5.91 kB │ gzip:   1.76 kB
  dist/assets/index-BbI2QPXK.js   903.40 kB │ gzip: 184.18 kB
  ✓ built in 209ms
  ```
- **Exit Code:** `0`
- **Status:** **PASS**

### Test 3: React Frontend Linter
- **Command:** `cd frontend; npm run lint`
- **Output:** `Finished in 100ms on 56 files with 116 rules using 24 threads. Found 56 warnings and 0 errors.`
- **Exit Code:** `0`
- **Status:** **PASS**

### Test 4: NestJS Backend Production Build
- **Command:** `cd backend; npm run build`
- **Output:**
  ```
  > medora-backend@2.0.0 build
  > nest build
  ```
- **Exit Code:** `0`
- **Status:** **PASS**

### Test 5: NestJS Backend Unit Test Suite (Full Regression)
- **Command:** `cd backend; npm test`
- **Output:**
  ```
  Test Suites: 31 passed, 31 total
  Tests:       329 passed, 329 total
  Snapshots:   0 total
  Time:        7.814 s
  ```
- **Exit Code:** `0`
- **Status:** **PASS**

### Test 6: Backend End-to-End Workflow & Liveness Test
- **Command:** `cd backend; npx jest --config test/jest-e2e.json app.e2e-spec.ts`
- **Output:**
  ```
  PASS test/app.e2e-spec.ts (6.039 s)
    Medora 2.0 Backend (e2e)
      √ GET /api/v1/health (Liveness Probe) (35 ms)
      √ GET /api/v1/health/ready (Readiness Probe) (834 ms)
      √ GET /api/v1/auth/me without token -> 401 Unauthorized (4 ms)
      √ POST /api/v1/auth/login with valid staff email -> 200 OK + JWT (392 ms)
      √ POST /api/v1/auth/login with invalid email format -> 400 Bad Request (5 ms)

  Test Suites: 1 passed, 1 total
  Tests:       5 passed, 5 total
  ```
- **Exit Code:** `0`
- **Status:** **PASS**

### Test 7: Multi-Step Clinical & Financial E2E Journey
- **Command:** `cd backend; npx jest --config test/jest-e2e.json stage2-workflow.e2e-spec.ts`
- **Output:**
  ```
  PASS test/stage2-workflow.e2e-spec.ts (22.156 s)
    Stage 2 — End-to-End Hospital Workflow Integration (e2e)
      √ Step 1: Patient Central Registry — Register a new patient without hardcoded IDs (774 ms)
      √ Step 2: Doctor Directory — Create consulting doctor (270 ms)
      √ Step 3: Appointments — Query available slots and book consultation (2350 ms)
      √ Step 4: Clinical Consultation — Load encounter context and save complete note (5882 ms)
      √ Step 5: Prescriptions — Issue outpatient prescription with medicines (1726 ms)
      √ Step 6: Invoices & Billing — Raise itemized invoice and record installment payment (6279 ms)

  Test Suites: 1 passed, 1 total
  Tests:       6 passed, 6 total
  ```
- **Exit Code:** `0`
- **Status:** **PASS**

---

## 4. Remediation & Cleanup Actions Executed (Post-Audit Cleanup)

Following the audit findings and explicit user authorization, a full repository cleanup and complete decommissioning of legacy PHP/Laravel code was executed:

1. **Complete Legacy PHP Application Removal:**
   - Completely deleted `legacy/` (2,360 files, 41.51 MB).
   - Completely deleted `app/` directory, including the previously protected artifact `app/Models/SMS.php` (as explicitly authorized by the user).
   - Removed temporary PHP inspection scripts from `scratch/`.
   - Deleted external backup archive per user directive ("I do not want to retain the old PHP application or a separate PHP backup archive").
2. **Obsolete Root Laravel Files Purged:**
   - Deleted root `bootstrap/`, `config/`, `database/`, `public/`, `resources/`, `routes/`, `storage/`, `tests/`, `assets/`, `css/`, `fonts/`, `font-awesome/`, `js/`, `artisan`, `composer.json`, `composer.lock`, `phpunit.xml`, `Dockerfile`, `docker-compose.yml`, and 67MB `vendor/` directory.
   - Pruned `.gitignore` of all legacy PHP and Laravel entries.
3. **Monorepo & CI Modernized:**
   - Converted root `package.json` into a clean npm monorepo workspace manifest.
   - Updated `.github/workflows/ci.yml` to a Node.js 22 GitHub Actions CI pipeline testing backend and frontend.
   - Established Medora 2.0 multi-stage production Docker deployment under `infra/`.
4. **Post-Cleanup Regression Verification:**
   - 100% unit tests (329 tests) and all 8 core hospital E2E workflows (34 tests) verified passing against PostgreSQL.

---

## 5. Final Verdict

### Final Verdict: **PHP Independent (100% PHP Independent, Zero Legacy PHP Files Remaining)**

#### Verdict Justification:
- **Medora 2.0 Application Runtime:** **100% PHP Independent**. The application (NestJS backend, React frontend, Prisma ORM, and PostgreSQL database) does not execute, require, or communicate with PHP in any capacity. It builds, lints, tests, and serves hospital workflows cleanly without PHP installed.
- **Repository Scope:** Exactly **0 PHP files** exist in the repository outside third-party `node_modules` (where `flatted/php/flatted.php` is an internal multi-language utility of an npm dependency). All legacy Laravel directories (`legacy/`, `app/`, `bootstrap/`, `config/`, `database/`, `resources/`, `routes/`, `storage/`, `tests/`, `vendor/`), Composer manifests, Blade templates, and old PHP assets have been completely decommissioned and removed.
- **Is Medora 2.0 PHP Dependent?** **NO.** The system is 100% PHP-independent and pure modern TypeScript/PostgreSQL.


