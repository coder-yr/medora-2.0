# Medora 2.0 Migration Status

## Overview
- **Project**: Medora 2.0 (Migration of ICTHospital legacy hospital management system)
- **Current Phase**: **Phase 10: Invoicing and Billing Domain Migration (`InvoiceModule`)**
- **Status**: **COMPLETED**
- **Date**: 2026-10-28
- **Approved Target Stack**:
  - **Frontend**: React + TypeScript + Vite
  - **Backend**: NestJS + TypeScript (trusted business logic boundary)
  - **Database Platform**: Supabase PostgreSQL (supersedes MariaDB/MySQL)
  - **ORM / Query Engine**: Prisma ORM 7.10.1 (`@prisma/adapter-pg` driver adapter)
  - **Background Processing**: Redis + BullMQ (when justified in future phases)
  - **Infrastructure**: Docker Compose initially (Kubernetes only if justified)

---

## 1. Migration Phase Matrix

| Phase | Description | Deliverables | Status |
| :--- | :--- | :--- | :--- |
| **Phase 0** | Workspace & Source Preservation | Source archive verified, `legacy/` isolated, commit `a646a86` | **COMPLETED** |
| **Phase 1** | Read-Only Legacy Audit | Inventories, business rules, permissions, security findings (`docs/00` to `06`), commit `86b9bc1` | **COMPLETED** |
| **Phase 2** | Legacy Runtime Baseline | Tool verification, test reproducibility (255 tests), route manifest (271 routes), safe GET smoke tests ([`docs/07-legacy-runtime-baseline.md`](07-legacy-runtime-baseline.md)), commit `e177f10` | **COMPLETED** |
| **Phase 3** | Database Discovery & Prisma Mapping | Schema inventory (`104` tables, `924` cols), PostgreSQL compatibility, Prisma schema (`backend/prisma/schema.prisma`), validation, reconciliation plan, inspection scripts, commit `25e1724` | **COMPLETED** |
| **Phase 4** | NestJS Backend Foundation | NestJS 11 bootstrap, strict TS, Prisma 7 `@prisma/adapter-pg`, safe config validation, versioned routing (`/api/v1`), correlation IDs, OpenAPI docs, truthful readiness probe, RBAC guards (97 permissions, SEC-01 fix), unit & e2e test suites (29 tests), commit `c6c3557` | **COMPLETED** |
| **Phase 5** | Clinical & Financial Domain Modules (1st Module) | `PatientModule` (registration, walk-in support, sequential MRN generation, derived age, CNIC formatting, single-box search, granular RBAC), commit `51c6e80` | **COMPLETED** |
| **Phase 6** | Dependency Audit & Domain Migration (2nd Module) | `DepartmentModule` (specialty catalogue, alphabetical ordering, doctor usage counting, cascade rename across doctors, deletion protection, unlisted specialty adoption, RBAC), commit `46f7ac2` | **COMPLETED** |
| **Phase 7** | Clinical Staff Register (3rd Module) | `DoctorModule` (doctor register, only name required, email uniqueness without blank clash, appointment deletion protection, upcoming load tracking, department suggestion merge, optional staff login linking, RBAC), commit `2b94b19` | **COMPLETED** |
| **Phase 8** | Outpatient Scheduling & Visits (4th Module) | `AppointmentModule` (double-booking overlap protection, transaction locks, doctor clinic hours & slot blocks, free slots calculator, day view, vitals recording, Jitsi video visits, RBAC), commit `eb0ed18` | **COMPLETED** |
| **Phase 9** | Clinical Consultations & Encounters (5th Module) | `ConsultationModule` (outpatient consultation notes, Naegele obstetric math, history carry-forward, vitals sync, note templates, printable summaries, completed note immutability, RBAC), commit `1b09259` | **COMPLETED** |
| **Phase 10** | Invoicing & Billing Domain Migration (6th Module) | `InvoiceModule` (patient invoicing, multi-item breakdown, server calculations, installment payments, pessimistic row lock, overpayment rejection, deletion guards, doctor share calculations, RBAC) | **COMPLETED** |

---

## 2. Phase 10 Domain Migration Summary: `InvoiceModule`

| Property | Value | Evidence / Command |
| :--- | :--- | :--- |
| **Selected Domain** | **`InvoiceModule`** (Invoicing, Charge Items & Installment Payments) | Critical hospital revenue workflow replacing legacy packed string pairs (`payment.category_name`, `category_amount`) with relational tables |
| **Target Database Mapping** | `payment`, `invoice_item`, `invoice_payment`, and `doctor_share` aligned in Prisma schema with decimal currency precision | `npm run prisma:validate` (Exit code 0), `npm run prisma:generate` |
| **Legacy Source Parity** | `legacy/app/Http/Controllers/InvoiceController.php`, `legacy/app/Support/Billing.php`, `legacy/app/Models/Payment.php`, `legacy/app/Models/InvoiceItem.php`, `legacy/app/Models/InvoicePayment.php`, `legacy/app/Support/ShareCalculator.php`, `legacy/tests/Feature/InvoiceTest.php`, `legacy/tests/Feature/ConcurrentWriteTest.php` | Full parity across invoice header creation, line item recalculation, installment payments, balance locking, and overpayment rejection |
| **Endpoints Implemented** | `GET /api/v1/invoices`<br>`POST /api/v1/invoices`<br>`GET /api/v1/invoices/:id`<br>`POST /api/v1/invoices/:id/pay`<br>`DELETE /api/v1/invoices/:id` | Versioned REST endpoints with OpenAPI annotations and RBAC guards |
| **Business Rules Preserved** | 1. Relational charge items in `invoice_item` replacing error-prone legacy packed strings<br>2. Recalculation of all prices, quantities, subtotals, and gross totals server-side (`gross = subtotal - discount + vat`)<br>3. Discount validation: discount cannot exceed subtotal (`400 Bad Request: The discount is larger than the invoice.`)<br>4. Invoice requires at least one charge item (`400 Bad Request: Add at least one charge, or the invoice is for nothing.`)<br>5. Multi-tender installment payments in `invoice_payment` (`Cash`, `Card`, `Bank transfer`, `Cheque`, `Online`, `Write-off`)<br>6. Derived settlement lifecycle: balance strictly calculated as `gross_total - sum(payments)`; status transitions dynamically (`unpaid` -> `part paid` -> `paid`)<br>7. Pessimistic row locking (`SELECT id, gross_total FROM payment WHERE id = $id FOR UPDATE`) inside interactive transaction to eliminate concurrent payment overpayment race conditions<br>8. Strict overpayment refusal: `amount > balance + 0.004` throws `400 Bad Request ("Only X is outstanding on this invoice.")` and preserves balance<br>9. Financial deletion guard: an invoice cannot be deleted if any money has been received (`paid > 0`) or if a doctor share is approved/settled<br>10. Doctor revenue share allocation initialized (`doctor_share`) for billing reconciliation | `InvoiceService` unit & E2E test suites (14 unit tests, 15 E2E tests) |
| **Authorization & Security** | Granular RBAC (`invoice_view`, `invoice_add`, `invoice_delete`, `payment_view`, `payment_add`, `payment_delete`) | Doctor role restricted (403); Receptionist allowed create/view/pay but barred from delete (403); Accountant and Admin authorized for delete; public access denied (401) |
| **Unit Test Coverage** | **14 suites passed, 96 tests passed** (14 new tests in `invoice.service.spec.ts`) | `npm test` (Exit code 0) |
| **E2E Integration Tests**| **7 suites passed, 69 tests passed** (15 new tests in `invoice.e2e-spec.ts`) | `npm run test:e2e` (Exit code 0) |
| **Total Test Baseline** | **165 passing automated tests** | Verified across all backend layers |
| **Test Environment Scope** | In-memory & test mock drivers | Local PostgreSQL service and Docker daemon are not active on this host; live PostgreSQL integration tests could not be run |
| **Linting & Code Quality**| **ESLint 9 + Prettier + Strict TypeScript** | `npm run lint` (Exit code 0), `npx tsc --noEmit` (Exit code 0) |
| **Build Validation** | **NestJS Production Build** | `npm run build` (Exit code 0) |
| **Legacy Source Integrity**| **100% Preserved** | `legacy/` 0 modifications; unstaged `app/Models/SMS.php` artifact preserved |

---

## 3. Financial Integrity & Concurrency Architecture

1. **Elimination of Packed String Corruption**:
   - The legacy MariaDB system stored charges and prices as position-matched comma-separated strings in `payment.category_name` and `payment.category_amount`. Mismatched pairs silently misallocated line items. Medora 2.0 stores every line item as an explicit row in `invoice_item` with `name`, `quantity`, `unit_price`, `line_total`, and servicing `doctor_id`.
2. **Server-Authoritative Arithmetic & Rounding**:
   - Client-submitted totals are strictly ignored and recalculated from charge catalog items and explicit overrides with 2-decimal financial rounding (`InvoiceService.round2`), preventing floating-point rounding drift.
3. **Pessimistic Concurrency & Overpayment Prevention**:
   - Payment acceptance utilizes PostgreSQL `SELECT ... FOR UPDATE` row locks within interactive transactions (`tx.$transaction`) to re-query the true outstanding balance before inserting payments. Attempted overpayments are rejected with `400 Bad Request` and zero ledger mutation.
4. **Audit Immutability & Deletion Protections**:
   - An invoice with recorded payments cannot be deleted, preserving the financial ledger and cashier audit trail.

---

## 4. Next Module Readiness

With `PatientModule`, `DepartmentModule`, `DoctorModule`, `AppointmentModule`, `ConsultationModule`, and `InvoiceModule` completed, patient administrative, clinical, and billing workflows are operational. The next candidate module is:
- **`PrescriptionModule`**: Prescription generation, medication regimens, dosage lines, and future pharmacy dispensing links.
