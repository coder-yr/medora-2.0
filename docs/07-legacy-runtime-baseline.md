# Medora 2.0 — Legacy Runtime & Environment Baseline Report

## 1. Executive Summary
This document establishes the verified runtime baseline for the legacy ICTHospital application. It documents the real host environment, available tools, container configuration usability, test execution evidence, route manifest details, safe GET smoke test findings, database dependencies, and environmental limitations.

All checks were executed in a read-only, non-destructive manner using local disposable databases. No production databases or real patient data were accessed.

---

## 2. Environment & Dependency Baseline

### Host Tools & Versions
| Tool / Runtime | Verified Version | Status / Notes |
| :--- | :--- | :--- |
| **PHP CLI** | `8.4.27 (cli)` (NTS Visual C++ 2022 x64) | Active host runtime |
| **Composer** | `2.8.12` | Active package manager |
| **Laravel Framework** | `12.69.2` | Core application framework |
| **PHPUnit** | `11.5.56` | Automated test runner |
| **SQLite** | `3.53.4` | Database driver enabled in PHP CLI (`pdo_sqlite`) |
| **Docker CLI** | `29.5.3` (build `d1c06ef`) | Installed |
| **Docker Compose CLI** | `v5.1.4` | Installed |
| **Docker Engine / Daemon**| **Not Running / Unavailable** | Engine pipe `//./pipe/dockerDesktopLinuxEngine` not found |

### Available PHP Extensions
- **Loaded Modules**: `bcmath`, `calendar`, `Core`, `ctype`, `date`, `dom`, `fileinfo`, `filter`, `gd`, `hash`, `iconv`, `json`, `libxml`, `mbstring`, `mysqlnd`, `openssl`, `pcre`, `PDO`, `pdo_sqlite`, `Phar`, `random`, `readline`, `Reflection`, `session`, `SimpleXML`, `sodium`, `SPL`, `standard`, `tokenizer`, `xml`, `xmlreader`, `xmlwriter`, `zip`, `zlib`.
- **PDO Drivers**: `PDO::getAvailableDrivers()` returned **only `['sqlite']`**.
- **Missing Extensions**: `pdo_mysql` is **not loaded** in the host PHP CLI environment.

### Docker & Container Evaluation
- **Docker Daemon Status**: When executing `docker ps`, the command exited with code `1`:
  ```text
  failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine:
  open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.
  ```
- **Configuration Defect in `docker-compose.yml`**:
  The existing legacy `docker-compose.yml` specifies:
  ```yaml
  app:
    build: .
    volumes:
      - ./src:/app
  ```
  However, `./src` does not exist in the repository (the application resides in `app/`, `legacy/`, etc.). This configuration was copied from another template and is unusable without modification.

---

## 3. Test Suite Baseline Execution

The automated test suite was executed against the in-memory SQLite database configured in `phpunit.xml`.

### Command & Output
- **Command**: `php vendor/bin/phpunit`
- **Exit Code**: `0`
- **Execution Evidence**:
  ```text
  PHPUnit 11.5.56 by Sebastian Bergmann and contributors.

  Runtime:       PHP 8.4.27
  Configuration: F:\yash\projects\full system\ICTHospital\phpunit.xml

  ...............................................................  63 / 255 ( 24%)
  ............................................................... 126 / 255 ( 49%)
  ............................................................... 189 / 255 ( 74%)
  ............................................................... 252 / 255 ( 98%)
  ...                                                             255 / 255 (100%)

  Time: 00:15.409, Memory: 74.00 MB

  OK (255 tests, 857 assertions)
  ```

### Breakdown of Test Results
| Metric | Reported Value | Notes |
| :--- | :---: | :--- |
| **Total Tests Executed** | **255** | 24 Feature test classes, 2 Unit test classes |
| **Total Assertions** | **857** | All assertions passed cleanly |
| **Passed Tests** | **255** | 100% pass rate |
| **Failed Tests** | **0** | No failures |
| **Errors** | **0** | No unexpected exceptions |
| **Skipped Tests** | **0** | None skipped |
| **Risky Tests** | **0** | None marked risky |

### Test Environment Prerequisites
- Test database: SQLite in-memory (`:memory:`)
- Session driver: `array`
- Cache driver: `array`
- Queue driver: `sync`
- Mail driver: `array`
- Bcrypt rounds: `4` (for rapid hashing during tests)

---

## 4. Route & Runtime Evidence

### Runtime Route Manifest
Queried directly from Laravel's registered route collection:
- **Total Registered Routes**: **271**
- **HTTP Methods Breakdown**:
  - `GET`: 136 routes
  - `POST`: 88 routes
  - `DELETE`: 29 routes
  - `PUT`: 18 routes

### Safe Parameterless GET Smoke-Test Results
89 safe, non-state-changing, parameterless GET routes were evaluated using Laravel's internal HTTP request kernel (strictly excluding `/cronjob/payment-reminder`, parameterized endpoints, and mutation routes).

#### 1. Unauthenticated Smoke Test (Guest Session)
- **HTTP 200 (OK)**: 4 endpoints (Public landing `/`, health check `/up`, 2FA `/verification_code`, `/verify_code`).
- **HTTP 302 (Redirect)**: 83 endpoints (Correctly redirected unauthenticated guests to login `/`).
- **HTTP 500 (Server Error)**: 2 endpoints (`/oauth/device`, `/oauth/device/authorize` — OAuth device flow triggered without required query parameters).

#### 2. Authenticated Smoke Test (Administrator Session - User ID 1)
- **HTTP 200 (OK)**: **83 endpoints** — All administrative, clinical, and financial screens render successfully:
  - Clinical & Wards: `/admissions`, `/admissions/create`, `/appointments`, `/appointments/create`, `/beds`, `/beds/categories`, `/consultations`, `/prescriptions`, `/lab`, `/radiology`
  - Financial & Billing: `/accounting`, `/accounting/expence`, `/accounting/income`, `/accounting/report`, `/cash/close`, `/pricing`, `/invoices`
  - Administrative & RBAC: `/users`, `/branches`, `/permission`, `/gateways`, `/services`, `/medicines`, `/staff`
  - Activity Logs: `/activity`, `/activity/cleared`, `/activity/export`
- **HTTP 302 (Redirect)**: 3 endpoints (e.g. `/` redirecting authenticated users to `/dashboard`).
- **HTTP 500 (Server Error)**: 3 endpoints (`/oauth/authorize`, `/oauth/device`, `/oauth/device/authorize` — Passport OAuth authorization endpoints requiring client ID and redirect URI parameters).

---

## 5. Database Safety & Parity Evaluation

### Local SQLite Database (`database/database.sqlite`)
- **Status**: Local disposable file.
- **SQLite Version**: `3.53.4`
- **Total Tables**: **104 tables**
- **Executed Migrations**: **113 migrations** (all applied in batch 1)
- **Seeded Accounts**: 2 default test users (`admin`, `doctor`)

### Discrepancies Between SQLite and Target MariaDB/PostgreSQL
1. **Missing MySQL Driver**:
   Because `pdo_mysql` is missing from the host PHP CLI and Docker is not running, live verification against MariaDB/MySQL could not be executed locally.
2. **Dialect Differences**:
   - SQLite evaluates loose column typing and does not enforce MySQL string truncation or strict SQL `GROUP BY` validations.
   - SQLite in-memory tests verify business logic flows but do not prove PostgreSQL compatibility.
3. **Target Compatibility**:
   Medora 2.0 targets **Supabase PostgreSQL** via **Prisma ORM**. The MariaDB-specific queries discovered in Phase 1 (e.g. `CAST(patient_id AS UNSIGNED)`, non-strict `GROUP BY`) must be cleanly re-implemented in Prisma rather than translated 1:1.

---

## 6. Verification of Workspace Integrity
- **`legacy/` Directory**: 100% verified unmodified and clean.
- **Unstaged Working Tree**: `app/Models/SMS.php` remains preserved, untouched, and unstaged.
- **Git Commit Baseline**: `a646a86` (Phase 0) and `86b9bc1` (Phase 1) remain intact in history.
