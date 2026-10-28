# Medora 2.0 — Permissions & Role-Based Access Control (RBAC) Matrix

## 1. Executive Summary
- **Total Role Groups**: 7 distinct roles (`admin`, `doctor`, `nurse`, `accountant`, `receptionist`, `pharmacist`, `laboratorist`)
- **Total Permissions Catalogue**: 97 granular permissions defined in `legacy/config/hospital_permissions.php`
- **Underlying Schema**: `permission` table with columns `permission_name`, `permission_group`, and `permission_type` (`'yes'` or `'no'`)
- **Runtime Enforcement**: `App\Http\Middleware\CheckPermission` leveraging in-memory cached grants in `App\Support\Permissions`
- **UI Gating**: Dynamic sidebar menu (`layouts/sidebarmenu.blade.php`) filtering visible navigation items per user role

> [!IMPORTANT]
> **NestJS Migration Rule**: In Medora 2.0, this flat role/permission scheme will be modeled in Prisma (`Role`, `Permission`, `RolePermission` entities) and enforced via NestJS `PermissionsGuard` and `@RequirePermissions(...)` decorators, ensuring the React frontend cannot bypass authorization.

---

## 2. Hospital Role Definitions

| Role Group | Label | Architectural Purpose & Scope | Staff Model Association |
| :--- | :--- | :--- | :--- |
| `admin` | **System Administrator** | Full unrestricted access across all clinical, financial, administrative, and configuration screens. Seeds with all 97 permissions granted. | Users table (`users.group = 'Admin'`) |
| `doctor` | **Medical Doctor** | Consultation workspace, clinical diagnosis, prescriptions, lab orders, appointment schedule, and doctor share reports. | `Doctor` model linked via `ion_user_id` |
| `nurse` | **Nursing Staff** | Inpatient ward management, bed allocation, vital signs recording, prescription review, and patient admissions. | `Nurse` model linked via `ion_user_id` |
| `accountant` | **Accounting & Billing** | Patient deposits, invoicing, expense tracking, payroll, financial ledgers, doctor share approval, and cash drawer auditing. | `Accountant` model linked via `ion_user_id` |
| `receptionist` | **Front Desk Staff** | Patient registration, appointment booking, admission intake, OPD token queue, invoice generation, and shift cash closing. | `Receptionist` model linked via `ion_user_id` |
| `pharmacist` | **Pharmacy Staff** | Medicine catalogue management, inventory stock tracking, drug dispensing, and sales reporting. | `Pharmacist` model linked via `ion_user_id` |
| `laboratorist` | **Laboratory Staff** | Lab test orders, diagnostic sample processing, test results entry, and reference range management. | `Laboratorist` model linked via `ion_user_id` |

---

## 3. Comprehensive Role Permissions Matrix

Legend: **Y** = Granted by default/seeder, **-** = Not granted by default

| Category | Permission Label | Stored Key | Admin | Doc | Nurse | Recep | Acc | Pharm | Lab | Enforced Routes |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Patients** | permissions | `permissions` | Y | - | - | - | - | - | - | *UI Menu only / Unlinked* |
| **Patients** | Patient View | `patient_view` | Y | Y | Y | Y | - | - | - | GET /patients<br>GET /patients/{id} |
| **Patients** | Patient Add | `patient_add` | Y | - | Y | Y | - | - | - | GET /patients/create<br>POST /patients |
| **Patients** | Patient Update | `patient_update` | Y | - | Y | Y | - | - | - | GET /patients/{id}/edit<br>PUT /patients/{id} |
| **Patients** | Patient Delete | `patient_delete` | Y | - | - | - | - | - | - | DELETE /patients/{id} |
| **Patients** | Patient Medical History | `patient_medical_history` | Y | Y | Y | Y | - | - | - | *UI Menu only / Unlinked* |
| **Patients** | Patient Portal Access | `patient_portal_access` | Y | - | - | - | - | - | - | *UI Menu only / Unlinked* |
| **Appointments** | Patient Bulk Add | `patient_bulk_add` | Y | - | - | - | - | - | - | *UI Menu only / Unlinked* |
| **Appointments** | Appointment View | `appointment_view` | Y | Y | Y | Y | - | - | - | GET /appointments<br>GET /appointments/{id} |
| **Appointments** | Appointment Add | `appointment_add` | Y | - | Y | Y | - | - | - | GET /appointments/create<br>POST /appointments |
| **Appointments** | Appointment Update | `appointment_update` | Y | - | - | Y | - | - | - | GET /appointments/{id}/edit<br>PUT /appointments/{id} |
| **Appointments** | Appointment Cancel | `appointment_cancel` | Y | - | - | Y | - | - | - | DELETE /appointments/{id} |
| **Appointments** | Appointment Calendar | `appointment_calendar` | Y | Y | Y | Y | - | - | - | *UI Menu only / Unlinked* |
| **Admissions, Beds & Wards** | View Appointment Reports | `view_appointment_reports` | Y | - | - | - | - | - | - | *UI Menu only / Unlinked* |
| **Admissions, Beds & Wards** | Admission View | `admission_view` | Y | - | Y | Y | - | - | - | GET /admissions<br>GET /admissions/{id} |
| **Admissions, Beds & Wards** | Admission Add | `admission_add` | Y | - | - | Y | - | - | - | GET /admissions/create<br>POST /admissions |
| **Admissions, Beds & Wards** | Admission Discharge | `admission_discharge` | Y | - | - | - | - | - | - | POST /admissions/{id}/discharge |
| **Admissions, Beds & Wards** | Bed View | `bed_view` | Y | - | Y | Y | - | - | - | GET /beds |
| **Admissions, Beds & Wards** | Bed Allot | `bed_allot` | Y | - | Y | Y | - | - | - | *UI Menu only / Unlinked* |
| **Admissions, Beds & Wards** | Bed Release | `bed_release` | Y | - | Y | - | - | - | - | *UI Menu only / Unlinked* |
| **Admissions, Beds & Wards** | Ward View | `ward_view` | Y | - | Y | - | - | - | - | GET /beds/categories |
| **Admissions, Beds & Wards** | Ward Add | `ward_add` | Y | - | - | - | - | - | - | GET /beds/create<br>POST /beds |
| **Admissions, Beds & Wards** | Ward Update | `ward_update` | Y | - | - | - | - | - | - | GET /beds/{id}/edit<br>PUT /beds/{id} |
| **Clinical Services** | Ward Delete | `ward_delete` | Y | - | - | - | - | - | - | DELETE /beds/categories/{id}<br>DELETE /beds/{id} |
| **Clinical Services** | Prescription View | `prescription_view` | Y | Y | Y | - | - | Y | - | GET /prescriptions<br>GET /prescriptions/{id} |
| **Clinical Services** | Prescription Add | `prescription_add` | Y | Y | - | - | - | - | - | GET /prescriptions/create<br>POST /prescriptions |
| **Clinical Services** | Prescription Update | `prescription_update` | Y | Y | - | - | - | - | - | GET /prescriptions/{id}/edit<br>PUT /prescriptions/{id} |
| **Clinical Services** | Prescription Delete | `prescription_delete` | Y | - | - | - | - | - | - | DELETE /prescriptions/{id} |
| **Clinical Services** | Lab Test View | `lab_test_view` | Y | Y | Y | - | - | - | Y | GET /lab<br>GET /lab/catalogue |
| **Clinical Services** | Lab Test Add | `lab_test_add` | Y | Y | - | - | - | - | Y | GET /lab/create<br>POST /lab |
| **Clinical Services** | Lab Test Update | `lab_test_update` | Y | - | - | - | - | - | Y | PUT /lab/catalogue/{id}<br>POST /lab/{id}/results |
| **Clinical Services** | Lab Test Delete | `lab_test_delete` | Y | - | - | - | - | - | - | DELETE /lab/catalogue/{id}<br>DELETE /lab/{id} |
| **Clinical Services** | Diagnostic Report View | `diagnostic_report_view` | Y | Y | - | - | - | - | Y | GET /radiology<br>GET /radiology/catalogue |
| **Clinical Services** | Diagnostic Report Add | `diagnostic_report_add` | Y | - | - | - | - | - | Y | GET /radiology/create<br>POST /radiology |
| **Clinical Services** | Operation Theatre View | `operation_theatre_view` | Y | - | - | - | - | - | - | *UI Menu only / Unlinked* |
| **Pharmacy** | Operation Theatre Schedule | `operation_theatre_schedule` | Y | - | - | - | - | - | - | *UI Menu only / Unlinked* |
| **Pharmacy** | Medicine View | `medicine_view` | Y | - | - | - | - | Y | - | GET /medicines<br>GET /medicines/categories |
| **Pharmacy** | Medicine Add | `medicine_add` | Y | - | - | - | - | Y | - | GET /medicines/create<br>POST /medicines |
| **Pharmacy** | Medicine Update | `medicine_update` | Y | - | - | - | - | Y | - | GET /medicines/{id}/edit<br>PUT /medicines/{id} |
| **Pharmacy** | Medicine Delete | `medicine_delete` | Y | - | - | - | - | - | - | DELETE /medicines/categories/{id}<br>DELETE /medicines/{id} |
| **Pharmacy** | Pharmacy Sale | `pharmacy_sale` | Y | - | - | - | - | Y | - | GET /pharmacy/create<br>POST /pharmacy |
| **Pharmacy** | Pharmacy Stock View | `pharmacy_stock_view` | Y | - | - | - | - | Y | - | GET /pharmacy<br>GET /pharmacy/{id} |
| **Staff & Departments** | View Pharmacy Reports | `view_pharmacy_reports` | Y | - | - | - | - | Y | - | *UI Menu only / Unlinked* |
| **Staff & Departments** | Doctor View | `doctor_view` | Y | Y | Y | - | - | - | - | GET /doctors<br>GET /doctors/{id} |
| **Staff & Departments** | Doctor Add | `doctor_add` | Y | - | - | - | - | - | - | GET /doctors/create<br>POST /doctors |
| **Staff & Departments** | Doctor Update | `doctor_update` | Y | - | - | - | - | - | - | GET /doctors/{id}/edit<br>PUT /doctors/{id} |
| **Staff & Departments** | Doctor Delete | `doctor_delete` | Y | - | - | - | - | - | - | DELETE /doctors/{id} |
| **Staff & Departments** | Doctor Schedule | `doctor_schedule` | Y | Y | - | - | - | - | - | GET /doctors/{id}/slots<br>POST /doctors/{id}/slots |
| **Staff & Departments** | Doctor Portal Access | `doctor_portal_access` | Y | - | - | - | - | - | - | *UI Menu only / Unlinked* |
| **Staff & Departments** | Nurse View | `nurse_view` | Y | - | Y | - | - | - | - | *UI Menu only / Unlinked* |
| **Staff & Departments** | Nurse Add | `nurse_add` | Y | - | - | - | - | - | - | *UI Menu only / Unlinked* |
| **Staff & Departments** | Nurse Update | `nurse_update` | Y | - | - | - | - | - | - | *UI Menu only / Unlinked* |
| **Staff & Departments** | Nurse Delete | `nurse_delete` | Y | - | - | - | - | - | - | *UI Menu only / Unlinked* |
| **Staff & Departments** | Staff View | `staff_view` | Y | - | - | - | - | - | - | *UI Menu only / Unlinked* |
| **Staff & Departments** | Staff Add | `staff_add` | Y | - | - | - | - | - | - | *UI Menu only / Unlinked* |
| **Staff & Departments** | Staff Update | `staff_update` | Y | - | - | - | - | - | - | *UI Menu only / Unlinked* |
| **Staff & Departments** | Staff Delete | `staff_delete` | Y | - | - | - | - | - | - | *UI Menu only / Unlinked* |
| **Staff & Departments** | Department View | `department_view` | Y | - | - | - | - | - | - | *UI Menu only / Unlinked* |
| **Staff & Departments** | Department Add | `department_add` | Y | - | - | - | - | - | - | *UI Menu only / Unlinked* |
| **Staff & Departments** | Department Update | `department_update` | Y | - | - | - | - | - | - | *UI Menu only / Unlinked* |
| **Financial & Accounting** | Department Delete | `department_delete` | Y | - | - | - | - | - | - | *UI Menu only / Unlinked* |
| **Financial & Accounting** | Payment View | `payment_view` | Y | - | - | Y | Y | - | - | *UI Menu only / Unlinked* |
| **Financial & Accounting** | Payment Add | `payment_add` | Y | - | - | Y | Y | - | - | GET /invoices/create<br>POST /invoices |
| **Financial & Accounting** | Payment Update | `payment_update` | Y | - | - | - | Y | - | - | *UI Menu only / Unlinked* |
| **Financial & Accounting** | Payment Delete | `payment_delete` | Y | - | - | - | - | - | - | DELETE /invoices/{id} |
| **Financial & Accounting** | Patient Deposit | `patient_deposit` | Y | - | - | - | Y | - | - | *UI Menu only / Unlinked* |
| **Financial & Accounting** | Invoice View | `invoice_view` | Y | - | - | Y | Y | - | - | GET /invoices<br>GET /invoices/{id} |
| **Financial & Accounting** | Invoice Print | `invoice_print` | Y | - | - | Y | Y | - | - | *UI Menu only / Unlinked* |
| **Financial & Accounting** | Expense View | `expense_view` | Y | - | - | - | Y | - | - | *UI Menu only / Unlinked* |
| **Financial & Accounting** | Expense Add | `expense_add` | Y | - | - | - | Y | - | - | *UI Menu only / Unlinked* |
| **Financial & Accounting** | Expense Update | `expense_update` | Y | - | - | - | Y | - | - | *UI Menu only / Unlinked* |
| **Financial & Accounting** | Expense Delete | `expense_delete` | Y | - | - | - | - | - | - | *UI Menu only / Unlinked* |
| **Financial & Accounting** | Payroll View | `payroll_view` | Y | - | - | - | Y | - | - | *UI Menu only / Unlinked* |
| **Financial & Accounting** | Payroll Process | `payroll_process` | Y | - | - | - | Y | - | - | *UI Menu only / Unlinked* |
| **Financial & Accounting** | View Payment Reports | `view_payment_reports` | Y | - | - | - | Y | - | - | GET /day-book |
| **Communications & System Administration** | Accounting | `accounting` | Y | - | - | - | Y | - | - | GET /accounting<br>POST /accounting |
| **Communications & System Administration** | Send Sms/Voice | `send_sms_voice` | Y | - | - | - | - | - | - | *UI Menu only / Unlinked* |
| **Communications & System Administration** | Send Notification | `send_notification` | Y | - | - | - | - | - | - | *UI Menu only / Unlinked* |
| **Communications & System Administration** | View Sms/voice log Reports | `view_sms_voice_log_reports` | Y | - | - | - | - | - | - | *UI Menu only / Unlinked* |
| **Communications & System Administration** | Service View | `service_view` | Y | - | - | - | - | - | - | GET /services<br>GET /patient-types |
| **Communications & System Administration** | Service Add | `service_add` | Y | - | - | - | - | - | - | POST /services |
| **Communications & System Administration** | Service Update | `service_update` | Y | - | - | - | - | - | - | PUT /services/{id}<br>POST /patient-types |
| **Communications & System Administration** | Service Delete | `service_delete` | Y | - | - | - | - | - | - | DELETE /services/{id}<br>DELETE /patient-types/{id} |
| **Communications & System Administration** | Holidays View | `holidays_view` | Y | - | - | - | - | - | - | *UI Menu only / Unlinked* |
| **Communications & System Administration** | Holidays Add | `holidays_add` | Y | - | - | - | - | - | - | *UI Menu only / Unlinked* |
| **Communications & System Administration** | Holidays Delete | `holidays_delete` | Y | - | - | - | - | - | - | *UI Menu only / Unlinked* |
| **Communications & System Administration** | Hospital Information Add | `hospital_information_add` | Y | - | - | - | - | - | - | *UI Menu only / Unlinked* |
| **Communications & System Administration** | Branch View | `branch_view` | Y | - | - | - | - | - | - | GET /hospital-branches |
| **OPD, Doctor Share & Cash Management** | Branch Add | `branch_add` | Y | - | - | - | - | - | - | POST /hospital-branches |
| **OPD, Doctor Share & Cash Management** | Branch Update | `branch_update` | Y | - | - | - | - | - | - | PUT /hospital-branches/{id}<br>POST /hospital-branches/{id}/users |
| **OPD, Doctor Share & Cash Management** | Branch Delete | `branch_delete` | Y | - | - | - | - | - | - | *UI Menu only / Unlinked* |
| **OPD, Doctor Share & Cash Management** | Doctor Share View | `doctor_share_view` | Y | Y | - | - | Y | - | - | GET /doctor-share<br>GET /doctor-share/policies |
| **OPD, Doctor Share & Cash Management** | Doctor Share Approve | `doctor_share_approve` | Y | - | - | - | Y | - | - | POST /doctor-share/approve<br>POST /doctor-share/pay |
| **OPD, Doctor Share & Cash Management** | Cash Close | `cash_close` | Y | - | - | Y | Y | - | - | GET /cash-close<br>POST /cash-close |

---

## 4. Enforcement Mechanics & Architectural Observations

### A. Route Middleware Pipeline
1. **Authentication Gate**: `auth` verifies an active user session (`Auth::check()`).
2. **Role / Privilege Checks**:
   - `admin`: Requires `users.group == 'Admin'` (used for branches, users, permissions).
   - `checkPermission:{key}`: Calls `App\Support\Permissions::allows($key)`.
3. **Handling Failures**:
   - Unauthenticated requests redirect to `/` (login).
   - API / JSON requests return `403 Forbidden` (`{'error': 'You do not have permission to do that.'}`).
   - Web requests redirect to `/no-permission` with session flash `denied = $permission`.

### B. Runtime Caching
- `App\Support\Permissions` loads all granted keys for the signed-in user's role on the first check via a single query (`SELECT permission_name FROM permission WHERE permission_group = ? AND permission_type = 'yes'`).
- Results are cached in memory for the request duration to prevent repeated database lookups.

### C. Gaps & Legacy Issues Identified
1. **Missing Route Guards on Legacy Routes**: Some older school/utility routes lack explicit `checkPermission` middleware and rely only on generic `auth`.
2. **Role Hardcoding**: Staff logins map directly to static strings in `users.group` rather than normalized foreign keys.
3. **User Impersonation Risk**: Route `GET /login/{user_id}` allows an Admin to switch identity without requiring the target user's password; in Medora 2.0 this must be strictly audited and token-governed.