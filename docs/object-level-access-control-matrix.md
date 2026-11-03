# Medora 2.0 — Object-Level Access Control (OLAC) Matrix

**Document Version:** 1.0.0  
**Phase:** Remediation Stage 1  
**Scope:** Endpoint-by-Endpoint Authorization, Scoping, and Ownership Checks  

---

## 1. Access Control Matrix

| Module | Endpoint / Action | Method | Required Permission / Role | Branch Scoping & Ownership Verification | Unauthorized Response |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Auth** | `/auth/login` | `POST` | Public | None (Global authentication route). | `401 Unauthorized` |
| **Auth** | `/auth/me` | `GET` | Authenticated | `@SkipBranchCheck()` — returns authenticated user context. | `401 Unauthorized` |
| **Auth** | `/auth/change-password` | `POST` | Authenticated | `@SkipBranchCheck()` — updates password for caller identity. | `401 / 400` |
| **Auth** | `/auth/forgot-password` | `POST` | Public | Anti-enumeration generic response. | `200 OK` (Always) |
| **Auth** | `/auth/reset-password` | `POST` | Public | Validates single-use SHA-256 token hash + expiry. | `400 Bad Request` |
| **Patient** | `/patients` | `GET` | `PATIENT_VIEW` | Filters results by caller's accessible branches. | `403 Forbidden` |
| **Patient** | `/patients` | `POST` | `PATIENT_ADD` | Asserts caller membership in target `branchId`. | `403 Forbidden` |
| **Patient** | `/patients/:id` | `GET` | `PATIENT_VIEW` | Asserts caller access to patient's registered branch. | `403 Forbidden` |
| **Patient** | `/patients/:id` | `PUT` | `PATIENT_EDIT` | Asserts caller access to patient's registered branch. | `403 Forbidden` |
| **Patient** | `/patients/:id` | `DELETE`| `PATIENT_DELETE` | Asserts caller access to patient's registered branch. | `403 Forbidden` |
| **Appointment** | `/appointments` | `GET` | `APPOINTMENT_VIEW` | Filters schedule by caller's accessible branch scope. | `403 Forbidden` |
| **Appointment** | `/appointments` | `POST` | `APPOINTMENT_ADD` | Asserts caller membership in target `branchId`. | `403 Forbidden` |
| **Appointment** | `/appointments/:id` | `GET` | `APPOINTMENT_VIEW` | Asserts caller access to `appointment.branchId`. | `403 Forbidden` |
| **Appointment** | `/appointments/:id` | `PUT` | `APPOINTMENT_EDIT` | Asserts caller access to `appointment.branchId`. | `403 Forbidden` |
| **Appointment** | `/appointments/:id` | `DELETE`| `APPOINTMENT_DELETE` | Asserts caller access to `appointment.branchId`. | `403 Forbidden` |
| **Consultation** | `/consultations` | `GET` | `CONSULTATION_VIEW` | Filters encounters via `appointment.branchId`. | `403 Forbidden` |
| **Consultation** | `/consultations/visit/:id` | `GET` | `CONSULTATION_ADD` | Asserts caller access to visit encounter's `branchId`. | `403 Forbidden` |
| **Consultation** | `/consultations/visit/:id` | `POST` | `CONSULTATION_ADD` | Asserts caller access to visit encounter's `branchId`. | `403 Forbidden` |
| **Consultation** | `/consultations/:id` | `GET` | `CONSULTATION_VIEW` | Asserts caller access to linked encounter's `branchId`. | `403 Forbidden` |
| **Consultation** | `/consultations/:id/print` | `GET` | `CONSULTATION_VIEW` | Asserts caller access to linked encounter's `branchId`. | `403 Forbidden` |
| **Invoice** | `/invoices` | `GET` | `INVOICE_VIEW` | Scopes invoice list to caller's authorized branches. | `403 Forbidden` |
| **Invoice** | `/invoices` | `POST` | `INVOICE_ADD` | Asserts caller access to `branchId` (or defaults to home branch). | `403 Forbidden` |
| **Invoice** | `/invoices/:id` | `GET` | `INVOICE_VIEW` | Asserts caller access to `payment.branchId`. | `403 Forbidden` |
| **Invoice** | `/invoices/:id/pay` | `POST` | `PAYMENT_ADD` | Asserts caller access to `payment.branchId`. | `403 Forbidden` |
| **Invoice** | `/invoices/:id` | `DELETE`| `INVOICE_DELETE` | Asserts caller access to `payment.branchId`. | `403 Forbidden` |
| **Cashier** | `/cashier/shifts/open` | `POST` | `CASHIER_SHIFT_OPEN` | Asserts caller membership in target `branchId`. | `403 Forbidden` |
| **Cashier** | `/cashier/shifts` | `GET` | `CASHIER_VIEW` | Restricts non-supervisors to own shifts within authorized branch. | `403 Forbidden` |
| **Cashier** | `/cashier/shifts/:id` | `GET` | `CASHIER_VIEW` | Asserts caller access to `cashierShift.branchId`. | `403 Forbidden` |
| **Cashier** | `/cashier/shifts/:id/close`| `POST` | `CASHIER_SHIFT_CLOSE` | Asserts caller access to `cashierShift.branchId`. | `403 Forbidden` |
| **Cashier** | `/cashier/shifts/:id/approve`| `POST` | `CASHIER_SHIFT_APPROVE`| Asserts caller access to `cashierShift.branchId`. | `403 Forbidden` |
| **Cashier** | `/cashier/day-book` | `GET` | `CASHIER_DAYBOOK_VIEW`| Restricts query to caller's branch; asserts access if supplied. | `403 Forbidden` |
| **Accounting** | `/accounting/reports/trial-balance` | `GET` | `ACCOUNTING_REPORTS_VIEW` | Non-admin defaults to caller's branch; asserts access if supplied. | `403 Forbidden` |
| **Accounting** | `/accounting/reports/profit-loss` | `GET` | `ACCOUNTING_REPORTS_VIEW` | Non-admin defaults to caller's branch; asserts access if supplied. | `403 Forbidden` |
| **Accounting** | `/accounting/reports/balance-sheet` | `GET` | `ACCOUNTING_REPORTS_VIEW` | Non-admin defaults to caller's branch; asserts access if supplied. | `403 Forbidden` |
| **Accounting** | `/accounting/reports/general-ledger/:id` | `GET` | `ACCOUNTING_REPORTS_VIEW` | Non-admin defaults to caller's branch; asserts access if supplied. | `403 Forbidden` |
| **Dashboard** | `/dashboard/branch-comparison` | `GET` | `DASHBOARD_BRANCH_COMPARE` | Filters branches to caller's accessible facilities; masks revenue without `DASHBOARD_FINANCIAL_VIEW`. | `403 Forbidden` |
| **Dashboard** | `/dashboard/operational-alerts` | `GET` | `DASHBOARD_VIEW` | Filters active operational alerts to caller's facility. | `403 Forbidden` |
| **Settings** | `/settings/branding` | `PUT` | `SETTINGS_EDIT` | Restricted to global administrators only. | `403 Forbidden` |
| **Settings** | `/branches/:id/settings` | `PUT` | `SETTINGS_EDIT` | Asserts caller authorization for specified branch. | `403 Forbidden` |
