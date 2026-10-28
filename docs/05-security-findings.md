# Medora 2.0 — Legacy Security Audit & Findings

## 1. Executive Summary
This document records the security findings identified during the read-only static audit of the legacy ICTHospital codebase (`legacy/`). Each finding includes verified source code references, confidence level, severity rating, potential impact, and concrete remediation requirements for the target Medora 2.0 architecture (NestJS + Supabase PostgreSQL + React).

No destructive tests or active exploits were executed. Secret values are masked or referenced by location only.

---

## 2. Summary of Findings

| ID | Title | Severity | Confidence | Category | Affected File(s) |
| :--- | :--- | :---: | :---: | :--- | :--- |
| **SEC-01** | Hardcoded SuperAdmin Backdoor Bypass | **CRITICAL** | High | Authorization / Backdoor | `legacy/app/Http/Middleware/SuperAdmin.php:18-21` |
| **SEC-02** | Unauthenticated Public Endpoint for Scheduled Payment Reminders | **HIGH** | High | Broken Access Control / DoS | `legacy/routes/web.php:301`<br>`legacy/app/Http/Controllers/CronjobController.php:41-48` |
| **SEC-03** | Plaintext Storage of Payment Gateway API Secrets | **HIGH** | High | Cryptographic Failure | `legacy/app/Models/PaymentGateway.php:15-25`<br>`legacy/app/Http/Controllers/PaymentGatewayController.php:31, 59-67` |
| **SEC-04** | Historical Medical Attachments (PHI) Stored on Public Disk | **HIGH** | High | Information Disclosure / PHI | `legacy/app/Console/Commands/SecureAttachments.php:5-7`<br>`legacy/app/Http/Controllers/MedicalHistoryController.php:154-169` |
| **SEC-05** | Plaintext Credentials Stored for SMS/Telecom Gateways | **MEDIUM** | High | Sensitive Data Handling | `legacy/app/Http/Controllers/ICTCoreController.php:39`<br>`legacy/database/migrations/2016_07_05_050630_create_ictcore_integration_table.php` |
| **SEC-06** | Insecure cURL Calls & Unsanitized XML Parsing in Gateway Client | **MEDIUM** | High | Transport Security / XXE | `legacy/app/Http/Controllers/ICTCoreController.php:885-924, 1051-1075` |
| **SEC-07** | Predictable Default Admin Password in Seeder | **MEDIUM** | High | Authentication | `legacy/database/seeders/UserTableSeeder.php:51-62` |
| **SEC-08** | Discrepancy Between Navigation UI Gating and Route Authorization | **MEDIUM** | High | Authorization (RBAC) | `legacy/config/hospital_permissions.php:40-70`<br>`legacy/routes/web.php:515-527` |
| **SEC-09** | String-Based Storage for Financial Data & Implicit Type Coercion | **LOW** | High | Data Integrity | `legacy/app/Http/Controllers/CronjobController.php:157-172`<br>`legacy/database/migrations/` |

---

## 3. Detailed Security Findings

### SEC-01: Hardcoded SuperAdmin Backdoor Bypass
- **Severity**: **CRITICAL**
- **Confidence**: **High** (Verified from source code)
- **Source Reference**: [`legacy/app/Http/Middleware/SuperAdmin.php:18-21`](../legacy/app/Http/Middleware/SuperAdmin.php#L18-L21)
- **Evidence**:
  ```php
  public function handle($request, Closure $next)
  {
      if (Auth::user() && Auth::user()->group == 'Admin' && Auth::user()->login == 'ictkashif') {
          return $next($request);
      }

      return redirect('page-not-found');
  }
  ```
- **Potential Impact**:
  Administrative access control is hardcoded to a specific username (`ictkashif`). If an attacker creates or renames a user account with login `ictkashif` under the `Admin` group, they gain super-administrative bypass capabilities. Conversely, legitimate hospital administrators not possessing this exact username are locked out of any routes protected by `super_admin`.
- **Recommended Remediation (Medora 2.0)**:
  - Eliminate all hardcoded username or personal identifier checks across the entire codebase.
  - Implement role-based access control (RBAC) in NestJS using declarative guards (`@Roles(Role.ADMIN)`) checking cryptographically signed JWT claims verified against Supabase PostgreSQL role assignments.

---

### SEC-02: Unauthenticated Public Endpoint for Scheduled Payment Reminders
- **Severity**: **HIGH**
- **Confidence**: **High** (Verified from source code)
- **Source Reference**:
  - [`legacy/routes/web.php:301`](../legacy/routes/web.php#L301)
  - [`legacy/app/Http/Controllers/CronjobController.php:41-48`](../legacy/app/Http/Controllers/CronjobController.php#L41-L48)
- **Evidence**:
  ```php
  // legacy/routes/web.php
  Route::get('/cronjob/payment-reminder', [CronjobController::class, 'paymentReminder']);
  ```
  The route is declared entirely outside the `auth` middleware group without any API key, IP whitelist, or rate limiting.
- **Potential Impact**:
  Any unauthenticated external actor can issue continuous HTTP GET requests to `/cronjob/payment-reminder`. This triggers batch queries against patient billing tables, initiates SMS reminder dispatches through external gateways (e.g. ICTCore / Telenor), leaks recipient counts and execution logs in JSON responses, and can cause financial loss via SMS gateway credit exhaustion or denial-of-service (telephony spamming to patients).
- **Recommended Remediation (Medora 2.0)**:
  - Never expose scheduled background maintenance or reminder jobs as public HTTP routes.
  - In Medora 2.0, migrate scheduled jobs (`hospital:appointment-reminder`, `hospital:payment-reminder`) to **BullMQ** running on **Redis**, orchestrated by NestJS worker modules (`@nestjs/bullmq` / `@nestjs/schedule`).

---

### SEC-03: Plaintext Storage of Payment Gateway API Secrets
- **Severity**: **HIGH**
- **Confidence**: **High** (Verified from source code)
- **Source Reference**:
  - [`legacy/app/Models/PaymentGateway.php:15-25`](../legacy/app/Models/PaymentGateway.php#L15-L25)
  - [`legacy/app/Http/Controllers/PaymentGatewayController.php:31, 59-67`](../legacy/app/Http/Controllers/PaymentGatewayController.php#L31)
- **Evidence**:
  The `PaymentGateway` model defines `$fillable` with sensitive fields (`merchant_key`, `salt`, `APIUsername`, `APIPassword`, `APISignature`) without any Eloquent encrypted casting (`$casts = ['merchant_key' => 'encrypted', ...]` is absent).
- **Potential Impact**:
  A compromised database backup, read-only SQL injection, or unauthorized database access directly exposes active merchant account keys, API passwords, and cryptographic HMAC salts, permitting unauthorized payment manipulations on external gateways.
- **Recommended Remediation (Medora 2.0)**:
  - Keep payment gateway credentials out of application tables.
  - Inject gateway credentials via secure environment variables (`.env`) or fetch them at runtime from a dedicated secret vault.
  - If stored in PostgreSQL, encrypt fields using `pgcrypto` with keys managed outside the database layer.

---

### SEC-04: Historical Medical Attachments (PHI) Stored on Public Disk
- **Severity**: **HIGH**
- **Confidence**: **High** (Verified from source code)
- **Source Reference**:
  - [`legacy/app/Console/Commands/SecureAttachments.php:5-7`](../legacy/app/Console/Commands/SecureAttachments.php#L5-L7)
  - [`legacy/app/Http/Controllers/MedicalHistoryController.php:154-169`](../legacy/app/Http/Controllers/MedicalHistoryController.php#L154-L169)
- **Evidence**:
  Documentation in `SecureAttachments.php` states:
  > *"Reports used to be stored under `storage/app/public`, which the web server serves to anyone holding the link. New uploads go to the private disk; this moves the old ones across so they open only through `/history/{id}/attachment`."*
- **Potential Impact**:
  Historical deployments or systems where `hospital:secure-attachments` was not executed leave patient diagnostic reports, scans, and attachments under publicly accessible web directories without authentication, constituting a major HIPAA / GDPR Protected Health Information (PHI) breach.
- **Recommended Remediation (Medora 2.0)**:
  - Store all clinical documents, images, and attachments in private Supabase Storage or AWS S3 buckets with public access completely disabled.
  - Access must strictly require authenticated NestJS requests returning short-lived (e.g. 5-minute) pre-signed URLs verified against patient consent and provider role permissions.

---

### SEC-05: Plaintext Credentials Stored for SMS/Telecom Gateways
- **Severity**: **MEDIUM**
- **Confidence**: **High** (Verified from source code)
- **Source Reference**:
  - [`legacy/app/Http/Controllers/ICTCoreController.php:39`](../legacy/app/Http/Controllers/ICTCoreController.php#L39)
  - [`legacy/database/migrations/2016_07_05_050630_create_ictcore_integration_table.php`](../legacy/database/migrations/2016_07_05_050630_create_ictcore_integration_table.php)
- **Evidence**:
  The `ictcore_integration` table stores columns `ictcore_url`, `ictcore_user`, and `ictcore_password` as plain `VARCHAR` strings without encryption or hashing.
- **Potential Impact**:
  Database dumps or unauthorized queries expose full credentials for the hospital's ICTCore and telecom gateways, allowing attackers to hijack SMS notification channels.
- **Recommended Remediation (Medora 2.0)**:
  - Store gateway authentication tokens and passwords in NestJS configuration environment variables or encrypted secrets store.

---

### SEC-06: Insecure cURL Calls & Unsanitized XML Parsing in Gateway Client
- **Severity**: **MEDIUM**
- **Confidence**: **High** (Verified from source code)
- **Source Reference**:
  - [`legacy/app/Http/Controllers/ICTCoreController.php:885-924, 1051-1075`](../legacy/app/Http/Controllers/ICTCoreController.php#L885-L924)
- **Evidence**:
  Legacy cURL execution lacks explicit TLS certificate validation (`CURLOPT_SSL_VERIFYPEER` is omitted). Responses from telecom endpoints are directly ingested into `new \SimpleXMLElement($retValue)` without disabling external entity loading or verifying payload integrity.
- **Potential Impact**:
  Vulnerability to Man-in-the-Middle (MitM) attacks on unencrypted or untrusted network segments, and potential XML External Entity (XXE) vulnerabilities if an upstream API endpoint returns malicious XML payloads.
- **Recommended Remediation (Medora 2.0)**:
  - Standardize all external communications using NestJS `HttpModule` (Axios) enforcing strict TLS validation, timeout bounds, and strict JSON response schemas validated via `class-validator` / `zod`.

---

### SEC-07: Predictable Default Admin Password in Seeder
- **Severity**: **MEDIUM**
- **Confidence**: **High** (Verified from source code)
- **Source Reference**:
  - [`legacy/database/seeders/UserTableSeeder.php:51-62`](../legacy/database/seeders/UserTableSeeder.php#L51-L62)
- **Evidence**:
  ```php
  User::create([
      'firstname' => 'Hospital',
      'lastname' => 'Administrator',
      'login' => 'admin',
      'email' => 'admin@example.com',
      'group' => 'Admin',
      'password' => Hash::make('123456'),
  ]);
  ```
- **Potential Impact**:
  If operators deploy fresh installations without immediately changing the seeded credentials, automated credential stuffers or local attackers can take over the entire hospital management system via `admin / 123456`.
- **Recommended Remediation (Medora 2.0)**:
  - Do not hardcode static passwords in seeders.
  - Require an initial onboarding wizard that generates a cryptographically random admin password displayed once upon first boot, or read `INITIAL_ADMIN_PASSWORD` from a secure setup environment variable.

---

### SEC-08: Discrepancy Between Navigation UI Gating and Route Authorization
- **Severity**: **MEDIUM**
- **Confidence**: **High** (Verified from source code)
- **Source Reference**:
  - [`legacy/config/hospital_permissions.php:40-70`](../legacy/config/hospital_permissions.php)
  - [`legacy/resources/views/layouts/sidebarmenu.blade.php`](../legacy/resources/views/layouts/sidebarmenu.blade.php)
  - [`legacy/routes/web.php:515-527`](../legacy/routes/web.php)
- **Evidence**:
  Several permissions defined in `config/hospital_permissions.php` (e.g. `patient_medical_history`, `appointment_calendar`, `view_appointment_reports`, `bed_allot`, `bed_release`, `patient_bulk_add`, `patient_portal_access`) control UI visibility in `sidebarmenu.blade.php`, but corresponding backend routes in some legacy modules only enforce basic `auth` rather than specific resource permissions.
- **Potential Impact**:
  A low-privileged user (e.g. receptionist or laboratorist) could access sensitive clinical actions by manually crafting HTTP requests to URLs that are hidden from their menu but not guarded on the server.
- **Recommended Remediation (Medora 2.0)**:
  - Never rely on frontend navigation hiding for authorization.
  - Implement zero-trust authorization in NestJS: every endpoint must be explicitly decorated with `@RequirePermissions(...)` checked by `PermissionsGuard`.

---

### SEC-09: String-Based Storage for Financial Data & Implicit Type Coercion
- **Severity**: **LOW**
- **Confidence**: **High** (Verified from source code)
- **Source Reference**:
  - [`legacy/app/Http/Controllers/CronjobController.php:157-172`](../legacy/app/Http/Controllers/CronjobController.php#L157-L172)
  - Legacy migrations (`payment.gross_total`, `payment.amount_received`)
- **Evidence**:
  Financial amounts are stored as `VARCHAR` in legacy MySQL tables, requiring manual casting in SQL queries:
  ```sql
  CAST(COALESCE(NULLIF(payment.gross_total, ""), "0") AS DECIMAL(15,2))
  ```
- **Potential Impact**:
  Risk of precision errors, invalid string inputs slipping through validation, and database-level query corruption under high transaction volumes.
- **Recommended Remediation (Medora 2.0)**:
  - Enforce strict `DECIMAL(12, 2)` or integer cents in Supabase PostgreSQL via Prisma schema, prohibiting string storage for monetary amounts.
