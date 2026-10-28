# Medora 2.0 — Legacy Database Schema Inventory

## 1. Executive Summary
This document provides an exhaustive, read-only architectural inventory of all database tables, columns, data types, constraints, and implicit relationships discovered in the legacy ICTHospital application.

The inventory was compiled using deterministic static analysis across:
- **111 Migration files** in `legacy/database/migrations/`
- **95 Eloquent Model classes** in `legacy/app/Models/`
- **104 Discovered Database Tables** and **924 Columns** profiled from `database/database.sqlite` via `database/scripts/inspect-schema.php`
- Controller and service query inspection in `legacy/app/`

---

## 2. Inventory Metrics & Summary Statistics

| Metric | Measured Value | Notes & Analysis |
| :--- | :---: | :--- |
| **Total Discovered Tables** | **104** | Profiled from `database/database.sqlite` |
| **Total Discovered Columns** | **924** | Average ~8.9 columns per table |
| **Explicit SQLite Foreign Keys** | **0** | Relationships are maintained at application level via numeric/string IDs |
| **Tables with Primary Keys** | **102** | 2 legacy tables (`institute`, `password_resets`) lack explicit PK in schema |
| **Tables with Standard Timestamps** | **38** | Contain both `created_at` and `updated_at` |
| **Tables with Soft Deletes (`deleted_at`)** | **1** | Only `hospital_branch` in physical schema; models use flags or soft deletes |
| **Eloquent Models Present** | **95** | 7 obsolete school models (`Diary`, `FeeCol`, `FeeSetup`, `GPA`, `Marks`, `Question`, `Subject`) point to dropped tables |
| **Tables without Eloquent Models** | **17** | Framework tables (sessions, cache, jobs, OAuth, Spatie activity_log) |

---

## 3. Core Domain Breakdown & Table Classification

Tables are classified into 4 operational categories:
1. **Operational (Core)**: Actively used in clinical, billing, and front-desk workflows.
2. **Configuration / Reference**: Master data, fee schedules, branch settings, and permissions.
3. **Audit & Infrastructure**: Laravel framework queues, sessions, and activity logs.
4. **Historical / Legacy**: Obsolete CodeIgniter or ICTSchool remnants scheduled for retirement.

---

## 4. Detailed Domain Entity Inventories

### Domain 1: Patient Administration & Inpatient Admissions (8 Tables)

#### 1. `patient` (Operational)
- **Primary Key**: `id` (INTEGER, AUTOINCREMENT)
- **Columns (26)**:
  - `id`: INTEGER, PK, NOT NULL
  - `patient_id`: VARCHAR(100), NULL (6-digit zero-padded sequential MR number, e.g. `000001`)
  - `name`: VARCHAR(100), NOT NULL
  - `email`: VARCHAR(100), NULL
  - `phone`: VARCHAR(100), NULL
  - `address`: VARCHAR(100), NULL
  - `birthdate`: VARCHAR(100), NULL (stored as string date)
  - `sex`: VARCHAR(100), NULL (`Male`, `Female`, `Other`)
  - `bloodgroup`: VARCHAR(100), NULL
  - `patient_type_id`: INTEGER, NULL (FK -> `patient_type.id`)
  - `cnic`: VARCHAR(20), NULL (Pakistani CNIC `XXXXX-XXXXXXX-X`)
  - `guardian_name`: VARCHAR(100), NULL
  - `guardian_relation`: VARCHAR(50), NULL
  - `emergency_contact`: VARCHAR(100), NULL
  - `old_mr_number`: VARCHAR(50), NULL
  - `branch_id`: INTEGER, NULL (FK -> `hospital_branch.id`)
  - `img_url`: VARCHAR(255), NULL
  - `doctor`: VARCHAR(100), NULL (historical attending doctor name/id)
  - `add_date`: VARCHAR(100), NULL
  - `registration_time`: VARCHAR(100), NULL
  - `ion_user_id`: VARCHAR(100), NULL (optional link to portal user)
  - `how_added`: VARCHAR(100), NULL
  - Standard timestamps (`created_at`, `updated_at`)
- **Implicit Links**: `patient_type_id` -> `patient_type.id`, `branch_id` -> `hospital_branch.id`.
- **Source**: `2026_09_08_002900_create_patient_table.php`, `2026_09_12_090000_make_patient_optional_fields_nullable.php`, `App\Models\Patient`.

#### 2. `alloted_bed` (Operational)
- **Primary Key**: `id` (INTEGER, AUTOINCREMENT)
- **Columns (9)**: `id`, `patient` (VARCHAR, FK -> `patient.id`), `bed_id` (VARCHAR, FK -> `bed.id`), `d_time` (VARCHAR, discharge timestamp, NULL if currently admitted), `a_time` (VARCHAR, admission timestamp), `category` (VARCHAR, ward category), `description` (TEXT), Standard timestamps.
- **Critical Logic**: Current bed occupancy is strictly determined by `d_time IS NULL`.
- **Source**: `2026_09_08_000200_create_alloted_bed_table.php`, `App\Models\AllotedBed`.

#### 3. `bed` (Operational)
- **Primary Key**: `id` (INTEGER, AUTOINCREMENT)
- **Columns (8)**: `id`, `category` (VARCHAR, FK -> `bed_category.id`), `number` (VARCHAR(100)), `description` (VARCHAR), `status` (VARCHAR, cache column), `branch_id` (INTEGER, NULL), Standard timestamps.
- **Source**: `2026_09_08_000400_create_bed_table.php`, `App\Models\Bed`.

#### 4. `bed_category` (Configuration)
- **Primary Key**: `id` (INTEGER, AUTOINCREMENT)
- **Columns (3)**: `id`, `category` (VARCHAR(100), Ward Name, e.g. `General Ward`, `ICU`), `description` (TEXT).
- **Source**: `2026_09_08_000500_create_bed_category_table.php`, `App\Models\BedCategory`.

#### 5. `medical_history` (Operational)
- **Primary Key**: `id` (INTEGER, AUTOINCREMENT)
- **Columns (10)**: `id`, `patient_id` (INTEGER, FK -> `patient.id`), `title` (VARCHAR(100)), `description` (TEXT), `date` (VARCHAR), `img_url` (VARCHAR(255), private storage path), `patient_name`, `patient_phone`, `patient_address`, `registration_time`.
- **Source**: `2026_09_08_002100_create_medical_history_table.php`, `App\Models\MedicalHistory`.

#### 6. `patient_deposit` (Operational)
- **Primary Key**: `id` (INTEGER, AUTOINCREMENT)
- **Columns (9)**: `id`, `patient` (VARCHAR), `deposited_amount` (VARCHAR), `date` (VARCHAR), `user` (VARCHAR), Standard timestamps.
- **Source**: `2026_09_08_003000_create_patient_deposit_table.php`, `App\Models\PatientDeposit`.

#### 7. `patient_material` (Operational)
- **Primary Key**: `id` (INTEGER, AUTOINCREMENT)
- **Columns (10)**: `id`, `patient` (VARCHAR), `title` (VARCHAR), `url` (VARCHAR), `date` (VARCHAR), Standard timestamps.
- **Source**: `2026_09_08_003100_create_patient_material_table.php`, `App\Models\PatientMaterial`.

#### 8. `patient_type` (Configuration)
- **Primary Key**: `id` (INTEGER, AUTOINCREMENT)
- **Columns (7)**: `id`, `name` (VARCHAR(50)), `slug` (VARCHAR(50), UNIQUE), `description` (VARCHAR), `active` (BOOLEAN, default 1), `is_default` (BOOLEAN, default 0), Standard timestamps.
- **Standard Seeds**: `General` (default), `Panel` (corporate), `Charity`, `Staff`.
- **Source**: `2026_10_24_100000_patient_types_and_pricing.php`, `App\Models\PatientType`.

---

### Domain 2: Appointments, Scheduling & OPD Queue (7 Tables)

#### 9. `appointment` (Operational)
- **Primary Key**: `id` (INTEGER, AUTOINCREMENT)
- **Columns (27)**: `id`, `patient` (VARCHAR, FK -> `patient.id`), `doctor` (VARCHAR, FK -> `doctor.id`), `date` (VARCHAR), `s_time` (VARCHAR, start time), `e_time` (VARCHAR, end time), `status` (VARCHAR: `scheduled`, `arrived`, `in consultation`, `completed`, `cancelled`, `no show`), `remarks` (TEXT), `mode` (VARCHAR: `in_person`, `video`), `video_room` (VARCHAR(100), Jitsi meeting ID), `branch_id` (INTEGER, NULL), `queue_number` (INTEGER, NULL), `token_number` (VARCHAR(50), NULL), `visit_type` (VARCHAR: `first_visit`, `follow_up`), `checked_in_at` (DATETIME), `called_in_at` (DATETIME), `completed_at` (DATETIME), Standard timestamps.
- **Concurrency**: Double-booking collisions protected by `lockForUpdate()` overlap query.
- **Source**: `2026_09_08_000300_create_appointment_table.php`, `2026_10_24_130000_opd_queue_slots_fees.php`, `App\Models\Appointment`.

#### 10. `doctor_slot` (Configuration)
- **Primary Key**: `id` (INTEGER, AUTOINCREMENT)
- **Columns (9)**: `id`, `doctor_id` (INTEGER, FK -> `doctor.id`), `weekday` (INTEGER, 0=Sunday..6=Saturday), `start_time` (VARCHAR(5)), `end_time` (VARCHAR(5)), `slot_minutes` (INTEGER, default 15), `active` (BOOLEAN, default 1), Standard timestamps.
- **Source**: `2026_10_24_130000_opd_queue_slots_fees.php`, `App\Models\DoctorSlot`.

#### 11. `slot_block` (Operational)
- **Primary Key**: `id` (INTEGER, AUTOINCREMENT)
- **Columns (8)**: `id`, `doctor_id` (INTEGER, FK -> `doctor.id`), `date` (DATE), `start_time` (VARCHAR(5), NULL for full-day block), `end_time` (VARCHAR(5), NULL), `reason` (VARCHAR(255), leave/half-day), Standard timestamps.
- **Source**: `2026_10_24_130000_opd_queue_slots_fees.php`, `App\Models\SlotBlock`.

#### 12. `visit_fee` (Configuration)
- **Primary Key**: `id` (INTEGER, AUTOINCREMENT)
- **Columns (9)**: `id`, `doctor_id` (INTEGER, NULL for default hospital fee), `visit_type` (VARCHAR(20): `first_visit`, `follow_up`, `emergency`), `patient_type_id` (INTEGER, NULL), `amount` (DECIMAL(10,2)), `currency` (VARCHAR(3), default `PKR`), `active` (BOOLEAN, default 1), Standard timestamps.
- **Source**: `2026_10_24_130000_opd_queue_slots_fees.php`, `App\Models\VisitFee`.

#### 13. `holidays` (Configuration)
- **Primary Key**: `id` (INTEGER, AUTOINCREMENT)
- **Columns (5)**: `id`, `date` (VARCHAR), `title` (VARCHAR), `description` (TEXT), Standard timestamps.
- **Source**: `2026_09_08_001600_create_holidays_table.php`, `App\Models\Holiday`.

#### 14. `time_schedule` & 15. `time_slot` (Historical / Legacy)
- **Columns**: Legacy appointment time definitions superseded by `doctor_slot`.

---

### Domain 3: Clinical Consultations & Prescriptions (6 Tables)

#### 16. `consultation` (Operational)
- **Primary Key**: `id` (INTEGER, AUTOINCREMENT)
- **Columns (24)**: `id`, `appointment_id` (INTEGER, FK -> `appointment.id`), `patient_id` (INTEGER, FK -> `patient.id`), `doctor_id` (INTEGER, FK -> `doctor.id`), `date` (DATE), `started_at` (DATETIME), `ended_at` (DATETIME), `presenting_complaint` (TEXT), `history_of_presenting_complaint` (TEXT), `past_medical_history` (TEXT), `examination_findings` (TEXT), `provisional_diagnosis` (TEXT), `final_diagnosis` (TEXT), `investigations_ordered` (TEXT), `prescription_notes` (TEXT), `advice` (TEXT), `follow_up_date` (DATE), `follow_up_instructions` (TEXT), `status` (VARCHAR: `draft`, `finalised`), Standard timestamps.
- **Source**: `2026_10_24_140000_consultations.php`, `App\Models\Consultation`.

#### 17. `consult_template` (Configuration)
- **Primary Key**: `id` (INTEGER, AUTOINCREMENT)
- **Columns (6)**: `id`, `doctor_id` (INTEGER, NULL for shared templates), `title` (VARCHAR(100)), `category` (VARCHAR(50)), `template_data` (TEXT / JSON), Standard timestamps.
- **Source**: `2026_10_24_140000_consultations.php`, `App\Models\ConsultTemplate`.

#### 18. `prescription` (Operational)
- **Primary Key**: `id` (INTEGER, AUTOINCREMENT)
- **Columns (11)**: `id`, `patient` (VARCHAR, FK -> `patient.id`), `doctor` (VARCHAR, FK -> `doctor.id`), `date` (VARCHAR), `symptom` (TEXT), `medicine` (TEXT, legacy serialized summary), `note` (TEXT), Standard timestamps.
- **Source**: `2026_09_08_004000_create_prescription_table.php`, `App\Models\Prescription`.

#### 19. `prescription_medicine` (Operational)
- **Primary Key**: `id` (INTEGER, AUTOINCREMENT)
- **Columns (7)**: `id`, `prescription_id` (INTEGER, FK -> `prescription.id`), `medicine_id` (INTEGER, NULL for ad-hoc drugs), `medicine_name` (VARCHAR(150)), `dosage` (VARCHAR(100)), `frequency` (VARCHAR(100)), `duration` (VARCHAR(50)).
- **Source**: `2026_09_12_120000_create_prescription_medicine_table.php`, `App\Models\PrescriptionMedicine`.

#### 20. `diagnostic_report` & 21. `report` (Historical / Legacy)
- Older summary tables for document uploads; superseded by `medical_history` and `radiology_order`.

---

### Domain 4: Laboratory Diagnostics (4 Tables)

#### 22. `lab` (Operational)
- **Primary Key**: `id` (INTEGER, AUTOINCREMENT)
- **Columns (18)**: `id`, `patient` (VARCHAR, FK -> `patient.id`), `doctor` (VARCHAR, FK -> `doctor.id`), `date` (VARCHAR), `date_string` (VARCHAR), `category` (VARCHAR, comma-delimited test category IDs), `category_name` (VARCHAR), `report` (TEXT, summary text), `status` (VARCHAR: `requested`, `in progress`, `completed`), `user` (VARCHAR), `patient_name`, `patient_phone`, `patient_address`, `doctor_name`.
- **Source**: `2026_09_08_001700_create_lab_table.php`, `App\Models\Lab`.

#### 23. `lab_category` (Configuration)
- **Primary Key**: `id` (INTEGER, AUTOINCREMENT)
- **Columns (5)**: `id`, `category` (VARCHAR(100), Test Name), `reference_value` (VARCHAR(255)), `description` (TEXT), `price` (VARCHAR).
- **Source**: `2026_09_08_001800_create_lab_category_table.php`, `App\Models\LabCategory`.

#### 24. `lab_test` (Operational)
- **Primary Key**: `id` (INTEGER, AUTOINCREMENT)
- **Columns (8)**: `id`, `lab_id` (INTEGER, FK -> `lab.id`), `lab_category_id` (INTEGER, FK -> `lab_category.id`), `name` (VARCHAR(100)), `reference_value` (VARCHAR(255)), `result` (TEXT, NULL until tested), `status` (VARCHAR(50): `requested`, `completed`), Standard timestamps.
- **Source**: `2026_09_12_130000_create_lab_test_table.php`, `App\Models\LabTest`.

#### 25. `laboratorist` (Configuration)
- **Primary Key**: `id` (INTEGER, AUTOINCREMENT)
- **Columns (9)**: `id`, `name`, `email`, `phone`, `address`, `ion_user_id` (link to `users`), Standard timestamps.
- **Source**: `2026_09_08_001900_create_laboratorist_table.php`, `App\Models\Laboratorist`.

---

### Domain 5: Radiology Diagnostics (2 Tables)

#### 26. `radiology_order` (Operational)
- **Primary Key**: `id` (INTEGER, AUTOINCREMENT)
- **Columns (20)**: `id`, `order_number` (VARCHAR(30), UNIQUE), `patient_id` (INTEGER, FK -> `patient.id`), `doctor_id` (INTEGER, FK -> `doctor.id`), `radiology_exam_id` (INTEGER, FK -> `radiology_exam.id`), `order_date` (DATETIME), `clinical_indication` (TEXT), `urgency` (VARCHAR(10): `routine`, `urgent`, `stat`), `status` (VARCHAR: `ordered`, `scheduled`, `in_progress`, `reported`, `cancelled`), `reported_at` (DATETIME), `reported_by` (INTEGER, FK -> `users.id`), `technologist_id` (INTEGER), `invoice_id` (INTEGER, FK -> `payment.id`), `branch_id` (INTEGER, NULL), `findings` (TEXT), `impression` (TEXT), `recommendations` (TEXT), Standard timestamps.
- **Source**: `2026_10_24_150000_radiology.php`, `App\Models\RadiologyOrder`.

#### 27. `radiology_exam` (Configuration)
- **Primary Key**: `id` (INTEGER, AUTOINCREMENT)
- **Columns (8)**: `id`, `code` (VARCHAR(20), UNIQUE), `name` (VARCHAR(100)), `modality` (VARCHAR(20): `XRAY`, `CT`, `MRI`, `US`, `MAMMO`), `body_part` (VARCHAR(50)), `payment_category_id` (INTEGER, FK -> `payment_category.id`), `active` (BOOLEAN, default 1), Standard timestamps.
- **Source**: `2026_10_24_150000_radiology.php`, `App\Models\RadiologyExam`.

---

### Domain 6: Pharmacy & Drug Inventory (7 Tables)

#### 28. `medicine` (Operational / Inventory)
- **Primary Key**: `id` (INTEGER, AUTOINCREMENT)
- **Columns (12)**: `id`, `name` (VARCHAR(100)), `category` (VARCHAR(100), FK -> `medicine_category.id`), `price` (VARCHAR, selling price), `box` (VARCHAR, cost price), `s_price` (VARCHAR), `quantity` (INTEGER, stock on hand), `generic` (VARCHAR(100)), `company` (VARCHAR(100)), `effects` (TEXT), `e_date` (VARCHAR, expiration date), Standard timestamps.
- **Stock Depletion**: Atomic decrement on sale; rollback on insufficient quantity.
- **Source**: `2026_09_08_002200_create_medicine_table.php`, `App\Models\Medicine`.

#### 29. `medicine_category` (Configuration)
- **Primary Key**: `id` (INTEGER, AUTOINCREMENT)
- **Columns (3)**: `id`, `category` (VARCHAR(100), e.g. `Tablet`, `Syrup`, `Injection`), `description` (TEXT).
- **Source**: `2026_09_08_002300_create_medicine_category_table.php`, `App\Models\MedicineCategory`.

#### 30. `pharmacy_payment` (Operational)
- **Primary Key**: `id` (INTEGER, AUTOINCREMENT)
- **Columns (18)**: `id`, `patient` (VARCHAR, NULL for OTC walk-ins), `doctor` (VARCHAR), `date` (VARCHAR), `gross_total` (VARCHAR), `amount_received` (VARCHAR), `discount` (VARCHAR), `status` (VARCHAR: `paid`, `part paid`, `unpaid`), `shift_close_id` (INTEGER, NULL), Standard timestamps.
- **Source**: `2026_09_08_003800_create_pharmacy_payment_table.php`, `App\Models\PharmacyPayment`.

#### 31. `pharmacy_sale_item` (Operational)
- **Primary Key**: `id` (INTEGER, AUTOINCREMENT)
- **Columns (7)**: `id`, `pharmacy_payment_id` (INTEGER, FK -> `pharmacy_payment.id`), `medicine_id` (INTEGER, FK -> `medicine.id`), `medicine_name` (VARCHAR(100)), `quantity` (INTEGER), `unit_price` (DECIMAL(10,2)), `total_price` (DECIMAL(10,2)).
- **Source**: `2026_09_12_140000_create_pharmacy_sale_item_table.php`, `App\Models\PharmacySaleItem`.

#### 32. `pharmacist` (Configuration)
- **Primary Key**: `id` (INTEGER, AUTOINCREMENT)
- **Columns (9)**: `id`, `name`, `email`, `phone`, `address`, `ion_user_id`, Standard timestamps.

#### 33. `pharmacy_expense` & 34. `pharmacy_expense_category` (Historical / Legacy)
- Sub-ledger for pharmacy expenditures; mapped to core `accounting`.

---

### Domain 7: Billing, Invoicing & Cash Closing (11 Tables)

#### 35. `payment` (Operational Header: Invoices)
- **Primary Key**: `id` (INTEGER, AUTOINCREMENT)
- **Columns (30)**: `id`, `patient` (VARCHAR, FK -> `patient.id`), `doctor` (VARCHAR, performing doctor), `referring_doctor` (VARCHAR, NULL), `date` (VARCHAR), `amount` (VARCHAR, subtotal), `gross_total` (VARCHAR, net gross total), `amount_received` (VARCHAR, sum paid), `discount` (VARCHAR), `vat` (VARCHAR), `status` (VARCHAR: `paid`, `part paid`, `unpaid`), `patient_type_id` (INTEGER, FK -> `patient_type.id`), `care_setting` (VARCHAR(10): `opd`, `ipd`), `shift_close_id` (INTEGER, FK -> `shift_close.id`), `branch_id` (INTEGER, NULL), `patient_name`, `patient_phone`, `patient_address`, Standard timestamps.
- **Integrity**: Derived balance `balance() = gross_total - sum(payments)`. Overpayments rejected (`amount > balance + 0.004`).
- **Source**: `2026_09_08_003200_create_payment_table.php`, `App\Models\Payment`.

#### 36. `invoice_item` (Operational Line Items)
- **Primary Key**: `id` (INTEGER, AUTOINCREMENT)
- **Columns (8)**: `id`, `payment_id` (INTEGER, FK -> `payment.id`), `payment_category_id` (INTEGER, FK -> `payment_category.id`), `service_name` (VARCHAR(100)), `quantity` (INTEGER), `unit_price` (DECIMAL(10,2)), `total_price` (DECIMAL(10,2)), `doctor_id` (INTEGER, NULL).
- **Source**: `2026_09_12_150000_create_invoice_item_table.php`, `App\Models\InvoiceItem`.

#### 37. `invoice_payment` (Operational Transactions)
- **Primary Key**: `id` (INTEGER, AUTOINCREMENT)
- **Columns (8)**: `id`, `payment_id` (INTEGER, FK -> `payment.id`), `date` (VARCHAR), `amount` (DECIMAL(10,2)), `method` (VARCHAR: `Cash`, `Bank transfer`, `Card`, `Cheque`, `Online`, `Write-off`), `shift_close_id` (INTEGER, FK -> `shift_close.id`), `user` (VARCHAR, cashier), Standard timestamps.
- **Source**: `2026_09_12_150000_create_invoice_item_table.php`, `App\Models\InvoicePayment`.

#### 38. `payment_category` (Configuration: Billable Services)
- **Primary Key**: `id` (INTEGER, AUTOINCREMENT)
- **Columns (9)**: `id`, `category` (VARCHAR(100), service name), `description` (TEXT), `c_price` (VARCHAR, default list price), `d_commission` (VARCHAR, default doctor share %), `kind` (VARCHAR: `consultation`, `procedure`, `lab`, `radiology`, `ot`, `room`, `pharmacy`, `misc`), `active` (BOOLEAN, default 1), Standard timestamps.
- **Source**: `2026_09_08_003400_create_payment_category_table.php`, `App\Models\PaymentCategory`.

#### 39. `service_price` (Configuration: Multi-Tier Matrix)
- **Primary Key**: `id` (INTEGER, AUTOINCREMENT)
- **Columns (7)**: `id`, `payment_category_id` (INTEGER, FK -> `payment_category.id`), `patient_type_id` (INTEGER, FK -> `patient_type.id`), `opd_price` (DECIMAL(10,2)), `ipd_price` (DECIMAL(10,2)), Standard timestamps.
- **Lookup Rule**: Checked first by `PriceList::priceFor`; falls back to `payment_category.c_price` if null.
- **Source**: `2026_10_24_100000_patient_types_and_pricing.php`, `App\Models\ServicePrice`.

#### 40. `shift_close` (Operational: Cash Drawer Balancing)
- **Primary Key**: `id` (INTEGER, AUTOINCREMENT)
- **Columns (18)**: `id`, `user_id` (INTEGER, FK -> `users.id`), `closed_at` (DATETIME), `expected_cash` (DECIMAL(12,2)), `counted_cash` (DECIMAL(12,2)), `discrepancy` (DECIMAL(12,2)), `bank_transfer_total`, `card_total`, `cheque_total`, `other_total`, `write_off_total`, `notes` (TEXT), `status` (VARCHAR: `closed`, `verified`), Standard timestamps.
- **Source**: `2026_10_24_120000_cash_closing.php`, `App\Models\ShiftClose`.

#### 41. `paymentGateway` (Configuration)
- **Primary Key**: `id` (INTEGER, AUTOINCREMENT)
- **Columns (10)**: `id`, `name`, `merchant_key`, `salt`, `x`, `y`, `APIUsername`, `APIPassword`, `APISignature`, `status` (`enabled`, `disabled`).
- **Security Finding SEC-03**: Secrets stored as plaintext; requires PostgreSQL encryption or secret manager vault.

---

### Domain 8: Doctor Revenue Sharing (3 Tables)

#### 42. `doctor_share` (Operational)
- **Primary Key**: `id` (INTEGER, AUTOINCREMENT)
- **Columns (16)**: `id`, `payment_id` (INTEGER, FK -> `payment.id`), `invoice_item_id` (INTEGER, FK -> `invoice_item.id`), `doctor_id` (INTEGER, FK -> `doctor.id`), `share_rule_id` (INTEGER, FK -> `share_rule.id`), `role` (VARCHAR: `performing`, `referring`), `base_amount` (DECIMAL(10,2), net of discounts, excluding VAT), `percentage` (DECIMAL(5,2)), `fixed_amount` (DECIMAL(10,2)), `doctor_share` (DECIMAL(10,2)), `status` (VARCHAR: `pending`, `approved`, `paid`), `approved_by` (INTEGER), `approved_at` (DATETIME), `payout_reference` (VARCHAR(50)), `paid_at` (DATETIME), Standard timestamps.
- **Gating Rule**: Approval strictly prohibited until invoice balance `<= 0.004`.
- **Source**: `2026_10_24_110000_doctor_share.php`, `App\Models\DoctorShare`.

#### 43. `share_policy` & 44. `share_rule` (Configuration)
- **Columns**: Policy definitions with rule specificity scoring (+4 category, +2 department, +1 patient type).

---

### Domain 9: Staff, Roles & Hospital Infrastructure (9 Tables)

#### 45. `users` (Authentication & Credentials)
- **Primary Key**: `id` (INTEGER, AUTOINCREMENT)
- **Columns (16)**: `id`, `firstname` (VARCHAR(20)), `lastname` (VARCHAR(20)), `login` (VARCHAR(100), UNIQUE), `email` (VARCHAR(100)), `password` (VARCHAR(255), bcrypt), `group` (VARCHAR(20): `Admin`, `Doctor`, `Nurse`, `Accountant`, `Receptionist`, `Pharmacist`, `Laboratorist`), `desc` (VARCHAR(200)), `branch_id` (INTEGER, NULL), `photo`, `created_at`, `updated_at`.
- **Source**: `0001_01_01_000000_create_users_table.php`, `App\Models\User`.

#### 46. `permission` (Configuration: RBAC Grants)
- **Primary Key**: `id` (INTEGER, AUTOINCREMENT)
- **Columns (6)**: `id`, `permission_name` (VARCHAR(100)), `permission_group` (VARCHAR(50): `admin`, `doctor`, etc.), `permission_type` (VARCHAR(10): `'yes'` or `'no'`).
- **Seeded Matrix**: 96 permissions across 7 roles = 672 rows.

#### 47. `doctor` (Staff Profile)
- **Primary Key**: `id` (INTEGER, AUTOINCREMENT)
- **Columns (13)**: `id`, `name`, `email`, `phone`, `address`, `department` (VARCHAR), `profile` (TEXT), `photo`, `ion_user_id` (VARCHAR, FK -> `users.id`), `branch_id` (INTEGER, NULL), Standard timestamps.

#### 48. `nurse`, 49. `receptionist`, 50. `accountant`
- **Columns**: Standard staff records linked to `users.id` via `ion_user_id`.

#### 51. `hospital_branch` (Configuration: Multi-Branch)
- **Primary Key**: `id` (INTEGER, AUTOINCREMENT)
- **Columns (7)**: `id`, `name` (VARCHAR(100)), `code` (VARCHAR(20), UNIQUE), `address`, `phone`, `active` (BOOLEAN, default 1), `deleted_at` (DATETIME, soft-deletes).

#### 52. `institute` (Hospital Master Record)
- **Columns (8)**: `name`, `establish`, `email`, `web`, `phoneNo`, `address`. (Lacks PK in legacy schema).

---

### Domain 10: Communications & Third-Party Telephony (12 Tables)
- `sms`, `smsFormat`, `smsLog`, `sms_settings`, `notification_type`, `ictcore_integration`, `ictcore_attendance`, `ictcore_fees`, `cronschedule`, `message`, `template`, `verification_codes`.

---

### Domain 11: Framework Infrastructure & Activity Auditing (17 Tables)
- `activity_log` (Spatie), `laravel_logger_activity` (Jeremykenedy), `sessions`, `cache`, `cache_locks`, `jobs`, `job_batches`, `failed_jobs`, `migrations`, `password_resets`, `password_reset_tokens`, `oauth_access_tokens`, `oauth_auth_codes`, `oauth_clients`, `oauth_personal_access_clients`, `oauth_refresh_tokens`.

---

## 5. Discrepancies Between Schema Sources

1. **Migration vs SQLite Table Count**:
   - 111 migration files generated 104 SQLite tables (some migrations altered existing tables, e.g. adding columns or dropping school tables).
2. **Model vs Physical Database Discrepancy**:
   - 7 Eloquent models (`Diary`, `FeeCol`, `FeeSetup`, `GPA`, `Marks`, `Question`, `Subject`) point to tables dropped during school cleanup (`2026_09_09_140000_remove_school_tables.php`). These models will NOT be migrated to Prisma.
3. **Absence of Foreign Key Constraints**:
   - SQLite schema has **0 foreign keys**. Eloquent models enforce relations dynamically in PHP. In Medora 2.0, Prisma will enforce real database-level foreign keys with cascade/restrict rules.
4. **Primary Key Anomalies**:
   - `institute` and `password_resets` have no explicit primary key. In Prisma, `institute` will receive an auto-increment or singleton ID, and password resets will map to hashed tokens.
