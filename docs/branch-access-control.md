# Branch Access Control & Server-Side Enforcement
## Medora 2.0 — Phase 21 Specification

### 1. Security Threat Model & Legacy Vulnerabilities
In the legacy Laravel implementation:
- Branch selection was purely handled by session storage (`session(['branch_id' => $id])`).
- Users with `users.branch_id === null` were implicitly treated as global administrators who could switch to any branch id provided in the request without server-side validation.
- Users could forge branch contexts, view patients or cash drawers of another facility by manipulating request parameters, or access inactive branches.

### 2. Medora 2.0 Security Architecture
Medora 2.0 establishes a strict **zero-trust, server-enforced branch access model**:

```
Client Request
      │
      ▼
┌────────────────────────────┐
│   JwtAuthGuard             │ Validates Bearer token & attaches req.user
└─────────────┬──────────────┘
              │
              ▼
┌────────────────────────────┐
│   PermissionsGuard         │ Checks endpoint required permissions (e.g. BRANCH_VIEW)
└─────────────┬──────────────┘
              │
              ▼
┌────────────────────────────┐
│   BranchAccessGuard        │ 1. Extracts branch target (X-Branch-Id header, query, or param)
│                            │ 2. Validates branch exists and active == true
│                            │ 3. Verifies user authorization:
│                            │    - Admin role OR BRANCH_VIEW_ALL grant -> ALLOW
│                            │    - User has active UserBranchMembership -> ALLOW
│                            │    - User.branchId == targetBranchId -> ALLOW
│                            │    - Otherwise -> 403 Forbidden ("Cross-branch access denied")
└─────────────┬──────────────┘
              │
              ▼
      Endpoint Execution (req.activeBranchId available via @ActiveBranch())
```

---

### 3. Server-Side Context Resolution Order
When resolving the active branch for an incoming HTTP request, the backend extracts the branch identifier using the following priority:

1. **`X-Branch-Id` HTTP Header**: The primary standard for API clients, SPAs, and microservices.
2. **`branchId` Query Parameter**: Used in specific export or reporting endpoints (e.g. `GET /api/v1/invoices?branchId=2`).
3. **`branchId` / `id` Route Param**: Used in branch-scoped management routes (e.g. `GET /api/v1/branches/:id/settings`).
4. **`req.user.branchId`**: The default fallback tied to the authenticated user's home branch profile.

If none of the above are provided, and the user is an `Admin` or has `BRANCH_VIEW_ALL`, the request operates either in global mode (if supported by the endpoint) or targets the default institution branch (`MAIN`). For non-admin users without a branch specified, the request defaults to their primary `user.branchId`.

---

### 4. Branch Membership Lifecycle & Multi-Branch Staff
A staff member (e.g. a traveling radiologist, roaming specialist doctor, or auditor) can be assigned to multiple branches simultaneously via `UserBranchMembership`:

- **Membership Record Attributes**:
  - `userId`: User account identifier.
  - `branchId`: Branch identifier.
  - `isDefault`: Boolean indicating the user's primary/default operational branch.
  - `isActive`: Boolean flag; deactivated memberships immediately block access to that branch without deleting historical associations.
  - `assignedAt` & `assignedById`: Audit trail of who granted branch access.
  - `revokedAt` & `revokedById`: Timestamp and administrator who revoked access.
- **Access Rule Matrix**:
  | Role / User Category | Permitted Branches | Branch Switching Policy | Inactive Branch Behavior |
  | :--- | :--- | :--- | :--- |
  | **System Admin** | All active branches | Can switch to any branch at any time | Cannot operate on inactive branches unless re-activating |
  | **Multi-Branch Doctor / Staff** | Only branches with `isActive = true` membership | Can switch between explicitly assigned active branches | Blocked with 403 Forbidden if switching to unassigned or inactive branch |
  | **Single-Branch Staff** | Exactly one branch (`user.branchId` or sole membership) | Locked to assigned branch; header tampering rejected | Blocked with 403 Forbidden if attempting cross-branch access |

---

### 5. Inactive Branch Isolation
When a branch is deactivated (`active = false`):
1. **Immediate API Blockade**: `BranchAccessGuard` rejects all requests targeting the inactive branch with `403 Forbidden: "Branch is inactive"`.
2. **Read-Only Administrative Review**: System administrators with `BRANCH_UPDATE` permission can view inactive branch metadata and audit logs for historical/reporting purposes, but cannot record new transactions, admissions, or cashier shifts.
3. **Cashier & Shift Protection**: Any open cashier shifts or unposted transactions on that branch must be closed or reconciled prior to deactivation.
