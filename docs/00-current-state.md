# Medora 2.0 — Current-State System Architecture & Baseline Summary

## 1. System Overview & Baseline Architecture
Medora 2.0 represents the enterprise modernization of **ICTHospital**, a comprehensive clinical, diagnostic, hospital management, and billing monolithic application.

This baseline summary establishes the verified current-state architecture, dependencies, inventories, integrations, and operational constraints based on the read-only static audit of `legacy/`.

---

## 2. Verified Technology Stack & Dependencies

### Backend Core
- **Framework**: Laravel 12.61 (Skeleton `laravel/laravel`)
- **PHP Requirement**: `^8.2` (Verified executing under PHP 8.4.27 CLI)
- **Primary Architecture**: Monolithic MVC with domain support services under `app/Support/`
- **Application Routing**: Configured via `bootstrap/app.php` (`withRouting(web, api, commands, health: '/up')`)
- **Authentication**:
  - Web: Session cookie authentication (`users` table, bcrypt hashed passwords)
  - API: Configured for Laravel Passport (`auth:api` via OAuth personal access tokens)
- **Database Engine (Legacy)**: MySQL / MariaDB (relies on MySQLisms such as non-strict grouping and `VARCHAR` casting; tests run on SQLite in-memory)

### Key Composer Dependencies
| Package | Version | Purpose |
| :--- | :--- | :--- |
| `laravel/framework` | `^12.61` | Web application framework core |
| `laravel/passport` | `^13.0` | OAuth2 API authentication guard |
| `barryvdh/laravel-dompdf` | `^3.1` | Server-side PDF generation for invoices, prescriptions & reports |
| `picqer/php-barcode-generator` | `^3.0` | Code-128 barcode generation for patient wristbands & cards |
| `maatwebsite/excel` | `^4.0` | Spreadsheet exports for financial ledgers & day books |
| `nesbot/carbon` | `^3.8` | Date and time manipulation for schedules & appointments |
| `jeremykenedy/laravel-logger` | `^11.0` | HTTP request activity & route audit logging |
| `spatie/laravel-activitylog` | `^4.12` | Model entity mutation tracking |
| `laravellux/html` | `^7.1.6` | Form and HTML builder helpers |

### Frontend & Build Pipeline
- **Template Engine**: Laravel Blade (134 template files)
- **CSS / UI Framework**: Bootstrap 4.1, custom legacy themes (`theme.css`, `teckquiz.css`, `charisma-app.css`)
- **JavaScript Libraries**: jQuery 3.2.1, jQuery UI 1.8.21, DataTables, Select2, Chart.js, Noty, CountUp.js
- **Build Tool**: Vite 5 (`vite.config.js` bundling `resources/css/app.css` and `resources/js/app.js` with `laravel-vite-plugin`)

---

## 3. Reproducible Codebase Inventories

Every count below is verified by static audit scripts and automated inspection against `legacy/`:

| Component Category | Count | Primary Location | Verification Method |
| :--- | :---: | :--- | :--- |
| **Route Declarations** | **251** | `legacy/routes/web.php` (250) + `api.php` (1) | `artisan route:list` / Route parser |
| **Unique URI Endpoints** | **183** | Grouped across 15 domains | Endpoint audit ([`docs/01-endpoint-inventory.md`](01-endpoint-inventory.md)) |
| **Blade Views** | **134** | `legacy/resources/views/` | Directory inspection ([`docs/02-screen-inventory.md`](02-screen-inventory.md)) |
| **Interactive Screens** | **~45** | Consolidated operational flows | Screen categorization ([`docs/02-screen-inventory.md`](02-screen-inventory.md)) |
| **Eloquent Models** | **96** | `legacy/app/Models/` | `Get-ChildItem legacy/app/Models` |
| **Database Migrations** | **111** | `legacy/database/migrations/` | Migration files list |
| **Database Seeders** | **4** | `legacy/database/seeders/` | `DatabaseSeeder`, `DemoDataSeeder`, `FrontDeskDemoSeeder`, `UserTableSeeder` |
| **Hospital Roles** | **7** | `legacy/config/hospital_permissions.php` | `admin`, `doctor`, `nurse`, `accountant`, `receptionist`, `pharmacist`, `laboratorist` |
| **Configured Permissions**| **96** | `legacy/config/hospital_permissions.php` | 96 in catalogue (97 in UI table including legacy menu row) |
| **HTTP Controllers** | **47** | `legacy/app/Http/Controllers/` | Directory inspection |
| **Custom Middleware** | **8** | `legacy/app/Http/Middleware/` | `CheckPermission`, `IsAdmin`, `SuperAdmin`, `TrimStrings`, `TrustProxies`, etc. |
| **Console Commands** | **6** | `legacy/app/Console/Commands/` | `AppointmentReminder`, `PaymentReminder`, `SecureAttachments`, `ModerniseSchema`, etc. |
| **Automated Tests** | **255** | `legacy/tests/` (24 Feature, 2 Unit classes) | `phpunit` execution (**255 tests, 857 assertions, 100% pass**) |

---

## 4. Existing Integrations & Operational Dependencies

1. **ICTCore Gateway (Telephony, SMS & Voice)**:
   - REST API integration via `ICTCoreController` connecting to external ICTCore instances for automated voice notifications and SMS.
   - Manages contact groups, text messages, audio recordings, and campaign dispatch.
2. **Telenor SMS Gateway**:
   - Alternative telecom gateway integration for SMS notifications in Pakistan (`92` country code normalizer).
3. **Telemedicine (Jitsi Meet)**:
   - Configured via `App\Support\Telemedicine` and `config/telemedicine.php`.
   - Generates randomized Jitsi meeting rooms (`icthospital-{random24hex}`) accessible through public or custom Jitsi instances (`meet.jit.si`).
4. **Barcode Generation**:
   - Code-128 barcode rendering for patient medical record (MR) wristbands and identity cards via `Picqer\Barcode\BarcodeGeneratorPNG`.
5. **PDF Document Generation**:
   - Invoices, prescription slips, lab reports, and radiology prints formatted through `barryvdh/laravel-dompdf`.
6. **Payment Gateways**:
   - Database schema exists for multiple third-party payment gateways (`merchant_key`, `salt`, `APIUsername`, `APIPassword`, `APISignature`), though direct card capture was not fully wired in legacy workflows.

---

## 5. Known Legacy Risks & Architectural Gaps

1. **MySQL-Specific Type Coercion & Strictness Issues**:
   - Financial figures (`gross_total`, `amount_received`) and patient IDs are frequently stored as `VARCHAR` in MySQL tables, relying on `CAST(... AS DECIMAL)` and silent string truncation.
   - Non-strict MySQL `GROUP BY` queries that fail under standard SQL / PostgreSQL strict mode.
2. **Hardcoded SuperAdmin Backdoor**:
   - `SuperAdmin.php` enforces a hardcoded check for username `ictkashif`, presenting an authorization anomaly and backdoor risk.
3. **Unprotected Background Job Endpoints**:
   - `/cronjob/payment-reminder` is exposed over public HTTP without authentication, allowing denial-of-wallet and telephony spam attacks.
4. **Plaintext Secret Storage**:
   - Payment gateway credentials and SMS gateway credentials are saved as plain text without encryption.
5. **PHI Attachment Storage Legacy**:
   - Medical history attachments were historically written to `storage/app/public`. Even with `hospital:secure-attachments`, files need strict cloud storage isolation.
6. **Concurrency Vulnerabilities in Unlocked Writes**:
   - While critical sections (appointments, admissions, patient IDs, pharmacy stock, payments) use `lockForUpdate()`, other multi-step workflows lack transactional wrapping.

---

## 6. Areas Requiring Runtime Verification in Phase 2

1. **Prisma Schema Mapping & Field Types**:
   - Verifying that all `VARCHAR` financial fields in legacy MySQL cleanly cast to PostgreSQL `DECIMAL(12, 2)` without rounding discrepancies.
2. **PostgreSQL Timezone Handling**:
   - Ensuring legacy `DATETIME` columns without timezones convert accurately to `TIMESTAMPTZ` in UTC.
3. **Pessimistic Locking Semantics in Prisma**:
   - Validating that concurrent write protection (preventing appointment double-booking and duplicate bed occupancy) achieves identical isolation using Prisma interactive transactions with `SELECT ... FOR UPDATE` or serializable isolation.
4. **BullMQ Worker Reliability**:
   - Verifying that background reminders for appointments and overdue invoices execute with retry backoff and rate-limiting across distributed Redis queues.

---

## 7. Limitations of Static Inspection

- **Dynamic Blade Sub-view Inclusions**: Certain modal dialogs and partials are dynamically referenced via string concatenation in legacy controllers and cannot be proven complete without exercising user paths.
- **Third-Party Telephony Availability**: Real SMS delivery behavior cannot be tested statically without live ICTCore / Telenor API credentials and sandbox telephony links.
- **Database Engine Parity**: The automated test suite executes on SQLite in-memory, masking certain MariaDB/MySQL specific collation, grouping, or lock-escalation quirks. These will be resolved during PostgreSQL schema definition.
