# Medora 2.0 — Phase 10.1.1: Tenant Isolation & Organization Security Audit

## 1. Executive Summary

This security audit performs an exhaustive evaluation of the multi-tenancy implementation delivered in **Phase 10.1: Organization & Tenant Foundation** (commit `836db9a`).

While Phase 10.1 successfully established the foundational data models (`Organization`, `OrganizationSettings`, `UserOrganizationMembership`), database relationships, and JWT context propagation, this audit reveals that **the application does NOT yet enforce tenant isolation across its operational domains, clinical workflows, or organization management APIs.**

### Audit Verdict: **NOT READY FOR MULTI-TENANT PRODUCTION / PHASE 10.2 BLOCKED**
Phase 10.2 (Feature Entitlements & Subscription Tiers) must **NOT** proceed until the critical and high-severity tenant boundary vulnerabilities identified in this audit are remediated. Onboarding a second organization under the current codebase would result in immediate cross-tenant data leakage, medical record tampering, and shared pharmacy inventory corruption.

---

## 2. Threat Model & Attack Surface Analysis

The Medora 2.0 platform was analyzed against five primary multi-tenant attack vectors:

```
[Attacker Persona]
       │
       ├── Vector 1: Organization API BOLA (/api/v1/organizations/:id)
       │       └── Manipulating :id to read/mutate other organizations
       │
       ├── Vector 2: Global Admin Cross-Branch Bypass
       │       └── Hospital Admin using x-branch-id to enter another tenant's facility
       │
       ├── Vector 3: Global Unique Identifier Collisions
       │       └── MRN, Admission, Shift, Account code collisions crashing DB
       │
       ├── Vector 4: Branchless Record Hijacking (115 Patients)
       │       └── Reading/updating records where branchId is NULL
       │
       └── Vector 5: Shared Inventory Depletion
               └── Pharmacy dispensing deducting from global un-scoped stock batches
```

---

## 3. Critical & High-Severity Vulnerabilities

### Finding CRITICAL-01: Broken Object Level Authorization (BOLA) in `/api/v1/organizations/:id`
- **Affected File**: [backend/src/modules/organization/organization.controller.ts](file:///f:/yash/projects/full%20system/ICTHospital/backend/src/modules/organization/organization.controller.ts#L44-L101)
- **Functions**: `findById`, `update`, `getSettings`, `updateSettings`, `getOrganizationBranches`, `getOrganizationMembers`
- **Classification**: **CRITICAL**
- **Description**:
  The endpoints under `/api/v1/organizations/:id` are protected by `@UseGuards(JwtAuthGuard, RolesGuard)` and decorated with `@Roles('SuperAdmin', 'Admin')` or `@Roles('SuperAdmin', 'Admin', 'Doctor')`. However, none of these endpoints verify whether the caller belongs to organization `:id`.
  `@SkipBranchCheck()` is applied at the controller level, which completely disables branch checking without providing an organization membership check in its place.
- **Reproduction**:
  1. Authenticate as Hospital Admin of Clinic Alpha (`organizationId = 2`).
  2. Issue `GET /api/v1/organizations/1/members` (Organization 1 is Medora Main Hospital).
  3. The API returns HTTP 200 with all 17 doctors, nurses, and staff members of Medora Main Hospital.
  4. Issue `PUT /api/v1/organizations/1/settings` with a new bank account or legal name. The update succeeds.
- **Potential Impact**:
  Total administrative takeover and data exfiltration across independent tenant organizations.
- **Blocks Phase 10.2**: **YES**.

---

### Finding CRITICAL-02: Shared Global Pharmacy Inventory in `MedicineBatch`
- **Affected File**: [backend/prisma/schema.prisma](file:///f:/yash/projects/full%20system/ICTHospital/backend/prisma/schema.prisma#L1658-L1689), [backend/src/modules/pharmacy/pharmacy.service.ts](file:///f:/yash/projects/full%20system/ICTHospital/backend/src/modules/pharmacy/pharmacy.service.ts)
- **Classification**: **CRITICAL**
- **Description**:
  Neither `Medicine` nor `MedicineBatch` possesses an `organizationId` or `branchId` column. Medicine batches are identified solely by `[medicineId, batchNumber]`.
  When a pharmacist dispenses medication in Clinic Alpha, the inventory deduction (`StockMovement` and decrementing `currentQuantity`) operates directly against this shared record.
- **Reproduction**:
  1. Clinic Alpha dispenses 5 units of Amoxicillin Batch #BAT-01.
  2. Hospital Beta queries their available stock for Amoxicillin Batch #BAT-01.
  3. Hospital Beta's available quantity has decreased by 5 units.
- **Potential Impact**:
  Cross-tenant stock theft, financial misstatement, and catastrophic medication supply shortages.
- **Blocks Phase 10.2**: **YES**.

---

### Finding CRITICAL-03: Zero Tenant Scoping in Clinical Consultations & Prescriptions
- **Affected File**: [backend/src/modules/consultation/consultation.service.ts](file:///f:/yash/projects/full%20system/ICTHospital/backend/src/modules/consultation/consultation.service.ts), [backend/src/modules/prescription/prescription.service.ts](file:///f:/yash/projects/full%20system/ICTHospital/backend/src/modules/prescription/prescription.service.ts)
- **Classification**: **CRITICAL**
- **Description**:
  The `Consultation` and `Prescription` tables contain neither `organizationId` nor `branchId`. They link solely to `patientId` and `doctorId`.
  When a doctor opens a patient's consultation history via `getVisitContext`, `ConsultationService` queries:
  ```typescript
  this.prisma.consultation.findMany({
    where: { patientId: BigInt(patient.id) },
    include: { patient: true, doctor: true }
  })
  ```
  Any doctor treating a patient can view all consultation notes, psychiatric diagnoses, and private clinical documentation entered by doctors at competing clinics.
- **Potential Impact**:
  Massive Protected Health Information (PHI) exposure violating HIPAA, GDPR, and medical confidentiality laws.
- **Blocks Phase 10.2**: **YES**.

---

### Finding CRITICAL-04: Unrestricted Access & Mutation of 115 Branchless Patients
- **Affected File**: [backend/src/common/services/branch-authorization.service.ts](file:///f:/yash/projects/full%20system/ICTHospital/backend/src/common/services/branch-authorization.service.ts#L112-L114), [backend/src/modules/patient/patient.service.ts](file:///f:/yash/projects/full%20system/ICTHospital/backend/src/modules/patient/patient.service.ts#L260-L266)
- **Classification**: **CRITICAL**
- **Description**:
  In `BranchAuthorizationService.assertResourceAccess`:
  ```typescript
  if (!resourceBranchId) {
    return; // Global or unscoped resource
  }
  ```
  And in `PatientService.update`:
  ```typescript
  const existing = await this.findById(idOrPatientId);
  if (user && this.branchAuth && existing.branchId) {
    await this.branchAuth.assertResourceAccess(user, existing.branchId, 'patient');
  }
  ```
  Because all 115 legacy patients have `branchId = NULL`, `existing.branchId` evaluates to falsy, and `assertResourceAccess` returns without performing any check.
- **Reproduction**:
  1. A user from newly created Clinic Beta authenticates.
  2. Sends `PUT /api/v1/patients/1` with payload `{"name": "Tampered Name", "cnic": "99999-9999999-9"}`.
  3. The request succeeds and mutates Patient #1 in Organization #1.
- **Potential Impact**:
  Historical hospital records can be corrupted or overwritten by any user from any tenant.
- **Blocks Phase 10.2**: **YES**.

---

### Finding HIGH-01: Global Admin Cross-Branch Bypass Across Tenants
- **Affected File**: [backend/src/common/guards/branch-access.guard.ts](file:///f:/yash/projects/full%20system/ICTHospital/backend/src/common/guards/branch-access.guard.ts#L76-L114)
- **Classification**: **HIGH**
- **Description**:
  In `BranchAccessGuard`:
  ```typescript
  const isAdmin =
    user.group === 'Admin' ||
    (Array.isArray(user.permissions) &&
      user.permissions.includes(HospitalPermission.BRANCH_VIEW_ALL));

  if (isAdmin) {
    req.activeBranchId = branchIdBigInt;
    req.activeBranch = branch;
    return true;
  }
  ```
  `isAdmin` is true for any Hospital Admin (`user.group === 'Admin'`). `BranchAccessGuard` never checks whether `branch.organizationId === user.organizationId`.
  Therefore, an Admin of Clinic Alpha can supply `x-branch-id: 1` (Main Campus of Medora Hospital) and bypass all branch access barriers.
- **Potential Impact**:
  Tenant admins can operate within competitor hospital facilities.
- **Blocks Phase 10.2**: **YES**.

---

### Finding HIGH-02: Missing Tenant Membership & Status Verification in Authentication
- **Affected File**: [backend/src/modules/auth/auth.service.ts](file:///f:/yash/projects/full%20system/ICTHospital/backend/src/modules/auth/auth.service.ts#L90-L199)
- **Classification**: **HIGH**
- **Description**:
  During login and refresh:
  1. `AuthService` extracts `dbUser.organizationId` directly from the `users` table.
  2. It never queries `user_organization_memberships`. If a user's membership has `isActive: false` or `revokedAt: NOW()`, the user still receives an active, organization-scoped token.
  3. It never queries `organizations.status`. If an organization is marked `SUSPENDED` or `INACTIVE`, users can still log in and issue authenticated transactions.
- **Potential Impact**:
  Suspended organizations continue to consume services; revoked staff retain full system access.
- **Blocks Phase 10.2**: **YES**.

---

### Finding HIGH-03: Global Enumeration in `GET /api/v1/organizations`
- **Affected File**: [backend/src/modules/organization/organization.controller.ts](file:///f:/yash/projects/full%20system/ICTHospital/backend/src/modules/organization/organization.controller.ts#L31-L36)
- **Classification**: **HIGH**
- **Description**:
  `GET /api/v1/organizations` is accessible to both `SuperAdmin` and `Admin`.
  When a Hospital Admin calls this endpoint, `OrganizationService.findAll()` returns the complete directory of all organizations on the platform, exposing legal names, facility types, branch counts, and user counts.
- **Potential Impact**:
  Competitor tenant discovery and infrastructure intelligence disclosure.
- **Blocks Phase 10.2**: **YES**.

---

### Finding MEDIUM-01: Global Unique Constraint Collisions Across Independent Tenants
- **Affected File**: [backend/prisma/schema.prisma](file:///f:/yash/projects/full%20system/ICTHospital/backend/prisma/schema.prisma)
- **Classification**: **MEDIUM**
- **Description**:
  Business identifiers across major entities have database-level global `@unique` constraints rather than compound uniqueness with `organizationId`:
  - `Patient.patientId` (MRN: `000001`)
  - `Admission.admissionNumber` (`ADM-2026-0001`)
  - `InpatientFolio.folioNumber` (`FOL-2026-0001`)
  - `CashierShift.shiftNumber` (`SHIFT-0001`)
  - `CashTransaction.transactionNumber` (`TXN-0001`)
  - `Account.accountCode` (`1010` - Cash)
  - `AccountingPeriod.periodCode` (`FY2026-M01`)
  - `JournalEntry.journalNumber` (`JRN-0001`)
  - `Expense.expenseNumber` (`EXP-0001`)
  - `Department.name` (`General Practice`, `Cardiology`)
- **Potential Impact**:
  Two independent clinics attempting to use standard chart of accounts codes (`1010`) or standard MRN format (`000001`) will collide, throwing unhandled database exception errors.
- **Blocks Phase 10.2**: **NO (Can be sequenced with Phase 10.2 or 10.1.2)**.

---

## 4. Phase 10.2 Readiness Decision

| Audit Category | Status | Evaluation |
|---|---|---|
| **Data Model Foundation** | **COMPLETE** | Models exist, migrations applied, schema valid. |
| **API Authorization** | **FAILED** | Missing tenant ownership checks in `/api/v1/organizations`. |
| **Cross-Tenant Isolation** | **FAILED** | Clinical history, pharmacy batches, and branchless patients leaked. |
| **Auth & Membership** | **FAILED** | No membership revalidation, no suspended organization checks. |
| **Database Integrity** | **PARTIAL** | Foreign keys intact; global unique constraints risk collision. |

### Final Recommendation:
**DO NOT PROCEED TO PHASE 10.2.**
Immediate remediation (Phase 10.1.2) must be undertaken to implement tenant ownership guards and fix CRITICAL-01 through HIGH-03 before any entitlement engine is layered on top.

