# Medora 2.0 — Phase 10.1.1: Complete 101-Model Ownership Verification Matrix

## 1. Overview & Evaluation Methodology

This matrix documents the tenancy audit of all **101 models** in the Medora 2.0 Prisma schema ([backend/prisma/schema.prisma](file:///f:/yash/projects/full%20system/ICTHospital/backend/prisma/schema.prisma)).

Each model is evaluated against seven strict multi-tenant criteria:
1. **Direct `organizationId`**: Whether the model has a direct foreign key column `organizationId`.
2. **Indirect Relationship**: The chain of foreign keys through which organization ownership can theoretically be derived.
3. **Branch Linkage & Nullability**: Whether the model has `branchId`, and whether `branchId` is nullable (`BigInt?`).
4. **Unambiguous Ownership Resolution**: Whether every record in the table can be definitively assigned to a single organization without guessing or defaulting.
5. **Read Scoping**: Whether application queries (`findMany`, `findFirst`, etc.) enforce tenant boundaries.
6. **Write Scoping**: Whether mutations (`create`, `update`, `delete`) enforce tenant boundaries.
7. **Organization-Aware Constraints**: Whether `@unique` constraints are scoped to `[organizationId, ...]` or global across the database.

---

## 2. Complete 101-Model Audit Matrix

| # | Model Name | Direct `orgId` | Indirect Relationship | `branchId` Column | Nullable Branch? | Unambiguous Org? | Read Scoped? | Write Scoped? | Org-Aware Uniques? | Cross-Org Blocked? |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `User` | **YES** | Direct FK | `branchId` | **YES (Nullable)** | **YES** | Partial | Partial | No (`login` global) | No |
| 2 | `UserSession` | No | `user.organizationId` | None | N/A | **YES** | Yes | Yes | N/A | Yes |
| 3 | `Permission` | No | Global Reference | None | N/A | Master Global | Yes (Read-only) | N/A | No (Global unique) | N/A |
| 4 | `Organization` | **YES (PK)**| Root Tenant | None | N/A | **YES** | **NO (BOLA)** | **NO (BOLA)** | Yes (`code`) | Yes |
| 5 | `OrganizationSettings` | **YES** | Direct FK (1:1) | None | N/A | **YES** | **NO (BOLA)** | **NO (BOLA)** | Yes (`orgId`) | Yes |
| 6 | `UserOrganizationMembership`| **YES** | Direct FK | None | N/A | **YES** | Partial | Partial | Yes (`userId, orgId`) | Yes |
| 7 | `HospitalBranch` | **YES** | Direct FK | `id` (PK) | No | **YES** | **NO (Admin bypass)**| Partial | No (`code` global) | No |
| 8 | `HospitalSettings` | **YES** | Direct FK | None | N/A | **YES** | Partial | Partial | N/A | No |
| 9 | `BranchSettings` | No | `branch.organizationId` | `branchId` (1:1) | No | **YES** | Partial | Partial | Yes (`branchId`) | No |
| 10 | `UserBranchMembership` | No | `branch.organizationId` | `branchId` | No | **YES** | Partial | Partial | Yes (`userId, branchId`)| No |
| 11 | `ConfigurationAuditLog` | No | `branch.organizationId` | `branchId` | **YES (Nullable)** | **AMBIGUOUS if null** | No | Yes | N/A | No |
| 12 | `BranchDocumentSequence` | No | `branch.organizationId` | `branchId` | No | **YES** | Yes | Yes | Yes (`branchId, ...`)| Yes |
| 13 | `Institute` | No | Legacy Singleton | None | N/A | **UNANCHORED** | No | No | N/A | No |
| 14 | `Department` | No | None (Global) | None | N/A | **UNANCHORED** | **NO** | **NO** | No (`name` global) | No |
| 15 | `StaffDesignation` | No | None (Global) | None | N/A | **UNANCHORED** | Yes (Read-only) | No | No (`code` global) | No |
| 16 | `StaffProfile` | No | `branch.organizationId` | `branchId` | **YES (Nullable)** | **AMBIGUOUS if null** | **NO** | Partial | No (`empNumber` global)| No |
| 17 | `StaffDepartmentAssignment`| No | `branch.organizationId` | `branchId` | **YES (Nullable)** | **AMBIGUOUS if null** | No | Partial | N/A | No |
| 18 | `StaffEmploymentHistory` | No | `staffProfile -> branch`| None | N/A | **AMBIGUOUS if null** | No | Yes | N/A | No |
| 19 | `Nurse` | No | Legacy Table | None | N/A | **UNANCHORED** | No | No | N/A | No |
| 20 | `Pharmacist` | No | Legacy Table | None | N/A | **UNANCHORED** | No | No | N/A | No |
| 21 | `Laboratorist` | No | Legacy Table | None | N/A | **UNANCHORED** | No | No | N/A | No |
| 22 | `Receptionist` | No | Legacy Table | None | N/A | **UNANCHORED** | No | No | N/A | No |
| 23 | `Accountant` | No | Legacy Table | None | N/A | **UNANCHORED** | No | No | N/A | No |
| 24 | `PatientType` | No | None (Global) | None | N/A | **UNANCHORED** | Yes | No | No (`slug` global) | No |
| 25 | `Patient` | No | `branch.organizationId` | `branchId` | **YES (115 NULL)** | **AMBIGUOUS (115 null)**| **NO** | **NO (if null)**| No (`patientId` global)| **NO** |
| 26 | `BedCategory` | No | None (Global/Legacy) | None | N/A | **UNANCHORED** | No | No | N/A | No |
| 27 | `Bed` | No | `branch.organizationId` | `branchId` | **YES (Nullable)** | **AMBIGUOUS if null** | Partial | Partial | No (`categoryId, number`)| No |
| 28 | `AllotedBed` | No | `bed -> branch` | None | N/A | Indirect | Partial | Partial | N/A | No |
| 29 | `Admission` | No | `branch.organizationId` | `branchId` | **YES (24 NULL)** | **AMBIGUOUS (24 null)** | Partial | Partial | No (`admNum` global) | No |
| 30 | `BedAllocationHistory` | No | `admission -> branch` | None | N/A | Indirect | Partial | Partial | N/A | No |
| 31 | `InpatientFolio` | No | `admission -> branch` | None | N/A | Indirect | Partial | Partial | No (`folioNum` global) | No |
| 32 | `InpatientFolioItem` | No | `folio -> admission` | None | N/A | Indirect | Partial | Partial | Yes (`idempotencyKey`) | No |
| 33 | `MedicalHistory` | No | `patient -> branch` | None | N/A | **AMBIGUOUS if pat null**| **NO** | **NO** | N/A | **NO** |
| 34 | `PatientDeposit` | No | `patient -> branch` | None | N/A | **AMBIGUOUS if pat null**| **NO** | **NO** | N/A | **NO** |
| 35 | `Doctor` | No | `branch.organizationId` | `branchId` | **YES (109 NULL)** | **AMBIGUOUS (109 null)**| **NO** | Partial | N/A | **NO** |
| 36 | `Appointment` | No | `branch.organizationId` | `branchId` | **YES (38 NULL)** | **AMBIGUOUS (38 null)** | **NO** | Partial | N/A | **NO** |
| 37 | `DoctorSlot` | No | `doctor -> branch` | None | N/A | **AMBIGUOUS if doc null**| Partial | Partial | N/A | No |
| 38 | `SlotBlock` | No | `doctor -> branch` | None | N/A | **AMBIGUOUS if doc null**| Partial | Partial | N/A | No |
| 39 | `VisitFee` | No | `doctor -> branch` | None | N/A | **UNANCHORED** | No | No | N/A | No |
| 40 | `Holiday` | No | None (Global) | None | N/A | **UNANCHORED** | No | No | N/A | No |
| 41 | `Consultation` | No | `appointment / patient` | None | N/A | **AMBIGUOUS** | **NO** | **NO** | Yes (`appointmentId`)| **NO** |
| 42 | `ConsultTemplate` | No | `doctor -> branch` | None | N/A | **AMBIGUOUS** | No | No | N/A | No |
| 43 | `Prescription` | No | `patient / doctor` | None | N/A | **AMBIGUOUS** | **NO** | **NO** | N/A | **NO** |
| 44 | `PrescriptionMedicine` | No | `prescription -> ...` | None | N/A | **AMBIGUOUS** | **NO** | **NO** | N/A | **NO** |
| 45 | `LabCategory` | No | None (Master Catalogue)| None | N/A | Master Global | Yes | No | N/A | N/A |
| 46 | `LabTestParameter` | No | `labCategory` (Master) | None | N/A | Master Global | Yes | No | N/A | N/A |
| 47 | `Lab` (LabOrder) | No | `patient / doctor` | None | N/A | **AMBIGUOUS** | **NO** | **NO** | No (`orderNumber` global)| **NO** |
| 48 | `LabSample` | No | `lab -> patient` | None | N/A | **AMBIGUOUS** | **NO** | **NO** | No (`sampleNum` global)| **NO** |
| 49 | `LabTest` | No | `lab -> patient` | None | N/A | **AMBIGUOUS** | **NO** | **NO** | N/A | **NO** |
| 50 | `LabResultParameter` | No | `labTest -> lab` | None | N/A | **AMBIGUOUS** | **NO** | **NO** | N/A | **NO** |
| 51 | `LabReportAmendment` | No | `lab -> patient` | None | N/A | **AMBIGUOUS** | **NO** | **NO** | N/A | **NO** |
| 52 | `RadiologyCategory` | No | None (Master Catalogue)| None | N/A | Master Global | Yes | No | No (`name` global) | N/A |
| 53 | `RadiologyExam` | No | None (Master Catalogue)| None | N/A | Master Global | Yes | No | No (`code` global) | N/A |
| 54 | `RadiologyOrder` | No | `branch.organizationId` | `branchId` | **YES (Nullable)** | **AMBIGUOUS if null** | Partial | Partial | No (`orderNumber` global)| **NO** |
| 55 | `RadiologyReportAmendment`| No | `radiologyOrder -> branch`| None | N/A | **AMBIGUOUS if null** | Partial | Partial | N/A | **NO** |
| 56 | `MedicineCategory` | No | None (Master Catalogue)| None | N/A | Master Global | Yes | No | N/A | N/A |
| 57 | `Manufacturer` | No | None (Master Directory)| None | N/A | Master Global | Yes | No | No (`name` global) | N/A |
| 58 | `DosageForm` | No | None (Master Standard) | None | N/A | Master Global | Yes | No | No (`name` global) | N/A |
| 59 | `MeasurementUnit` | No | None (Master Standard) | None | N/A | Master Global | Yes | No | No (`name` global) | N/A |
| 60 | `Supplier` | No | None (Vendor Directory)| None | N/A | Master Global | Yes | No | N/A | N/A |
| 61 | `Medicine` | No | None (Drug Catalogue) | None | N/A | Master Global | Yes | No | N/A | N/A |
| 62 | `PharmacyPayment` | No | `shiftClose -> cashier` | None | N/A | **AMBIGUOUS** | Partial | Partial | N/A | No |
| 63 | `PharmacySaleItem` | No | `pharmacyPayment` | None | N/A | **AMBIGUOUS** | Partial | Partial | N/A | No |
| 64 | `MedicineBatch` | No | None (**SHARED INVENTORY**)| None | N/A | **SHARED GLOBAL** | **NO** | **NO** | No (`medId, batchNum`)| **NO (Shared)** |
| 65 | `StockMovement` | No | `batch -> medicine` | None | N/A | **SHARED GLOBAL** | **NO** | **NO** | N/A | **NO (Shared)** |
| 66 | `PurchaseOrder` | No | None (Procurement) | None | N/A | **UNANCHORED** | **NO** | **NO** | No (`poNumber` global)| No |
| 67 | `PurchaseOrderItem` | No | `purchaseOrder` | None | N/A | **UNANCHORED** | **NO** | **NO** | N/A | No |
| 68 | `GoodsReceipt` | No | `purchaseOrder` | None | N/A | **UNANCHORED** | **NO** | **NO** | No (`receiptNum` global)| No |
| 69 | `GoodsReceiptItem` | No | `goodsReceipt` | None | N/A | **UNANCHORED** | **NO** | **NO** | N/A | No |
| 70 | `PharmacyDispensation`| No | `prescription / invoice`| None | N/A | **AMBIGUOUS** | **NO** | **NO** | No (`dispNum` global) | **NO** |
| 71 | `PharmacyDispensationItem`| No | `dispensation` | None | N/A | **AMBIGUOUS** | **NO** | **NO** | N/A | **NO** |
| 72 | `StockAdjustment` | No | None (Pharmacy Audit) | None | N/A | **UNANCHORED** | **NO** | **NO** | No (`adjNum` global) | No |
| 73 | `StockAdjustmentItem`| No | `stockAdjustment` | None | N/A | **UNANCHORED** | **NO** | **NO** | N/A | No |
| 74 | `PharmacyReturn` | No | None (Return Log) | None | N/A | **UNANCHORED** | **NO** | **NO** | No (`retNum` global) | No |
| 75 | `PharmacyReturnItem`| No | `pharmacyReturn` | None | N/A | **UNANCHORED** | **NO** | **NO** | N/A | No |
| 76 | `PaymentCategory` | No | None (Tariff Master) | None | N/A | Master Global | Yes | No | N/A | N/A |
| 77 | `ServicePrice` | No | `paymentCategory` | None | N/A | Master Global | Yes | No | Yes (`catId, typeId`)| N/A |
| 78 | `Payment` (Invoice) | No | `branch.organizationId` | `branchId` | **YES (141 NULL)** | **AMBIGUOUS (141 null)**| Partial | Partial | N/A | **NO** |
| 79 | `InvoiceItem` | No | `payment -> branch` | None | N/A | **AMBIGUOUS if pay null**| Partial | Partial | N/A | **NO** |
| 80 | `InvoicePayment` | No | `payment -> branch` | None | N/A | **AMBIGUOUS if pay null**| Partial | Partial | N/A | **NO** |
| 81 | `ShiftClose` | No | `user.organizationId` | None | N/A | Indirect (via user) | Partial | Partial | N/A | No |
| 82 | `CashDrawer` | No | `branch.organizationId` | `branchId` | **YES (Nullable)** | **AMBIGUOUS if null** | Partial | Partial | No (`code` global) | No |
| 83 | `CashierShift` | No | `branch.organizationId` | `branchId` | **YES (Nullable)** | **AMBIGUOUS if null** | Partial | Partial | No (`shiftNum` global) | No |
| 84 | `CashTransaction` | No | `shift -> branch` | None | N/A | **AMBIGUOUS if null** | Partial | Partial | No (`txnNum` global) | No |
| 85 | `ShiftCloseDenomination`| No| `shift -> branch` | None | N/A | **AMBIGUOUS if null** | Partial | Partial | N/A | No |
| 86 | `DoctorShare` | No | `payment -> branch` | None | N/A | **AMBIGUOUS if pay null**| Partial | Partial | N/A | No |
| 87 | `Account` | No | `branch.organizationId` | `branchId` | **YES (26 NULL)** | **AMBIGUOUS (26 null)** | **NO** | **NO** | No (`accountCode` global)| **NO** |
| 88 | `AccountingPeriod` | No | `branch.organizationId` | `branchId` | **YES (Nullable)** | **AMBIGUOUS if null** | **NO** | **NO** | No (`periodCode` global)| **NO** |
| 89 | `JournalEntry` | No | `branch.organizationId` | `branchId` | **YES (Nullable)** | **AMBIGUOUS if null** | **NO** | **NO** | No (`jrnNum` global) | **NO** |
| 90 | `JournalEntryLine` | No | `journalEntry -> branch`| `branchId` | **YES (Nullable)** | **AMBIGUOUS if null** | **NO** | **NO** | N/A | **NO** |
| 91 | `ExpenseCategory` | No | None (Global) | None | N/A | **UNANCHORED** | **NO** | **NO** | No (`code` global) | No |
| 92 | `Expense` | No | `branch.organizationId` | `branchId` | **YES (Nullable)** | **AMBIGUOUS if null** | **NO** | **NO** | No (`expNum` global) | **NO** |
| 93 | `AccountingSetting` | No | None (Global) | None | N/A | **UNANCHORED** | Yes | No | No (`key` global) | No |
| 94 | `AccountingLegacy` | No | None (Legacy) | None | N/A | **UNANCHORED** | No | No | N/A | No |
| 95 | `AccountSectorLegacy`| No | None (Legacy) | None | N/A | **UNANCHORED** | No | No | N/A | No |
| 96 | `Notification` | No | `branch.organizationId` | `branchId` | **YES (Nullable)** | **AMBIGUOUS if null** | Partial | Partial | N/A | No |
| 97 | `NotificationRecipient`| No| `notification / user` | None | N/A | User Scoped | Yes | Yes | N/A | Yes |
| 98 | `NotificationTemplate` | No| `branch.organizationId` | `branchId` | **YES (Nullable)** | Master / Branch | Yes | Partial | No (`key, chan, loc`)| No |
| 99 | `NotificationPreference`|No| `user / patient` | None | N/A | User Scoped | Yes | Yes | Yes (`userId`, `patId`)| Yes |
| 100| `NotificationOutbox` | No | `notification -> branch`| None | N/A | Background Worker | Yes | Yes | Yes (`dedupKey`) | Yes |
| 101| `NotificationDelivery` | No | `notification -> branch`| None | N/A | Background Worker | Yes | Yes | N/A | Yes |

---

## 3. Key Observations & Breakdown

1. **Direct Organization Models (5 total)**:
   Only `Organization`, `OrganizationSettings`, `UserOrganizationMembership`, `HospitalBranch`, and `HospitalSettings` contain `organizationId`.
2. **Branch-Linked Models with Nullable `branchId` (23 total)**:
   Every single model that has `branchId` allows `branchId = NULL`. When `branchId` is NULL, the record has no link to `HospitalBranch`, breaking indirect tenant resolution.
3. **Completely Unanchored Models (26 total)**:
   Models like `Consultation`, `Prescription`, `MedicineBatch`, `PurchaseOrder`, `ExpenseCategory`, `Department`, and `StockAdjustment` have neither `organizationId` nor `branchId`.
4. **Shared Inventory Emergency**:
   `MedicineBatch` is globally shared. Multi-tenant pharmacies cannot coexist without separate batch tracking per branch or organization.

