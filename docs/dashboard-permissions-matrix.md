# Medora 2.0 — Dashboard Permissions Matrix

## 1. Dashboard Specific Permissions
The following granular permissions govern access to dashboard segments and metrics:

| Permission Enum Value | Label | Scope | Roles Granted by Default |
| :--- | :--- | :--- | :--- |
| `dashboard_view` | View Operational Dashboard | Basic dashboard container, operational counters, and workload | Admin, Doctor, Receptionist, Accountant, Pharmacist, Laboratorist |
| `dashboard_financial_view`| View Financial Analytics | Revenue, cash collections, accounts receivable, and net margins | Admin, Accountant |
| `dashboard_branch_compare`| View Multi-Branch Comparison | Hospital-wide comparative metrics across branches | Admin |
| `dashboard_alerts_manage` | Manage Operational Alerts | Acknowledge or act on system-wide alerts | Admin, Accountant |

---

## 2. Role-Based Visibility Rules

| Dashboard Widget | Administrator | Doctor | Receptionist | Pharmacist | Laboratorist | Accountant |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Header KPI Strip (Patients, Occupancy)** | Full | Own Specialty | Front Desk | Restricted | Restricted | Summary |
| **Financial KPIs (Revenue, Cash Collections, AR)** | Full | Hidden (403) | Hidden (403) | Hidden (403) | Hidden (403) | Full |
| **Appointments & Waiting Room** | Full | My Appointments | Today's Desk | Hidden | Hidden | Hidden |
| **Inpatient Bed Status** | Full | Assigned Wards | Bed Availability| Hidden | Hidden | Hidden |
| **Pharmacy Inventory & Expiry** | Full | Formularies Only | Hidden | Full Inventory| Hidden | Hidden |
| **Diagnostic Requisitions (LIS/RIS)** | Full | My Orders | Hidden | Hidden | Diagnostic Workbench| Hidden |
| **Multi-Branch Comparisons** | Allowed | Hidden (403) | Hidden (403) | Hidden (403) | Hidden (403) | Allowed if permitted |
| **Notification Infrastructure Status** | Full | Hidden | Hidden | Hidden | Hidden | Hidden |
