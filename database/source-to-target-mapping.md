# Medora 2.0 — Source-to-Target Database Mapping Specification

## 1. Executive Summary
This document establishes the authoritative field-level mapping from the legacy ICTHospital MariaDB/MySQL/SQLite schema to the approved target **Supabase PostgreSQL** schema managed by **Prisma ORM** (`backend/prisma/schema.prisma`).

Every mapping defines:
- **Source Field**: Original table and column
- **Target Field**: Prisma model attribute and PostgreSQL column
- **Type Conversion**: Explicit SQL type transformation
- **Nullability & Default**: Handling of empty strings, nulls, and fallback values
- **Transformation Rule**: Cleaning, trimming, casting, or sequence derivation
- **Reconciliation Query**: Deterministic SQL verification check
- **Risk Level**: Low, Medium, High, or Critical
- **Status**: Mapped, Partially Mapped, Unresolved, or Retired (Not Applicable)

---

## 2. Table-Level Status Summary

| Target Domain | Source Table(s) | Target Prisma Model(s) | Status | Risk Level |
| :--- | :--- | :--- | :---: | :---: |
| **Authentication & RBAC** | `users`, `permission` | `User`, `Permission` | **Mapped** | Medium |
| **Multi-Branch Setup** | `hospital_branch`, `branches` | `HospitalBranch` | **Mapped** | Low |
| **Hospital Record** | `institute` | `Institute` | **Mapped** | Low |
| **Patient Administration** | `patient`, `patient_type` | `Patient`, `PatientType` | **Mapped** | High |
| **Inpatient Wards & Beds** | `bed`, `bed_category`, `alloted_bed` | `Bed`, `BedCategory`, `AllotedBed` | **Mapped** | Medium |
| **Medical Records** | `medical_history`, `patient_deposit` | `MedicalHistory`, `PatientDeposit` | **Mapped** | High (PHI) |
| **Appointments & OPD** | `appointment`, `doctor_slot`, `slot_block`, `visit_fee`, `holidays` | `Appointment`, `DoctorSlot`, `SlotBlock`, `VisitFee`, `Holiday` | **Mapped** | High |
| **Consultations** | `consultation`, `consult_template` | `Consultation`, `ConsultTemplate` | **Mapped** | Medium |
| **Prescriptions** | `prescription`, `prescription_medicine` | `Prescription`, `PrescriptionMedicine` | **Mapped** | Medium |
| **Laboratory Diagnostics**| `lab`, `lab_category`, `lab_test` | `Lab`, `LabCategory`, `LabTest` | **Mapped** | Medium |
| **Radiology Diagnostics** | `radiology_order`, `radiology_exam` | `RadiologyOrder`, `RadiologyExam` | **Mapped** | Low |
| **Pharmacy & Medicines** | `medicine`, `medicine_category`, `pharmacy_payment`, `pharmacy_sale_item` | `Medicine`, `MedicineCategory`, `PharmacyPayment`, `PharmacySaleItem` | **Mapped** | High |
| **Invoicing & Billing** | `payment`, `invoice_item`, `invoice_payment`, `payment_category`, `service_price` | `Payment`, `InvoiceItem`, `InvoicePayment`, `PaymentCategory`, `ServicePrice` | **Mapped** | High (Financial) |
| **Cashier Shift Closing** | `shift_close` | `ShiftClose` | **Mapped** | High (Financial) |
| **Doctor Revenue Share** | `doctor_share`, `share_policy`, `share_rule` | `DoctorShare` | **Mapped** | High (Financial) |
| **Staff Directories** | `doctor`, `nurse`, `receptionist`, `accountant`, `pharmacist`, `laboratorist` | `Doctor`, Staff entities | **Mapped** | Low |
| **Dropped School Tables**| `diaries`, `stdBill`, `feesSetup`, `GPA`, `Marks`, `questions`, `Subject` | *(Retired)* | **Retired (N/A)** | None |
| **Framework Tables** | `cache`, `sessions`, `jobs`, `migrations`, `oauth_*`, `activity_log` | *(Framework-managed)* | **Unmapped (N/A)** | Low |

---

## 3. Comprehensive Domain Field Mappings

### Domain 1: Patients (`patient` -> `Patient`)
| Source Field | Target Field | Target Type | Transformation & Handling | Risk | Status |
| :--- | :--- | :--- | :--- | :---: | :---: |
| `id` (INT) | `id` | `BigInt` | Direct key transfer; synchronize sequence post-import | Low | Mapped |
| `patient_id` (VARCHAR) | `patientId` | `String (VarChar 20)` | Clean leading/trailing spaces; enforce format `000001` | Med | Mapped |
| `name` (VARCHAR) | `name` | `String (VarChar 100)` | `TRIM(name)` | Low | Mapped |
| `email` (VARCHAR) | `email` | `String? (VarChar 100)` | Lowercase, empty string to NULL | Low | Mapped |
| `phone` (VARCHAR) | `phone` | `String? (VarChar 50)` | Standardize international format (`+92...`) | Low | Mapped |
| `address` (VARCHAR) | `address` | `String? (VarChar 255)`| `TRIM(address)` | Low | Mapped |
| `birthdate` (VARCHAR) | `birthdate` | `String? (VarChar 50)` | Convert `0000-00-00` to NULL | Med | Mapped |
| `sex` (VARCHAR) | `sex` | `String? (VarChar 20)` | Retain casing (`Male`, `Female`, `Other`) | Low | Mapped |
| `bloodgroup` (VARCHAR)| `bloodGroup` | `String? (VarChar 10)` | Normalize `O+`, `A+`, `B+`, `AB+`, etc. | Low | Mapped |
| `patient_type_id` (INT) | `patientTypeId` | `BigInt?` | Foreign key -> `patient_type.id`; nullify if orphan | Med | Mapped |
| `cnic` (VARCHAR) | `cnic` | `String? (VarChar 20)` | Validate CNIC regex format `XXXXX-XXXXXXX-X` | Med | Mapped |
| `branch_id` (INT) | `branchId` | `BigInt?` | Foreign key -> `hospital_branch.id` | Low | Mapped |
| `created_at` (DATETIME)| `createdAt` | `DateTime? (Timestamptz)`| Cast UTC offset; fallback `now()` | Low | Mapped |

**Reconciliation Query**:
```sql
SELECT 
  (SELECT COUNT(*) FROM legacy.patient) AS legacy_count,
  (SELECT COUNT(*) FROM target.patient) AS target_count,
  (SELECT COUNT(*) FROM target.patient WHERE patient_id IS NULL) AS missing_mr_numbers;
```

---

### Domain 2: Inpatient Admissions (`alloted_bed` -> `AllotedBed`)
| Source Field | Target Field | Target Type | Transformation & Handling | Risk | Status |
| :--- | :--- | :--- | :--- | :---: | :---: |
| `id` (INT) | `id` | `BigInt` | Direct key transfer | Low | Mapped |
| `patient` (VARCHAR) | `patientId` | `BigInt` | `CAST(patient AS BIGINT)`; verify existence in `patient` | High | Mapped |
| `bed_id` (VARCHAR) | `bedId` | `BigInt` | `CAST(bed_id AS BIGINT)`; verify existence in `bed` | High | Mapped |
| `a_time` (VARCHAR) | `aTime` | `String (VarChar 100)` | Standard admission datetime string | Low | Mapped |
| `d_time` (VARCHAR) | `dTime` | `String? (VarChar 100)`| Keep NULL for active occupancy | Critical | Mapped |
| `category` (VARCHAR) | `category` | `String? (VarChar 100)`| Ward name | Low | Mapped |

**Reconciliation Query**:
```sql
-- Active bed occupancy parity
SELECT 
  (SELECT COUNT(*) FROM legacy.alloted_bed WHERE d_time IS NULL) AS legacy_active_beds,
  (SELECT COUNT(*) FROM target.alloted_bed WHERE d_time IS NULL) AS target_active_beds;
```

---

### Domain 3: Invoices & Billing (`payment` -> `Payment`)
| Source Field | Target Field | Target Type | Transformation & Handling | Risk | Status |
| :--- | :--- | :--- | :--- | :---: | :---: |
| `id` (INT) | `id` | `BigInt` | Primary key transfer | Low | Mapped |
| `patient` (VARCHAR) | `patientId` | `BigInt` | `CAST(patient AS BIGINT)` | High | Mapped |
| `date` (VARCHAR) | `date` | `String (VarChar 50)` | Calendar date string | Low | Mapped |
| `amount` (VARCHAR) | `amount` | `Decimal (12, 2)` | `CAST(COALESCE(NULLIF(amount, ''), '0') AS DECIMAL(12,2))` | High | Mapped |
| `gross_total` (VARCHAR)| `grossTotal` | `Decimal (12, 2)` | Parse numeric string, reject negatives | High | Mapped |
| `amount_received` (VARCHAR)| `amountReceived` | `Decimal (12, 2)`| Sum paid on invoice | High | Mapped |
| `discount` (VARCHAR) | `discount` | `Decimal? (12, 2)` | Empty string to `0.00` | Med | Mapped |
| `vat` (VARCHAR) | `vat` | `Decimal? (12, 2)` | Empty string to `0.00` | Med | Mapped |
| `status` (VARCHAR) | `status` | `String (VarChar 20)` | `paid`, `part paid`, `unpaid` | Med | Mapped |
| `care_setting` (VARCHAR)| `careSetting` | `String (VarChar 10)` | Default `'opd'` if NULL | Low | Mapped |
| `shift_close_id` (INT)| `shiftCloseId` | `BigInt?` | Link to drawer reconciliation | Low | Mapped |

**Reconciliation Query**:
```sql
-- Cents-level financial total reconciliation
SELECT 
  (SELECT ROUND(SUM(CAST(COALESCE(NULLIF(gross_total, ''), '0') AS DECIMAL(15,2))), 2) FROM legacy.payment) AS legacy_gross,
  (SELECT ROUND(SUM(gross_total), 2) FROM target.payment) AS target_gross,
  (SELECT ROUND(SUM(CAST(COALESCE(NULLIF(amount_received, ''), '0') AS DECIMAL(15,2))), 2) FROM legacy.payment) AS legacy_received,
  (SELECT ROUND(SUM(amount_received), 2) FROM target.payment) AS target_received;
```

---

### Domain 4: Invoice Transactions (`invoice_payment` -> `InvoicePayment`)
| Source Field | Target Field | Target Type | Transformation & Handling | Risk | Status |
| :--- | :--- | :--- | :--- | :---: | :---: |
| `id` (INT) | `id` | `BigInt` | Primary key transfer | Low | Mapped |
| `payment_id` (INT) | `paymentId` | `BigInt` | Foreign key -> `payment.id` | Med | Mapped |
| `amount` (DECIMAL) | `amount` | `Decimal (10, 2)` | Exact payment installment amount | High | Mapped |
| `method` (VARCHAR) | `method` | `String (VarChar 50)` | `Cash`, `Bank transfer`, `Card`, `Cheque`, `Online`, `Write-off` | Low | Mapped |
| `shift_close_id` (INT)| `shiftCloseId` | `BigInt?` | Drawer link | Low | Mapped |

**Reconciliation Query**:
```sql
SELECT 
  (SELECT ROUND(SUM(amount), 2) FROM legacy.invoice_payment) AS legacy_payments_sum,
  (SELECT ROUND(SUM(amount), 2) FROM target.invoice_payment) AS target_payments_sum;
```

---

### Domain 5: Doctor Revenue Sharing (`doctor_share` -> `DoctorShare`)
| Source Field | Target Field | Target Type | Transformation & Handling | Risk | Status |
| :--- | :--- | :--- | :--- | :---: | :---: |
| `id` (INT) | `id` | `BigInt` | Primary key transfer | Low | Mapped |
| `payment_id` (INT) | `paymentId` | `BigInt` | Foreign key -> `payment.id` | Med | Mapped |
| `invoice_item_id` (INT)| `invoiceItemId`| `BigInt?` | Foreign key -> `invoice_item.id` | Med | Mapped |
| `doctor_id` (INT) | `doctorId` | `BigInt` | Foreign key -> `doctor.id` | Med | Mapped |
| `base_amount` (DECIMAL)| `baseAmount` | `Decimal (10, 2)` | Net share base amount | High | Mapped |
| `doctor_share` (DECIMAL)| `doctorShare`| `Decimal (10, 2)` | Doctor payout amount | High | Mapped |
| `status` (VARCHAR) | `status` | `String (VarChar 20)` | `pending`, `approved`, `paid` | Med | Mapped |
| `payout_reference` | `payoutReference`| `String? (VarChar 50)`| `PAYOUT-YYYYMMDDHHmm` | Low | Mapped |

---

### Domain 6: Pharmacy Inventory & Stock (`medicine` -> `Medicine`)
| Source Field | Target Field | Target Type | Transformation & Handling | Risk | Status |
| :--- | :--- | :--- | :--- | :---: | :---: |
| `id` (INT) | `id` | `BigInt` | Primary key transfer | Low | Mapped |
| `name` (VARCHAR) | `name` | `String (VarChar 100)` | Drug brand name | Low | Mapped |
| `category` (VARCHAR) | `categoryId` | `BigInt?` | `CAST(category AS BIGINT)` -> `medicine_category.id` | Med | Mapped |
| `price` (VARCHAR) | `price` | `Decimal (10, 2)` | `CAST(price AS DECIMAL(10,2))` | High | Mapped |
| `quantity` (INT) | `quantity` | `Int` | Integer inventory count on hand | High | Mapped |
| `generic` (VARCHAR) | `generic` | `String? (VarChar 100)`| Generic formulation | Low | Mapped |
| `company` (VARCHAR) | `company` | `String? (VarChar 100)`| Manufacturer | Low | Mapped |

**Reconciliation Query**:
```sql
SELECT 
  (SELECT SUM(quantity) FROM legacy.medicine) AS legacy_stock_units,
  (SELECT SUM(quantity) FROM target.medicine) AS target_stock_units;
```

### Domain 7: Doctors & Clinical Staff (`doctor` -> `Doctor`)
| Source Field | Target Field | Target Type | Transformation & Handling | Risk | Status |
| :--- | :--- | :--- | :--- | :---: | :---: |
| `id` (INT) | `id` | `BigInt` | Primary key transfer; synchronize sequence post-import | Low | Mapped |
| `name` (VARCHAR) | `name` | `String (VarChar 100)` | Doctor full legal/professional name (required) | Low | Mapped |
| `email` (VARCHAR) | `email` | `String? (VarChar 100)` | Unique across doctors when provided; empty strings mapped to NULL | Low | Mapped |
| `phone` (VARCHAR) | `phone` | `String? (VarChar 50)` | Phone number | Low | Mapped |
| `address` (VARCHAR) | `address` | `String? (VarChar 255)`| Clinic / chamber address | Low | Mapped |
| `department` (VARCHAR)| `department` | `String? (VarChar 100)`| Stored as text (varchar) per legacy compatibility; cascade renamed by DepartmentModule | Med | Mapped |
| `profile` (VARCHAR) | `profile` | `String? (Text)` | Qualifications and clinical experience | Low | Mapped |
| `img_url` (VARCHAR) | `imageUrl` | `String? (VarChar 255)`| Photo path | Low | Mapped |
| `ion_user_id` (VARCHAR)| `ionUserId` | `String? (VarChar 50)` | Optional link to `users.id` for staff login; empty string if no login | Med | Mapped |
| `procedure_id` (VARCHAR)| `procedureId` | `String? (VarChar 100)`| External procedure identifier | Low | Mapped |
| `share_policy_id` (INT)| `sharePolicyId` | `BigInt?` | Foreign reference to revenue share policy | Low | Mapped |
| `branch_id` (INT) | `branchId` | `BigInt?` | Foreign key -> `hospital_branch.id` | Low | Mapped |
| `x`, `y` (VARCHAR) | `x`, `y` | `String? (VarChar 50)` | Legacy layout coordinates, default `""` | Low | Mapped |

**Reconciliation Query**:
```sql
SELECT
  (SELECT COUNT(*) FROM legacy.doctor) AS legacy_doctor_count,
  (SELECT COUNT(*) FROM target.doctor) AS target_doctor_count;
```

---

## 4. Retired & Unmapped Entity Inventory

The following 7 legacy school tables were removed by migration `2026_09_09_140000_remove_school_tables.php` and are intentionally **omitted** from Prisma:
- `diaries` (`App\Models\Diary`)
- `stdBill` (`App\Models\FeeCol`)
- `feesSetup` (`App\Models\FeeSetup`)
- `GPA` (`App\Models\GPA`)
- `Marks` (`App\Models\Marks`)
- `questions` (`App\Models\Question`)
- `Subject` (`App\Models\Subject`)

Framework-specific tables (`sessions`, `cache`, `failed_jobs`, `jobs`, `migrations`, `oauth_*`, `laravel_logger_activity`) are superseded by Redis + BullMQ and NestJS audit modules.
