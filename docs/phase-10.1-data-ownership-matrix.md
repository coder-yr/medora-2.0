# Medora 2.0 — Phase 10.1: Data Ownership Matrix & Partitioning Strategy

## 1. Overview & Classification Criteria

To support multiple independent healthcare organizations (Medora Clinic, Medora Professional, Medora Hospital) on a single unified platform and shared database, every model in the database schema is classified according to its ownership tier and tenancy boundary.

### The 5 Ownership Tiers

1. **Organization-Owned (Tenant-Scoped)**:
   Entities that belong directly to a healthcare organization and define its overarching governance, licensing, legal structure, branding, or high-level organizational boundaries.
2. **Branch-Owned (Facility-Scoped)**:
   Entities that represent physical buildings, physical assets, wards, beds, physical cash drawers, inventory stock locations, and branch-specific configuration.
3. **User-Owned (Identity & Session-Scoped)**:
   Entities tied to specific user credentials, authentication sessions, profile customizations, notifications, or audit trails.
4. **Shared Reference / Catalogue (Master Reference Data)**:
   Reference dictionaries, clinical terminology catalogues, standard ICD-10/CPT code sets, medicine templates, and laboratory standard test definitions that can either be globally shared across organizations or cloned per organization.
5. **Transactional Record (Clinical & Operational Operations)**:
   High-volume clinical encounters, consultations, prescriptions, lab orders, radiology studies, invoices, payments, and general ledger journal entries. These are linked to a patient, practitioner, and operational facility (branch), while inheriting organization ownership through their parent facility or patient relationship.

---

## 2. Complete 98-Model Ownership Matrix

| # | Model Name | Ownership Tier | Scope / Tenancy Strategy | Primary Foreign Key Linkage |
|---|---|---|---|---|
| 1 | `Organization` | Organization-Owned | Tenant Root | Primary Key (`id`) |
| 2 | `OrganizationSettings` | Organization-Owned | Tenant Branding & Legal | `organizationId` -> `Organization(id)` |
| 3 | `UserOrganizationMembership` | Organization-Owned | Tenant Multi-Tenancy Membership | `organizationId`, `userId` |
| 4 | `HospitalSettings` | Organization-Owned | Legacy Hospital Configuration | `organizationId` -> `Organization(id)` |
| 5 | `HospitalBranch` | Branch-Owned | Physical Operating Facility | `organizationId` -> `Organization(id)` |
| 6 | `BranchSettings` | Branch-Owned | Facility Configuration Overrides | `branchId` -> `HospitalBranch(id)` |
| 7 | `UserBranchMembership` | Branch-Owned | Facility Access Assignment | `branchId`, `userId` |
| 8 | `User` | User-Owned | Platform Identity & Credentials | `organizationId`, `branchId` |
| 9 | `UserSession` | User-Owned | Authentication Tokens & Revocation | `userId` -> `User(id)` |
| 10 | `StaffProfile` | User-Owned | Staff Employment Master | `userId` -> `User(id)`, `branchId` |
| 11 | `StaffDepartmentAssignment` | Branch-Owned | Staff Allocation | `staffProfileId`, `departmentId` |
| 12 | `StaffEmploymentHistory` | User-Owned | Employment Lifecycle Audit | `staffProfileId` -> `StaffProfile(id)` |
| 13 | `Doctor` | Transactional / User | Clinical Practitioner Profile | `userId`, `departmentId`, `branchId` |
| 14 | `DoctorSchedule` | Branch-Owned | Doctor OPD Availability Schedule | `doctorId` -> `Doctor(id)` |
| 15 | `DoctorHoliday` | Branch-Owned | Doctor Leave & Planned Absence | `doctorId` -> `Doctor(id)` |
| 16 | `Department` | Branch-Owned | Clinical / Administrative Unit | `branchId` -> `HospitalBranch(id)` |
| 17 | `Patient` | Transactional Record | Patient Master Identity | `branchId` -> `HospitalBranch(id)` (Nullable) |
| 18 | `Appointment` | Transactional Record | OPD Clinic Appointment | `patientId`, `doctorId`, `branchId` |
| 19 | `Consultation` | Transactional Record | Doctor Clinical Encounter Note | `appointmentId`, `patientId`, `doctorId` |
| 20 | `VitalSigns` | Transactional Record | Patient Clinical Vitals History | `consultationId`, `patientId` |
| 21 | `Diagnosis` | Transactional Record | Encounter Clinical Diagnoses | `consultationId`, `patientId` |
| 22 | `MedicalCertificate` | Transactional Record | Doctor Issued Medical Certificate | `consultationId`, `patientId`, `doctorId` |
| 23 | `Prescription` | Transactional Record | Outpatient Drug Prescription | `patientId`, `doctorId`, `branchId` |
| 24 | `PrescriptionItem` | Transactional Record | Prescribed Medication Line Item | `prescriptionId`, `medicineId` |
| 25 | `Medicine` | Shared Reference / Tenant | Pharmacy Drug Catalogue | Global / Organization Scope |
| 26 | `MedicineCategory` | Shared Reference / Tenant | Pharmacy Drug Category | Global / Organization Scope |
| 27 | `MedicineBatch` | Branch-Owned | Inventory Stock Batch & Expiry | `medicineId`, `branchId` |
| 28 | `StockMovement` | Transactional Record | Inventory Ledger Deduction/Audit | `medicineBatchId`, `branchId`, `userId` |
| 29 | `PharmacySale` | Transactional Record | Outpatient Point of Sale (POS) | `patientId`, `cashierShiftId`, `branchId` |
| 30 | `PharmacySaleItem` | Transactional Record | Sold Medication Line Item | `saleId`, `medicineBatchId` |
| 31 | `LaboratoryOrder` | Transactional Record | Clinical Diagnostic Lab Order | `patientId`, `doctorId`, `branchId` |
| 32 | `LaboratoryOrderItem` | Transactional Record | Individual Lab Test Requisition | `orderId`, `labTestId` |
| 33 | `LaboratoryTest` | Shared Reference / Tenant | Laboratory Investigation Catalogue | Master Catalogue Scope |
| 34 | `LaboratoryTestParameter` | Shared Reference / Tenant | Test Reference Ranges & Units | `labTestId` -> `LaboratoryTest(id)` |
| 35 | `LaboratorySample` | Transactional Record | Specimen Phlebotomy & Barcode | `orderId`, `patientId`, `collectedById` |
| 36 | `LaboratoryResult` | Transactional Record | Quantitative Lab Value Recorded | `orderItemId`, `parameterId` |
| 37 | `RadiologyOrder` | Transactional Record | Diagnostic Imaging Order | `patientId`, `doctorId`, `branchId` |
| 38 | `RadiologyCatalog` | Shared Reference / Tenant | Imaging Modality Catalogue | Master Catalogue Scope |
| 39 | `RadiologyReportAmendment` | Transactional Record | Imaging Diagnostic Report Addendum | `radiologyOrderId`, `amendedById` |
| 40 | `Ward` | Branch-Owned | Physical Hospital Inpatient Ward | `branchId` -> `HospitalBranch(id)` |
| 41 | `Bed` | Branch-Owned | Physical Inpatient Ward Bed Asset | `wardId` -> `Ward(id)` |
| 42 | `InpatientAdmission` | Transactional Record | Hospital IPD Inpatient Stay | `patientId`, `bedId`, `doctorId`, `branchId` |
| 43 | `InpatientDailyCharge` | Transactional Record | Inpatient Room & Board Folio Fee | `admissionId`, `chargeCodeId` |
| 44 | `InpatientChargeRecord` | Transactional Record | Itemized IPD Charge Line Item | `admissionId`, `departmentId` |
| 45 | `InpatientDischargeSummary`| Transactional Record | Clinical Discharge Summary Note | `admissionId`, `doctorId` |
| 46 | `CashDrawer` | Branch-Owned | Physical Cash Register Drawer | `branchId` -> `HospitalBranch(id)` |
| 47 | `CashierShift` | Transactional Record | Cashier Duty Shift Session | `cashDrawerId`, `cashierId`, `branchId` |
| 48 | `CashTransaction` | Transactional Record | Drawer Inflow/Payout Audit Entry | `cashierShiftId`, `patientId` |
| 49 | `ShiftClose` | Transactional Record | Shift Close & Float Reconciliation | `cashierShiftId`, `closedById` |
| 50 | `Invoice` | Transactional Record | Patient Accounts Receivable Bill | `patientId`, `branchId` (Nullable) |
| 51 | `InvoiceItem` | Transactional Record | Billed Clinical Service Line Item | `invoiceId`, `departmentId` |
| 52 | `Payment` | Transactional Record | Patient Financial Receipt | `invoiceId`, `cashierShiftId`, `branchId` |
| 53 | `Expense` | Transactional Record | Operating Disbursement Expense | `branchId`, `createdById`, `approvedById` |
| 54 | `ExpenseCategory` | Shared Reference / Tenant | Operating Expense Classification | Tenant / Master Scope |
| 55 | `Account` | Branch / Organization | Chart of Accounts General Ledger | `organizationId` / `branchId` (Nullable) |
| 56 | `JournalEntry` | Transactional Record | Double-Entry Accounting Journal | `branchId`, `createdById`, `postedById` |
| 57 | `JournalEntryLine` | Transactional Record | Debit / Credit Posting Line Item | `journalEntryId`, `accountId` |
| 58 | `AccountingPeriod` | Organization-Owned | Fiscal Accounting Month/Quarter | `organizationId` / `branchId` |
| 59 | `Payroll` | Transactional Record | Monthly Staff Payroll Run | `staffProfileId`, `branchId` |
| 60 | `PayrollComponent` | Transactional Record | Salary Allowances & Deductions | `payrollId` -> `Payroll(id)` |
| 61 | `DoctorCommission` | Transactional Record | Doctor OPD/IPD Revenue Share Fee | `doctorId`, `invoiceId` |
| 62 | `OperationTheatre` | Branch-Owned | Surgical Operating Suite | `branchId` -> `HospitalBranch(id)` |
| 63 | `OperationTheatreBooking` | Transactional Record | Surgical Operation Booking | `patientId`, `theatreId`, `surgeonId` |
| 64 | `TelemedicineSession` | Transactional Record | Remote Tele-Consultation Call | `consultationId`, `patientId`, `doctorId` |
| 65 | `SmsMessage` | Transactional Record | Outbound SMS Alert Audit Trail | `patientId`, `branchId` |
| 66 | `Notice` | Branch / Organization | Internal Hospital Announcement | `branchId` -> `HospitalBranch(id)` (Nullable) |
| 67 | `ConfigurationAuditLog` | Organization-Owned | System Configuration Audit Trail | `userId`, `organizationId` |
| 68 | `ActivityLog` | Organization-Owned | General System Event Audit Trail | `userId`, `branchId` |
| 69 | `Notification` | User-Owned | In-App Bell Notification Alert | `userId` -> `User(id)` |
| 70 | `NotificationRecipient` | User-Owned | Push / Delivery Tracking Status | `notificationId`, `userId` |
| 71 | `NotificationPreference` | User-Owned | Channel Opt-in / Opt-out Rules | `userId` -> `User(id)` |
| 72 | `NotificationTemplate` | Shared Reference / Tenant | SMS/Email Messaging Template | Master / Tenant Scope |
| 73 | `NotificationProvider` | Shared Reference / Tenant | Twilio, SendGrid, Local Gateway | Master / Tenant Scope |
| 74 | `NotificationOutbox` | Transactional Record | Asynchronous Outbox Message Job | System Background Worker |
| 75 | `ChargeMasterItem` | Shared Reference / Tenant | Hospital Charge Schedule Item | Global / Organization Scope |
| 76 | `TariffCategory` | Shared Reference / Tenant | Patient Billing Tariff Rate Type | Global / Organization Scope |
| 77 | `InsuranceProvider` | Shared Reference / Tenant | Third-Party Payer Directory | Master / Tenant Scope |
| 78 | `InsurancePolicy` | Transactional Record | Patient Health Coverage Policy | `patientId`, `providerId` |
| 79 | `InsuranceClaim` | Transactional Record | Inpatient/OPD Insurance Claim | `invoiceId`, `policyId` |
| 80 | `InsuranceClaimItem` | Transactional Record | Itemized Claim Tariff Service | `claimId` -> `InsuranceClaim(id)` |
| 81 | `Supplier` | Shared Reference / Tenant | Medical & Pharmacy Vendor Directory | Master / Tenant Scope |
| 82 | `PurchaseOrder` | Transactional Record | Procurement Purchase Requisition | `supplierId`, `branchId` |
| 83 | `PurchaseOrderItem` | Transactional Record | Ordered Stock Batch Line Item | `purchaseOrderId`, `medicineId` |
| 84 | `GoodsReceivedNote` | Transactional Record | Warehouse Shipment Acceptance | `purchaseOrderId`, `receivedById` |
| 85 | `InventoryAdjustment` | Transactional Record | Physical Stock Audit Correction | `medicineBatchId`, `branchId` |
| 86 | `Equipment` | Branch-Owned | Biomedical Device Asset Registry | `branchId` -> `HospitalBranch(id)` |
| 87 | `EquipmentMaintenance` | Transactional Record | Calibration & Repair Event Log | `equipmentId`, `technicianId` |
| 88 | `Ambulance` | Branch-Owned | Emergency Response Fleet Vehicle | `branchId` -> `HospitalBranch(id)` |
| 89 | `AmbulanceTrip` | Transactional Record | Emergency Dispatch Trip Record | `ambulanceId`, `driverId`, `patientId` |
| 90 | `BloodDonor` | Transactional Record | Blood Bank Donor Registration | `patientId` (Nullable) |
| 91 | `BloodDonation` | Transactional Record | Blood Collection Event | `donorId`, `collectedById` |
| 92 | `BloodBag` | Branch-Owned | Stored Blood Unit In Stock | `branchId`, `donorId` |
| 93 | `BloodTransfusion` | Transactional Record | Patient Inpatient Transfusion Log | `patientId`, `bloodBagId`, `doctorId` |
| 94 | `MortuaryBody` | Transactional Record | Hospital Morgue Intake Case Record | `patientId`, `branchId` |
| 95 | `MortuaryFreezer` | Branch-Owned | Physical Morgue Cold Storage Asset | `branchId` -> `HospitalBranch(id)` |
| 96 | `DietPlan` | Transactional Record | Inpatient Nutritionist Prescription | `patientId`, `admissionId` |
| 97 | `DietMealDelivery` | Transactional Record | Ward Meal Serving Verification | `dietPlanId`, `deliveredById` |
| 98 | `RolePermission` | Shared Reference / Tenant | RBAC Authority Matrix Definition | Global Master Definition |

---

## 3. Analysis & Strategy for Legacy Branchless Records

During our deep database inspection, live analysis revealed that early legacy records were created without physical branch attribution:

- **115 Patients** (`branchId = NULL`)
- **109 Doctors** (`branchId = NULL`)
- **38 Appointments** (`branchId = NULL`)
- **141 Payments** (`branchId = NULL`)
- **24 Inpatient Admissions** (`branchId = NULL`)
- **26 General Ledger Accounts** (`branchId = NULL`)

### Architectural Risk of Branch-Only Tenancy
If tenant boundaries were enforced strictly through physical branches (`HospitalBranch`), all 115 patients and their associated financial, clinical, and admission histories would become "orphaned" or inaccessible, violating medical data integrity.

### Medora 2.0 Solution: Dual-Anchor Tenancy Model
To protect existing hospital functionality and preserve 100% of historical records:
1. **Direct Organization Binding**:
   - Both `HospitalBranch` and `User` hold direct foreign keys to `Organization` (`organizationId`).
   - Default Organization #1 (`MEDORA-HOSP-01`, "Medora Healthcare System") owns both branches (`MAIN` #1 and `CITY` #3) and all users.
2. **Context Resolution Fallback**:
   When querying patient records, appointments, or ledger accounts:
   - If `branchId` is present on the record, tenant ownership is resolved via `HospitalBranch.organizationId`.
   - If `branchId` is `NULL` (legacy branchless record), tenant ownership is resolved via the creator or attending user's `User.organizationId`, or defaults to the host organization (`MEDORA-HOSP-01`).
3. **Zero Data Loss Guarantee**:
   No columns were modified to `NOT NULL`. No existing foreign key constraints were tightened destructively. Existing queries continue to operate without regression.

---

## 4. Indexing & Multi-Tenant Query Strategy

To ensure high performance across thousands of tenants:

1. **Compound Indexes**:
   - `UserOrganizationMembership`: `@@unique([userId, organizationId])`, `@@index([userId])`, `@@index([organizationId])`.
   - `HospitalBranch`: `@@index([organizationId])`.
   - `User`: `@@index([organizationId])`.
2. **Deterministic Lookups**:
   - `Organization`: `@@unique([code])` for rapid slug and domain routing.
   - `OrganizationSettings`: `@@unique([organizationId])` for O(1) branding retrieval.
3. **Soft-Deletion Safe Indexing**:
   - Queries always include `deletedAt: null` to maintain audit preservation without degrading query execution plans.
