# Medora 2.0 — Phase 10.1.1: API Security & Cross-Tenant Test Results

## 1. Executive Summary

This report documents the security testing conducted across the Organization API (`/api/v1/organizations`) and clinical/financial operational endpoints.

Testing evaluated authentication integrity, authorization boundaries, object-level access control (BOLA), and cross-tenant data leakage.

---

## 2. Organization API Security Scenarios (`/api/v1/organizations`)

### Test Matrix Summary

| Scenario # | Test Description | Expected Behavior | Actual Behavior | Result | Risk |
|---|---|---|---|---|---|
| **SC-01** | SuperAdmin accessing permitted organizations | 200 OK with full platform directory | 200 OK returned | **PASS** | None |
| **SC-02** | Org Admin accessing their own organization | 200 OK with their organization details | 200 OK returned | **PASS** | None |
| **SC-03** | Org Admin accessing another organization | **403 Forbidden** | **200 OK (Data Leaked)** | **FAIL** | **CRITICAL (BOLA)** |
| **SC-04** | Doctor accessing their own organization | 200 OK with profile/branches | 200 OK returned | **PASS** | None |
| **SC-05** | Doctor accessing another organization | **403 Forbidden** | **200 OK (Data Leaked)** | **FAIL** | **CRITICAL (BOLA)** |
| **SC-06** | User with revoked membership accessing API | **401/403 Denied** | **200 OK (Access Allowed)** | **FAIL** | **HIGH (Auth Bypass)** |
| **SC-07** | User belonging to multiple organizations | Contextual switching supported | Single fixed org returned | **PARTIAL**| Feature Missing |
| **SC-08** | Accessing a SUSPENDED organization | **403 Forbidden (Suspended)** | **200 OK (Active Access)** | **FAIL** | **HIGH (Lifecycle Bypass)** |
| **SC-09** | Unauthenticated requests | 401 Unauthorized | 401 Unauthorized | **PASS** | None |
| **SC-10** | Manipulated org & branch identifiers | 403 Forbidden | Ignored / Bypassed | **FAIL** | **HIGH (Bypass)** |

---

### Detailed Scenario Walkthroughs

#### Scenario SC-03: Organization Admin BOLA Attack
- **Actor**: `admin.alpha@clinic-alpha.com` (`group: 'Admin'`, `organizationId: 2`).
- **Target**: `GET /api/v1/organizations/1/members` (Organization 1 is Medora Main Hospital).
- **Request**:
  ```http
  GET /api/v1/organizations/1/members HTTP/1.1
  Host: localhost:3000
  Authorization: Bearer <Clinic_Alpha_Admin_Token>
  ```
- **Observed Response**:
  ```json
  HTTP/1.1 200 OK
  [
    {
      "id": "1",
      "userId": "1",
      "organizationId": "1",
      "isDefault": true,
      "isActive": true,
      "accessRole": "Staff",
      "user": {
        "id": "1",
        "email": "superadmin.test@medora.hospital",
        "name": "Super Administrator",
        "group": "SuperAdmin"
      }
    },
    {
      "id": "2",
      "userId": "2",
      "organizationId": "1",
      "user": {
        "id": "2",
        "email": "doctor.test@medora.hospital",
        "name": "Test Doctor",
        "group": "Doctor"
      }
    }
  ]
  ```
- **Vulnerability**: Complete roster of Hospital #1's medical and administrative staff dumped to an external clinic administrator.

#### Scenario SC-05: Doctor Cross-Organization Access
- **Actor**: `dr.khan@clinic-alpha.com` (`group: 'Doctor'`, `organizationId: 2`).
- **Target**: `GET /api/v1/organizations/1/branches`
- **Observed Response**:
  `HTTP/1.1 200 OK`: Returns Main Campus and City Branch details, phone numbers, and physical facility data of Hospital #1.

#### Scenario SC-06: Revoked Membership Persistence
- **Action**: Database updated to revoke membership:
  ```sql
  UPDATE user_organization_memberships
  SET is_active = false, revoked_at = NOW()
  WHERE user_id = 3 AND organization_id = 1;
  ```
- **Test**: User logs in via `/api/v1/auth/login`.
- **Observed Response**:
  `HTTP/1.1 200 OK`: JWT issued with `organizationId: 1`. The user can continue making authenticated requests. `auth.service.ts` never queried `user_organization_memberships`.

#### Scenario SC-08: Suspended Tenant Access
- **Action**: Database updated to suspend Organization #2:
  ```sql
  UPDATE organizations SET status = 'SUSPENDED' WHERE id = 2;
  ```
- **Test**: Admin of Organization #2 issues `GET /api/v1/organizations/2/settings`.
- **Observed Response**:
  `HTTP/1.1 200 OK`: Full settings returned. No 403 Suspended error thrown.

---

## 3. Cross-Tenant Operational & Clinical Isolation Tests

### 3.1. Patient Access & Mutation
- **Test**: Doctor in Organization 2 issues `GET /api/v1/patients/1` (Patient #1 registered in Organization 1).
- **Result**: `200 OK`. Full demographics, medical history, CNIC, and phone number returned.
- **Test**: Doctor in Organization 2 issues `PUT /api/v1/patients/1` with modified address and phone.
- **Result**: `200 OK`. Historical patient record in Organization 1 successfully altered.

### 3.2. Clinical Consultations & Prescriptions
- **Test**: Doctor in Organization 2 accesses `GET /api/v1/consultations/visit-context?patientId=1`.
- **Result**: `200 OK`. Returns previous 5 clinical consultation notes, past medical history, and clinical diagnoses written by doctors in Organization 1.

### 3.3. Invoices & Billing
- **Test**: Cashier in Organization 2 issues `GET /api/v1/invoices/1`.
- **Result**: `200 OK`. Full patient billing details and outstanding balances returned.

### 3.4. Pharmacy Stock & Batch Deductions
- **Test**: Pharmacist in Organization 2 dispenses 10 units of Amoxicillin from Batch #1.
- **Result**: `200 OK`. `MedicineBatch.currentQuantity` in database decremented from 100 to 90.
- **Verification**: When Pharmacist in Organization 1 inspects inventory, the quantity is also reduced to 90, demonstrating that **stock is not isolated between tenants**.

### 3.5. Accounting & Chart of Accounts
- **Test**: Accountant in Organization 2 attempts to create GL Account code `1010` (Cash on Hand).
- **Result**: `409 Conflict / 500 Error`. Unique constraint violation on `accounting_account_account_code_key` because Organization 1 already created code `1010`.

---

## 4. Evaluation of `@SkipBranchCheck()`

In Phase 10.1, `@SkipBranchCheck()` was attached to `OrganizationController`:
```typescript
@ApiTags('Organizations')
@ApiBearerAuth('JWT')
@Controller('organizations')
@UseGuards(JwtAuthGuard, RolesGuard)
@SkipBranchCheck()
export class OrganizationController { ... }
```

### Architectural Flaw:
`@SkipBranchCheck()` instructs `BranchAccessGuard` to return `true` immediately without evaluating `x-branch-id` or checking branch assignments. While this is correct for operations above the branch level, **no corresponding `OrganizationAccessGuard` or tenant ownership check was implemented to replace it.**

As a result:
- The branch guard is turned off.
- The role guard (`RolesGuard`) only checks `['SuperAdmin', 'Admin']`, which is satisfied by any admin on the platform.
- The endpoints operate with zero object-level tenancy checks.

