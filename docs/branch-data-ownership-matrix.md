# Branch Data Ownership Matrix
## Medora 2.0 — Phase 21 Specification

### 1. Classification Methodology
Every clinical, financial, administrative, and inventory data domain in Medora 2.0 is classified into one of three ownership categories:

1. **Hospital-Wide (Global)**:
   - Data entity belongs to the entire healthcare institution.
   - Accessible across all branches subject to role permissions.
   - Master catalogs, shared configurations, global chart of accounts, and system master directories.
2. **Branch-Owned (Strictly Scoped)**:
   - Data entity is created within and physically/legally belongs to a single physical branch facility.
   - Cross-branch access is strictly prohibited for non-administrative users.
   - Scoped by `branch_id` foreign key.
3. **Shared / Federated**:
   - Master record is centralized, but transactional events, assignments, or state transitions are branch-scoped.
   - Allows unified patient identification while isolating billing, dispensing, and admissions per facility.

---

### 2. Comprehensive Domain Ownership Matrix

| Domain # | Subsystem / Model | Scope Classification | Primary Scoping Key | Cross-Branch Access Rules |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Hospital Configuration & Settings** (`HospitalSettings`) | **Hospital-Wide** | Singleton Record | Read by all branches; write restricted to `Admin` with `HOSPITAL_SETTINGS_UPDATE`. |
| **2** | **Branch Operational Settings** (`BranchSettings`) | **Branch-Owned** | `branch_id` | Read/write scoped to branch administrators with `BRANCH_SETTINGS_*`. |
| **3** | **User Accounts & Authentication** (`User`, `UserSession`) | **Hospital-Wide** | Global `login` / `email` | User accounts exist globally; branch access gated by `UserBranchMembership`. |
| **4** | **Staff Profiles & HR Directory** (`StaffProfile`, `StaffDepartmentAssignment`) | **Shared** | `StaffProfile.branchId` + assignment `branch_id` | Staff profiles belong to primary branch; assignments can span multiple branches. |
| **5** | **Departments & Wards** (`Department`, `BedGroup`, `Bed`) | **Branch-Owned** | `Bed.branchId`, `BedGroup.branchId` | Physical beds and wards are physically located at a specific branch. |
| **6** | **Patient Demographics & Master Index** (`Patient`) | **Shared** | `Patient.branchId` (Origin branch) | Patients can be admitted or treated at any branch; patient records federate across branches under unified MRN. |
| **7** | **Inpatient Admissions & Beds** (`Admission`, `InpatientFolio`) | **Branch-Owned** | `Admission.branchId` | Inpatient stays, daily care charges, and bed occupancy are strictly branch-scoped. |
| **8** | **Outpatient & Appointments** (`Appointment`, `Consultation`) | **Branch-Owned** | `Appointment.branchId` | Doctor appointment slots and clinical visits belong to the hosting branch. |
| **9** | **Pharmacy Master Catalog** (`Medicine`, `MedicineCategory`) | **Hospital-Wide** | Master drug catalog | Drug definitions, dosage forms, and generic names are global across all branches. |
| **10** | **Pharmacy Inventory & Batches** (`MedicineBatch`, `StockMovement`) | **Branch-Owned** | `MedicineBatch.branchId` | Physical medicine stock, batch expiry, and dispensing occur at branch pharmacies. |
| **11** | **Laboratory Catalog & Tests** (`LabTest`, `LabCategory`) | **Hospital-Wide** | Global test catalog | Test definitions, normal ranges, and parameters are shared institution-wide. |
| **12** | **Laboratory Orders & Results** (`LabOrder`, `LabReport`) | **Branch-Owned** | `LabOrder.branchId` | Specimen collection, processing, and technician reporting are executed per branch. |
| **13** | **Radiology Procedures & Worklists** (`RadiologyProcedure`, `RadiologyOrder`) | **Branch-Owned** | `RadiologyOrder.branchId` | Imaging modalities and study orders are branch-scoped; readings can be federated to roaming radiologists. |
| **14** | **Invoices, Billing & Payments** (`Payment`, `InvoicePayment`) | **Branch-Owned** | `Payment.branchId` | Invoices and patient payments are collected by the branch cashier and belong to the branch register. |
| **15** | **Cash Drawers, Shifts & Treasury** (`CashDrawer`, `CashierShift`, `CashTransaction`) | **Branch-Owned** | `CashDrawer.branchId`, `CashierShift.branchId` | Physical cash registers, opening floats, physical cash counts, and day-books are branch-isolated. |
| **16** | **Chart of Accounts** (`Account`, `AccountSector`) | **Shared** | Global or `Account.branchId` | Institution uses unified chart of accounts; transactions tag branch for branch-level P&L. |
| **17** | **General Ledger & Journal Entries** (`JournalEntry`, `JournalLineItem`, `Expense`) | **Branch-Owned** | `JournalEntry.branchId`, `Expense.branchId` | Financial entries record operational branch context to generate consolidated and branch-specific financial reports. |

---

### 3. Isolation & Query Integrity Rules
1. **Always Filter by `branch_id` in Branch-Owned Domains**:
   - Every repository query in branch-scoped domains must supply `where: { branchId: activeBranchId }` unless the calling actor holds `Admin` role or `BRANCH_VIEW_ALL` and explicitly requested an institution-wide consolidation.
2. **Prevent Cross-Branch Resource References**:
   - When admitting a patient, the selected `Bed` must belong to the active branch (`bed.branchId === activeBranchId`).
   - When opening a cashier shift, the `CashDrawer` must belong to the active branch (`cashDrawer.branchId === activeBranchId`).
   - When posting an expense, the debit/credit accounts must belong to or be authorized for that branch.
3. **Data Protection on Branch Deactivation**:
   - Historical records of deactivated branches remain intact for statutory reporting and audits, but new operational inserts are blocked.
