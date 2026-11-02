# Medora 2.0 — Inpatient, Ward & Bed Management Migration Specification (Phase 17)

## 1. Executive Summary
This document specifies the authoritative full-stack migration of the legacy ICTHospital Inpatient and Bed Management domain into Medora 2.0 (`backend/src/modules/inpatient` and `frontend/src/features/inpatient`).

The legacy implementation comprised:
- `alloted_bed` (storing admissions and bed occupations)
- `bed` (bed register and status mirror)
- `bed_category` (ward / category register)
- `AdmissionController.php` & `BedController.php`

Medora 2.0 upgrades this legacy design into an enterprise-grade Inpatient Department (IPD) architecture featuring:
1. **Ward & Bed Catalogue** with configurable daily rates and explicit occupancy/maintenance states.
2. **Clinical Admission Workflow** with unique sequential admission numbers (`ADM-YYYYMMDD-XXXX`), attending/admitting doctors, clinical notes, and discharge disposition.
3. **Pessimistic Concurrency & Double-Booking Prevention** using PostgreSQL row-level locks (`SELECT ... FOR UPDATE`) and deterministic bed locking order during patient transfers.
4. **Bed Allocation History** preserving every historical bed stay, rate snapshot, transfer reason, and releasing user.
5. **Inpatient Admission Folio** unifying bed charges, pharmacy dispensations, laboratory diagnostics, and radiology imaging into an integrated billing ledger while preserving outpatient invoicing isolation.
6. **Strict Financial Invariants & Charge Idempotency** preventing duplicate charges and enforcing auditable reversals.
7. **Granular Role-Based Access Control (RBAC)** across Admins, Doctors, Nurses, Receptionists, and Accountants.

---

## 2. Legacy Audit & Mapping

### 2.1 Legacy Tables and Semantics

| Legacy Element | Type | Semantic Meaning & Behavior | Medora 2.0 Representation |
| :--- | :--- | :--- | :--- |
| `bed_category` | Table | Ward type or department (e.g. General Ward, ICU, Private Room). Stored `category` and `description`. No pricing. | `BedCategory` (Ward) with `code`, `baseRate` (daily bed charge), `billingUnit`, `isActive`. |
| `bed` | Table | Physical bed in a ward. Stored `category`, `number`, `description`, `status` (`free`/`occupied`), `last_a_time`, `last_d_time`. Numbers unique per ward, not hospital-wide. | `Bed` with `categoryId`, `number`, `status` (`AVAILABLE`, `OCCUPIED`, `CLEANING`, `MAINTENANCE`, `RESERVED`, `BLOCKED`), `isActive`. Unique on `(categoryId, number)`. |
| `alloted_bed` | Table | Admission record. Stored `patient`, `bed_id`, `a_time`, `d_time`, `status`. A `NULL` or empty `d_time` signified an active stay. | `Admission` (Header) + `BedAllocationHistory` (Stay segments) + `InpatientFolio` (Financial ledger). |
| `a_time` | `VarChar(100)` | Admission timestamp string (e.g. `2026-10-24 15:30:00` or ISO). | `admissionDate DateTime @db.Timestamptz`. |
| `d_time` | `VarChar(100)` | Discharge timestamp string. `NULL` indicated patient currently admitted. | `actualDischargeDate DateTime? @db.Timestamptz`. |

### 2.2 Legacy Operational Quirks & Safety Gaps
1. **Financial Void**: The legacy application had no admission billing or folio system. Bed stays were never billed, and pharmacy/lab/radiology orders could only be billed as independent outpatient payments or not at all.
2. **Transfer Blindspot**: Legacy transfers did not exist. To move a patient, a clerk had to discharge them and re-admit them to another bed, destroying the continuous admission history and skewing length-of-stay metrics.
3. **Status Drift**: While `AdmissionController` synchronized `bed.status`, manual direct database edits or incomplete workflows frequently resulted in orphaned 'occupied' beds without active patients.
4. **Discharge Validation**: Discharging twice was rejected, but there was no discharge summary, condition assessment, or billing settlement verification.

### 2.3 Legacy Timestamp ETL Reconciliation Report
Live audit on target PostgreSQL and legacy SQLite data:
- **Total historical rows**: `0`
- **Valid timestamps**: `0`
- **Empty timestamps**: `0`
- **Invalid timestamps**: `0`
- **Converted rows**: `0`
- **Unresolved rows**: `0`

Target migration converts all legacy datetime columns to `DateTime @db.Timestamptz` with full UTC timezone preservation.

---

## 3. Target Database Architecture

### 3.1 Prisma Schema Models

```prisma
model BedCategory {
  id          BigInt    @id @default(autoincrement())
  category    String    @db.VarChar(100) // Ward Name (e.g. General Ward, ICU)
  code        String?   @db.VarChar(50)  // Ward Code (e.g. GW-01, ICU-A)
  description String?   @db.Text
  baseRate    Decimal   @default(0.00) @map("base_rate") @db.Decimal(10, 2)
  billingUnit String    @default("DAILY") @map("billing_unit") @db.VarChar(20)
  isActive    Boolean   @default(true) @map("is_active")
  createdAt   DateTime? @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime? @updatedAt @map("updated_at") @db.Timestamptz

  beds        Bed[]
  admissions  Admission[]

  @@map("bed_category")
}

model Bed {
  id          BigInt    @id @default(autoincrement())
  categoryId  BigInt    @map("category")
  number      String    @db.VarChar(100)
  description String?   @db.VarChar(255)
  status      String    @default("AVAILABLE") @db.VarChar(50)
  isActive    Boolean   @default(true) @map("is_active")
  branchId    BigInt?   @map("branch_id")
  createdAt   DateTime? @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime? @updatedAt @map("updated_at") @db.Timestamptz

  category    BedCategory          @relation(fields: [categoryId], references: [id])
  branch      HospitalBranch?      @relation(fields: [branchId], references: [id])
  allotedBeds AllotedBed[]
  admissions  Admission[]
  allocations BedAllocationHistory[]

  @@unique([categoryId, number])
  @@index([branchId])
  @@index([status])
  @@map("bed")
}

model Admission {
  id                    BigInt    @id @default(autoincrement())
  admissionNumber       String    @unique @map("admission_number") @db.VarChar(50)
  patientId             BigInt    @map("patient_id")
  attendingDoctorId     BigInt?   @map("attending_doctor_id")
  admittingDoctorId     BigInt?   @map("admitting_doctor_id")
  wardId                BigInt    @map("ward_id")
  bedId                 BigInt    @map("bed_id")
  admissionDate         DateTime  @map("admission_date") @db.Timestamptz
  expectedDischargeDate DateTime? @map("expected_discharge_date") @db.Timestamptz
  actualDischargeDate   DateTime? @map("actual_discharge_date") @db.Timestamptz
  admissionType         String    @default("ELECTIVE") @map("admission_type") @db.VarChar(50)
  admissionReason       String?   @map("admission_reason") @db.Text
  diagnosis             String?   @db.Text
  clinicalNotes         String?   @map("clinical_notes") @db.Text
  status                String    @default("ADMITTED") @db.VarChar(50)
  dischargeSummary      String?   @map("discharge_summary") @db.Text
  dischargeCondition    String?   @map("discharge_condition") @db.VarChar(100)
  createdBy             BigInt?   @map("created_by")
  dischargedBy          BigInt?   @map("discharged_by")
  branchId              BigInt?   @map("branch_id")
  createdAt             DateTime? @default(now()) @map("created_at") @db.Timestamptz
  updatedAt             DateTime? @updatedAt @map("updated_at") @db.Timestamptz

  patient               Patient                 @relation(fields: [patientId], references: [id])
  attendingDoctor       Doctor?                 @relation("AttendingDoctor", fields: [attendingDoctorId], references: [id])
  admittingDoctor       Doctor?                 @relation("AdmittingDoctor", fields: [admittingDoctorId], references: [id])
  ward                  BedCategory             @relation(fields: [wardId], references: [id])
  bed                   Bed                     @relation(fields: [bedId], references: [id])
  branch                HospitalBranch?         @relation(fields: [branchId], references: [id])
  allocations           BedAllocationHistory[]
  folio                 InpatientFolio?
  pharmacyDispensations PharmacyDispensation[]
  labOrders             Lab[]
  radiologyOrders       RadiologyOrder[]
  invoices              Payment[]

  @@index([patientId])
  @@index([bedId])
  @@index([wardId])
  @@index([status])
  @@index([admissionDate])
  @@map("admissions")
}

model BedAllocationHistory {
  id             BigInt    @id @default(autoincrement())
  admissionId    BigInt    @map("admission_id")
  bedId          BigInt    @map("bed_id")
  allocatedAt    DateTime  @map("allocated_at") @db.Timestamptz
  releasedAt     DateTime? @map("released_at") @db.Timestamptz
  rateSnapshot   Decimal   @default(0.00) @map("rate_snapshot") @db.Decimal(10, 2)
  transferReason String?   @map("transfer_reason") @db.VarChar(255)
  allocatedBy    BigInt?   @map("allocated_by")
  releasedBy     BigInt?   @map("released_by")
  createdAt      DateTime? @default(now()) @map("created_at") @db.Timestamptz
  updatedAt      DateTime? @updatedAt @map("updated_at") @db.Timestamptz

  admission      Admission @relation(fields: [admissionId], references: [id], onDelete: Cascade)
  bed            Bed       @relation(fields: [bedId], references: [id])

  @@index([admissionId])
  @@index([bedId])
  @@index([releasedAt])
  @@map("bed_allocation_history")
}

model InpatientFolio {
  id             BigInt    @id @default(autoincrement())
  folioNumber    String    @unique @map("folio_number") @db.VarChar(50)
  admissionId    BigInt    @unique @map("admission_id")
  patientId      BigInt    @map("patient_id")
  status         String    @default("OPEN") @db.VarChar(50) // OPEN, CLOSED, SETTLED
  totalCharges   Decimal   @default(0.00) @map("total_charges") @db.Decimal(12, 2)
  totalPaid      Decimal   @default(0.00) @map("total_paid") @db.Decimal(12, 2)
  balance        Decimal   @default(0.00) @db.Decimal(12, 2)
  settledAt      DateTime? @map("settled_at") @db.Timestamptz
  settledBy      BigInt?   @map("settled_by")
  finalInvoiceId BigInt?   @map("final_invoice_id")
  createdAt      DateTime? @default(now()) @map("created_at") @db.Timestamptz
  updatedAt      DateTime? @updatedAt @map("updated_at") @db.Timestamptz

  admission      Admission            @relation(fields: [admissionId], references: [id], onDelete: Cascade)
  patient        Patient              @relation(fields: [patientId], references: [id])
  finalInvoice   Payment?             @relation(fields: [finalInvoiceId], references: [id])
  items          InpatientFolioItem[]

  @@index([patientId])
  @@index([status])
  @@map("inpatient_folios")
}

model InpatientFolioItem {
  id             BigInt    @id @default(autoincrement())
  folioId        BigInt    @map("folio_id")
  sourceModule   String    @map("source_module") @db.VarChar(50) // BED, PHARMACY, LABORATORY, RADIOLOGY, SERVICE
  sourceRecordId String?   @map("source_record_id") @db.VarChar(100)
  idempotencyKey String?   @unique @map("idempotency_key") @db.VarChar(150)
  chargeCategory String    @map("charge_category") @db.VarChar(100)
  description    String    @db.VarChar(255)
  quantity       Int       @default(1)
  unitPrice      Decimal   @map("unit_price") @db.Decimal(10, 2)
  totalAmount    Decimal   @map("total_amount") @db.Decimal(12, 2)
  postedAt       DateTime  @default(now()) @map("posted_at") @db.Timestamptz
  postedBy       BigInt?   @map("posted_by")
  isReversed     Boolean   @default(false) @map("is_reversed")
  reversedAt     DateTime? @map("reversed_at") @db.Timestamptz
  reversedBy     BigInt?   @map("reversed_by")
  reversalReason String?   @map("reversal_reason") @db.VarChar(255)
  createdAt      DateTime? @default(now()) @map("created_at") @db.Timestamptz
  updatedAt      DateTime? @updatedAt @map("updated_at") @db.Timestamptz

  folio          InpatientFolio @relation(fields: [folioId], references: [id], onDelete: Cascade)

  @@index([folioId])
  @@index([sourceModule, sourceRecordId])
  @@map("inpatient_folio_items")
}
```

---

## 4. Concurrency Protection & Bed Allocation

### 4.1 Bed Allocation Protocol
When admitting a patient:
```sql
BEGIN;
-- 1. Acquire row-level exclusive lock on the target bed
SELECT id, category, number, status, is_active FROM bed WHERE id = $1 FOR UPDATE;

-- 2. Verify bed is AVAILABLE and active
-- 3. Verify no active admission exists for this patient
SELECT id FROM admissions WHERE patient_id = $2 AND status IN ('ADMITTED', 'TRANSFERRED', 'DISCHARGE_PENDING') FOR UPDATE;

-- 4. Create Admission record
-- 5. Create initial BedAllocationHistory record with current category baseRate snapshot
-- 6. Initialize InpatientFolio
-- 7. Update bed status to 'OCCUPIED'
COMMIT;
```

### 4.2 Deterministic Dual-Bed Locking Protocol for Transfers
When transferring a patient from Bed $A$ to Bed $B$:
To avoid deadlocks between simultaneous cross-transfers ($A \to B$ and $B \to A$), beds are always locked in deterministic ascending primary key order:
```typescript
const [firstBedId, secondBedId] = [oldBedId, newBedId].sort((a, b) => (a < b ? -1 : 1));

await tx.$queryRaw`SELECT id FROM bed WHERE id = ${firstBedId} FOR UPDATE`;
await tx.$queryRaw`SELECT id FROM bed WHERE id = ${secondBedId} FOR UPDATE`;
```
Once locked:
1. Validate that the current admission occupies `oldBedId`.
2. Validate that `newBedId` is currently `AVAILABLE` and active.
3. Close the active allocation in `bed_allocation_history` (`releasedAt = NOW()`).
4. Calculate and post prorated bed charges for the completed stay interval.
5. Create new `bed_allocation_history` for `newBedId` with target category's `baseRate` snapshot.
6. Update admission's current `bedId = newBedId` and `wardId = newBed.categoryId`.
7. Mark `oldBed` as `CLEANING` and `newBed` as `OCCUPIED`.
8. Commit.

---

## 5. Inpatient Admission Folio Integration

### 5.1 Outpatient vs. Inpatient Billing Isolation
- **Outpatient Workflows**: When a patient without an active admission receives pharmacy dispensing, lab tests, or radiology exams, the modules generate immediate `payment` (invoice) records as before.
- **Inpatient Workflows**: When the order or dispensation is linked to an active `admissionId`:
  - Stock movement and clinical orders occur atomically.
  - Instead of generating an outpatient cash invoice, the financial charge is posted to `inpatient_folio_items`.
  - The `idempotency_key` ensures that re-triggering or updating clinical records cannot duplicate the charge.

### 5.2 Charge Categories & Idempotency Keys

| Module | Folio Item `sourceModule` | Folio Item `idempotencyKey` Format | Description |
| :--- | :--- | :--- | :--- |
| Bed Stay | `BED` | `BED-{allocationId}-{dayTimestamp}` | Daily room charge using rate snapshot. |
| Pharmacy | `PHARMACY` | `PHARM-{dispensationId}-{itemId}` | Dispensed medication charge. |
| Laboratory | `LABORATORY` | `LAB-{labOrderId}-{testId}` | Diagnostic lab test charge. |
| Radiology | `RADIOLOGY` | `RAD-{orderId}` | Imaging examination charge. |
| Service / Procedure | `SERVICE` | `SRV-{admissionId}-{serviceId}-{timestamp}` | Direct clinical or nursing care fee. |

### 5.3 Financial Invariants
1. **Zero Double-Billing**: Every source transaction posts at most one folio item or outpatient invoice.
2. **Auditable Reversal**: Folio charges cannot be deleted. Any adjustment marks `isReversed = true`, sets `reversedAt`, `reversedBy`, and records `reversalReason`, re-calculating the folio balance.
3. **Discharge Settlement**: Completing discharge locks ordinary new charges. If there is a remaining balance, a consolidated final settlement invoice (`Payment`) is generated, linking to the folio.

---

## 6. Granular RBAC Permissions

| Permission Code | Description | Authorized Default Roles |
| :--- | :--- | :--- |
| `admission_view` | View inpatient admissions and ward board | Admin, Doctor, Nurse, Receptionist |
| `admission_add` | Admit patient and allocate initial bed | Admin, Receptionist, Nurse |
| `admission_discharge` | Request or complete patient discharge | Admin, Doctor, Nurse |
| `inpatient_transfer` | Transfer patient to another bed/ward | Admin, Doctor, Nurse |
| `inpatient_discharge_approve` | Authorize medical discharge summary | Admin, Doctor |
| `bed_view` | View bed statuses and occupancy | Admin, Doctor, Nurse, Receptionist |
| `bed_allot` | Allocate bed to admitted patient | Admin, Nurse, Receptionist |
| `bed_release` | Release bed for cleaning or maintenance | Admin, Nurse |
| `ward_view` | View wards and bed catalogue | Admin, Doctor, Nurse, Receptionist |
| `ward_manage` | Create or update wards, beds, and rates | Admin |
| `inpatient_folio_view` | View inpatient billing folios | Admin, Accountant, Doctor, Nurse |
| `inpatient_charge_post` | Post manual charges or bed days | Admin, Accountant |
| `inpatient_charge_reverse` | Reverse posted folio charge with reason | Admin, Accountant |
| `inpatient_reports` | Access IPD occupancy and revenue reports| Admin, Accountant |

---

## 7. Acceptance Verification Matrix

| Test Suite / Requirement | Verification Target | Status |
| :--- | :--- | :--- |
| Unit Tests | Validation, admission number generator, bed allocation rules, collision rejection, transfer rules, folio calculations, reversal integrity. | In Plan |
| Concurrency E2E Tests | Two simultaneous transactions attempting to admit into the exact same bed; exactly one succeeds, the other receives HTTP 409 Conflict. | In Plan |
| Cross-Module Folio E2E | Active admission -> Pharmacy dispense, Lab order, Radiology order -> Charges appear in folio without outpatient invoices. Outpatient orders continue generating invoices. | In Plan |
| Discharge Lifecycle E2E | Clinical summary -> Balance reconciliation -> Bed released to `CLEANING` -> Terminal state prevents further charges. | In Plan |
| Frontend Workspace | Ward & bed grid, admissions queue, bed transfer modal, folio review, printable admission and discharge documents. | In Plan |
