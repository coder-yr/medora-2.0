# Medora 2.0 — Frontend Architecture & Component Hierarchy

## 1. Executive Summary

Medora 2.0 Frontend is a unified, responsive Single Page Application (SPA) built with React 19, TypeScript, Vite, and Lucide React. It provides complete operational interfaces across all 18 migrated hospital domains, eliminating legacy disparate PHP views and unifying clinical, diagnostic, inpatient, and financial workflows under a zero-trust, multi-branch application shell.

---

## 2. Component Architecture & Workspace Layout

The application employs a categorized sidebar architecture with a global topbar and dynamic module rendering:

```
App (frontend/src/App.tsx)
 ├── Authentication Gate (Renders LoginView if unauthenticated)
 ├── Application Shell Layout (.medora-layout)
 │    ├── Responsive Collapsible Sidebar (.medora-sidebar)
 │    │    ├── Brand Header (Medora 2.0 + Hospital Logo)
 │    │    ├── Navigation Categories:
 │    │    │    ├── Clinical Operations:
 │    │    │    │    ├── Executive Dashboard (DashboardWorkspace)
 │    │    │    │    ├── Patient Registry (PatientWorkspace)
 │    │    │    │    ├── Appointments & Visits (AppointmentWorkspace)
 │    │    │    │    ├── Doctor Consultation (ConsultationWorkspace)
 │    │    │    │    └── Prescriptions Rx (PrescriptionWorkspace)
 │    │    │    ├── Diagnostics & Pharmacy:
 │    │    │    │    ├── Pharmacy & Inventory (PharmacyWorkspace)
 │    │    │    │    ├── Medicine Catalogue (MedicineCatalogue)
 │    │    │    │    ├── Laboratory LIS (LaboratoryWorkspace)
 │    │    │    │    └── Radiology RIS (RadiologyWorkspace)
 │    │    │    ├── Inpatient & Billing:
 │    │    │    │    ├── Inpatient IPD (InpatientWorkspace)
 │    │    │    │    ├── Cashier & Shifts POS (CashierWorkspace)
 │    │    │    │    └── Invoices & Billing (BillingWorkspace)
 │    │    │    └── Hospital Administration:
 │    │    │         ├── Medical Consultants (DoctorWorkspace)
 │    │    │         ├── Departments & Specialties (DepartmentWorkspace)
 │    │    │         ├── Staff & HR Directory (StaffWorkspace)
 │    │    │         ├── General Accounting & COA (AccountingWorkspace)
 │    │    │         ├── Hospital Settings & Branches (SettingsWorkspace)
 │    │    │         └── Notifications & Outbox (NotificationAdminWorkspace)
 │    │    └── User Profile Pill & Sign-Out Action
 │    └── Main Workspace Container (.medora-main)
 │         ├── Topbar (.medora-topbar)
 │         │    ├── Module Breadcrumb / Title
 │         │    ├── Active Branch Switcher (Validated against user membership)
 │         │    ├── Live Notification Bell (NotificationCenter)
 │         │    ├── Dev Persona Switcher (Development mode only)
 │         │    └── Password Management Trigger (ChangePasswordModal)
 │         └── Active Workspace Router (.medora-content-area)
 └── Modals & Overlays:
      ├── ChangePasswordModal
      ├── Print Prescriptions / Invoices / Clinical Summary Slips
      └── Cross-module Workflow Triggers
```

---

## 3. Core Feature Workspaces

### 3.1 Authentication & Security (`src/features/auth`)
- **`LoginView.tsx`**: Staff sign-in with work email and password, password visibility toggling, brute-force lockout detection and warnings, "Forgot Password" modal, and one-click persona selection in dev mode.
- **`ChangePasswordModal.tsx`**: Authenticated staff password change with length and matching validation, interacting with `POST /api/v1/auth/change-password`.

### 3.2 Clinical Operations
- **`DashboardWorkspace.tsx`**: Executive overview displaying clinical revenue, OPD visits, bed occupancy, doctor workloads, operational alerts, and multi-branch comparative analytics.
- **`PatientWorkspace.tsx`**: Central patient directory featuring single-box debounce search (matching MRN, name, CNIC, phone, email), sequential MRN display, complete registration modal, patient detail drawer, and quick-action shortcuts ("Book Appointment", "Raise Invoice").
- **`AppointmentWorkspace.tsx`**: Daily outpatient clinic calendar with date, doctor, and status filters, live slot calculation against doctor schedules via `/api/v1/appointments/free-slots`, appointment booking modal, check-in state transitions, and telemedicine integration.
- **`ConsultationWorkspace.tsx`**: Clinical encounter workspace loading carry-forward allergies, past consultations, and note templates. Integrates vitals triage, physical exam notes, provisional/final diagnoses, treatment plans, follow-up scheduling, medicine catalogue formulary search, and printable encounter summary.
- **`PrescriptionWorkspace.tsx`**: Form for issuing outpatient prescriptions with medicine catalog search, dosage, frequency, duration, and instructions. Eliminates all hardcoded IDs (`patientId = '1'`, `doctorId = '1'`), and provides printable prescription slips with doctor signature blocks.

### 3.3 Financial & Operational
- **`BillingWorkspace.tsx`**: Invoicing and revenue tracking with status filters (`all`, `outstanding`, `settled`). Provides itemized charge builder, real-time subtotal/discount/VAT calculation, installment payment modal (`POST /api/v1/invoices/:id/pay`), and official printable receipts.
- **`DoctorWorkspace.tsx`**: Roster of hospital medical consultants with department badges, contact info, upcoming appointment loads, and portal account status.
- **`DepartmentWorkspace.tsx`**: Department catalog with doctor counts and uncatalogued specialty auto-adoption (`POST /api/v1/departments/adopt`).

---

## 4. Multi-Branch Context & Zero-Trust State Management

1. **Server Validation**: The frontend queries `GET /api/v1/branches/my-branches` on session start.
2. **Persistence**: The active branch is persisted in `localStorage.getItem('medora_active_branch')`. If the stored ID does not belong to the user's permitted branches, the client falls back to the user's primary assigned branch.
3. **Propagation**: The active `branchId` is passed down to all workspaces and included in patient registration, appointment scheduling, invoice creation, and dashboard telemetry.
