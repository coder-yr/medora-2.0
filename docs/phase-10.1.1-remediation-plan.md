# Medora 2.0 — Phase 10.1.1: Tenant Isolation Remediation Plan

## 1. Executive Summary

This remediation plan establishes the precise, prioritized actions required to fix the multi-tenancy vulnerabilities discovered during the **Phase 10.1.1 Tenant Isolation Audit**.

To preserve system stability, existing hospital records, and uninterrupted single-hospital workflows, remediation is structured into three phases:
- **Phase 10.1.2: Immediate Security Patches (Narrowly Scoped, Non-Breaking)**
- **Phase 10.1.3: Operational & Clinical Domain Scoping**
- **Phase 10.1.4: Multi-Tenant Constraint Hardening & Organization Switching**

---

## 2. Priority 1: Immediate Security Patches (Phase 10.1.2)

These fixes address the **CRITICAL-01**, **HIGH-01**, and **HIGH-02** vulnerabilities without requiring schema migrations or breaking existing frontend contracts:

### 1. Enforce Tenant Object-Level Authorization in `OrganizationController`
- **File**: `backend/src/modules/organization/organization.controller.ts`
- **Fix**:
  Implement an `assertTenantAccess(user: AuthUser, targetOrgId: string)` helper or an `OrganizationAccessGuard`:
  - `SuperAdmin`: Allowed cross-tenant access for platform administration.
  - Non-SuperAdmin (`Admin`, `Doctor`, etc.): Blocked with `403 Forbidden` unless `String(user.organizationId) === String(targetOrgId)`.
  - In `findAll`: Non-SuperAdmin users only receive their own organization in the array, preventing competitor enumeration.

```typescript
private assertTenantAccess(user: AuthUser, targetOrgId: string | number | bigint) {
  if (user.group === 'SuperAdmin') return;
  if (!user.organizationId || String(user.organizationId) !== String(targetOrgId)) {
    throw new ForbiddenException('Cross-organization access denied. You do not belong to this organization.');
  }
}
```

### 2. Close Global Admin Cross-Organization Bypass in `BranchAccessGuard`
- **File**: `backend/src/common/guards/branch-access.guard.ts`
- **Fix**:
  Ensure that `isAdmin` only grants bypass **within the user's assigned organization**:
  ```typescript
  // Verify that branch belongs to user's active organization (unless SuperAdmin)
  if (user.group !== 'SuperAdmin' && user.organizationId) {
    if (branch.organizationId && branch.organizationId !== user.organizationId) {
      throw new ForbiddenException(
        `Cross-organization access denied. Branch "${branch.name}" belongs to an external organization.`,
      );
    }
  }
  ```

### 3. Validate Membership & Organization Status in `AuthService`
- **File**: `backend/src/modules/auth/auth.service.ts`
- **Fix**:
  In both `login` and `refresh`:
  1. Check `Organization.status`: If `TRIAL` expired or `SUSPENDED`/`INACTIVE`, throw `ForbiddenException('Your healthcare organization subscription is currently suspended.')`.
  2. Query `UserOrganizationMembership`: Verify that the user has an active membership (`isActive: true`, `revokedAt: null`) for their `organizationId`. If revoked, invalidate the session and throw `UnauthorizedException`.

---

## 3. Priority 2: Operational & Clinical Domain Scoping (Phase 10.1.3)

These enhancements isolate clinical and operational records across independent organizations:

### 1. Isolate Pharmacy Inventory Batches
- **Schema Migration**:
  Add `organizationId BigInt?` and `branchId BigInt?` to `medicine_batch`.
  Backfill existing batches with `organization_id = 1`.
  Scope all dispensing, FEFO lookups, and stock movements by `branch.organizationId`.

### 2. Scope Patient Queries & Guard Legacy Records
- **File**: `backend/src/modules/patient/patient.service.ts`
- **Fix**:
  - In `findAll`: When `query.branchId` is omitted, filter patients by `branch.organizationId === user.organizationId` (or creator user's organization).
  - In `assertResourceAccess`: When `resourceBranchId` is NULL (legacy patients), verify that `user.organizationId === 1` (the owner organization of all historical legacy data), preventing newly onboarded clinics from touching legacy patients.

### 3. Scope Clinical Consultations & Prescriptions
- **File**: `backend/src/modules/consultation/consultation.service.ts`
- **Fix**:
  Add `branchId` or `organizationId` foreign keys to `Consultation` and `Prescription`.
  Filter visit context and prior consultation histories to only show consultations conducted within the active organization or explicit referral network.

---

## 4. Priority 3: Multi-Tenant Constraint Hardening (Phase 10.1.4)

To prevent collision errors as multiple independent clinics scale:

1. **Compound Unique Constraints**:
   Replace global unique constraints with compound organization-scoped unique constraints in Prisma schema:
   - `@@unique([organizationId, patientId])` (MRN)
   - `@@unique([organizationId, admissionNumber])`
   - `@@unique([organizationId, accountCode])`
   - `@@unique([organizationId, shiftNumber])`
   - `@@unique([organizationId, name])` (Departments)
2. **Organization Switching Endpoint**:
   Implement `POST /api/v1/auth/switch-organization` with payload `{ organizationId: string }`:
   - Validates that user has an active `UserOrganizationMembership` in target organization.
   - Issues a new short-lived access token scoped to the selected organization.

---

## 5. Phase 10.2 Sequencing & Gatekeeper Checklist

```
[Phase 10.1: Foundation Delivered]
             │
             ▼
[Phase 10.1.1: Security Audit Completed] ──► (VERDICT: BLOCKED)
             │
             ▼
[Phase 10.1.2: Immediate Security Patches]
   ├── Fix 1: OrganizationController BOLA check
   ├── Fix 2: BranchAccessGuard tenant isolation
   └── Fix 3: AuthService membership & suspension check
             │
             ▼
[Verify Zero Regression on Single-Hospital Workflows]
             │
             ▼
[UNBLOCK Phase 10.2: Feature Entitlements & Subscription Tiers]
```

### Gatekeeper Checklist for Phase 10.2:
- [ ] Non-SuperAdmin users cannot access `/api/v1/organizations/:id` belonging to other organizations.
- [ ] Hospital Admins cannot bypass into branches of other organizations via `x-branch-id`.
- [ ] Users in suspended organizations cannot log in or refresh tokens.
- [ ] Users with revoked memberships cannot authenticate.
- [ ] Historical 115 branchless patients cannot be updated by external organizations.
- [ ] All 33 Jest unit test suites pass (347/347).
- [ ] All 4 regression test suites pass (147/147 assertions).

