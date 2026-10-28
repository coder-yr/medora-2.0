# Medora 2.0 — Legacy Business Rules & Domain Logic

## 1. Executive Summary
This document provides a comprehensive audit of all critical business rules, calculation algorithms, concurrency guards, and domain workflows discovered in the legacy ICTHospital codebase (`legacy/app/`, `legacy/app/Support/`, `legacy/routes/`, and `legacy/tests/Feature/`).

Every rule is classified with its:
- **Source Implementation**: Concrete file and line references in `legacy/`.
- **Verified Behavior**: Confirmed behavior tested by automated feature tests.
- **Source-Level Inference**: Inferred intent where unit tests are indirect or absent.
- **Migration & NestJS/Prisma Guidance**: Implementation requirements for Medora 2.0.

---

## 2. Invoicing, Balance & Settlement (`Billing` & `InvoiceController`)

### Source References
- Implementation: [`legacy/app/Support/Billing.php`](../legacy/app/Support/Billing.php), [`legacy/app/Http/Controllers/InvoiceController.php`](../legacy/app/Http/Controllers/InvoiceController.php)
- Tests: [`legacy/tests/Feature/InvoiceTest.php`](../legacy/tests/Feature/InvoiceTest.php), [`legacy/tests/Feature/ConcurrentWriteTest.php`](../legacy/tests/Feature/ConcurrentWriteTest.php)

### Verified Business Rules
1. **Invoice Subtotal & Line Item Calculation**:
   - `line_total = round(unit_price * quantity, 2)`
   - `subtotal = sum(line_total)`
   - Line unit prices default to `PriceList::priceFor($service, $patientTypeId, $setting)` where setting is either `'opd'` (outpatient) or `'ipd'` (inpatient).
2. **Discount & VAT Computation**:
   - Discount validation: Discount cannot exceed subtotal (`$discount <= $subtotal`).
   - Gross total: `gross_total = round(subtotal - discount + vat, 2)`.
   - Floating-point calculations are formatted to 2 decimal places using `number_format($val, 2, '.', '')`.
3. **Settlement Status State Machine**:
   - Invoices maintain a derived balance: `balance() = gross_total - sum(invoice_payment.amount)`.
   - Settlement statuses:
     - `paid`: `balance() <= 0.004` (using 0.004 epsilon for floating-point safety).
     - `part paid`: `paid > 0 && balance() > 0.004`.
     - `unpaid`: `paid == 0`.
4. **Overpayment Refusal**:
   - Any payment transaction where `amount > balance() + 0.004` is rejected with `ValidationException`. Overpayments are never permitted.
5. **Concurrency & Atomicity**:
   - Adding a payment takes an exclusive row lock (`lockForUpdate()`) on the `payment` row within `DB::transaction()` to prevent concurrent payments from double-settling an invoice.
6. **Deletion Guard**:
   - An invoice cannot be deleted if any payment has been recorded (`paid() > 0`) or if any doctor revenue share on the invoice is in `approved` or `paid` status.

---

## 3. Doctor Revenue Share (`ShareCalculator` & `DoctorShareController`)

### Source References
- Implementation: [`legacy/app/Support/ShareCalculator.php`](../legacy/app/Support/ShareCalculator.php), [`legacy/app/Http/Controllers/DoctorShareController.php`](../legacy/app/Http/Controllers/DoctorShareController.php)
- Tests: [`legacy/tests/Feature/DoctorShareTest.php`](../legacy/tests/Feature/DoctorShareTest.php)

### Verified Business Rules
1. **Share Base Calculation**:
   - The share base represents net revenue collected by the hospital for each line:
     $$\text{line\_base} = \text{round}\left(\text{line\_total} - \text{invoice\_discount} \times \left(\frac{\text{line\_total}}{\text{subtotal}}\right), 2\right)$$
   - **Taxes (VAT) are strictly excluded** from revenue sharing.
2. **Performing vs. Referring Roles**:
   - **Performing Doctor**: Assigned directly on the invoice line item (`invoice_item.doctor_id`), falling back to the invoice header doctor (`payment.doctor`).
   - **Referring Doctor**: Set on the invoice header (`payment.referring_doctor`). Only receives a share if distinct from the performing doctor.
3. **Rule Priority Scoring Engine (`ShareRule::score`)**:
   - A doctor's policy contains multiple rules. Matching selects the rule with the highest specificity score:
     - Specific `payment_category_id` match: **+4 points**
     - Specific `department` match: **+2 points**
     - Specific `patient_type_id` match: **+1 point**
     - General catch-all rule (all null): **0 points**
   - The rule with the highest total score is selected.
4. **Approval & Payout Lifecycle**:
   - Created in `pending` status.
   - **Approval Prerequisite**: A share can **only** be approved if the parent invoice is paid in full (`balance <= 0.004`).
   - **Payout Batching**: Payout aggregates approved shares by doctor, issues an expense entry in `accounting` under sector `'Doctor share'`, and updates shares to `paid` status with a unique payout reference (`PAYOUT-YYYYMMDDHHmm`).
   - Once approved or paid, shares are immutable and protected from recalculation.

---

## 4. Appointment Availability & Double-Booking Guards (`DoctorSchedule` & `AppointmentController`)

### Source References
- Implementation: [`legacy/app/Support/DoctorSchedule.php`](../legacy/app/Support/DoctorSchedule.php), [`legacy/app/Http/Controllers/AppointmentController.php`](../legacy/app/Http/Controllers/AppointmentController.php)
- Tests: [`legacy/tests/Feature/AppointmentTest.php`](../legacy/tests/Feature/AppointmentTest.php), [`legacy/tests/Feature/ConcurrentWriteTest.php`](../legacy/tests/Feature/ConcurrentWriteTest.php)

### Verified Business Rules
1. **Double-Booking Overlap Guard**:
   - A doctor cannot hold two overlapping appointments.
   - Overlap condition:
     $$\text{existing.s\_time} < \text{new.e\_time} \quad \text{AND} \quad \text{existing.e\_time} > \text{new.s\_time}$$
   - Cancelled and no-show appointments are excluded.
   - Touching boundaries do not clash (e.g. `09:00-09:15` and `09:15-09:30` are allowed).
   - Concurrency: Checked inside `DB::transaction()` with pessimistic row lock (`lockForUpdate()`).
2. **Doctor Clinic Hours & Leave Blocks**:
   - If a doctor has active weekly slots in `doctor_slot`, bookings must fall entirely within a slot window for that day of the week.
   - If a doctor has no slots configured, they can be booked at any time (backwards compatibility).
   - Date blocks in `slot_block` (e.g., leave, half-day) block bookings regardless of slot configuration.
3. **Appointment Status Progression**:
   - `scheduled` $\rightarrow$ `arrived` $\rightarrow$ `in consultation` $\rightarrow$ `completed`
   - Terminal cancellation states: `cancelled`, `no show`.
4. **Telemedicine Room Generation**:
   - For video appointments (`mode = 'video'`), a cryptographically random Jitsi room is generated:
     `icthospital-` + 24-character random hex string (`bin2hex(random_bytes(12))`).
   - Once generated, room IDs are persisted and never regenerated on edits, ensuring patient links remain valid.

---

## 5. Bed Allocation & Ward Occupancy (`AdmissionController`)

### Source References
- Implementation: [`legacy/app/Http/Controllers/AdmissionController.php`](../legacy/app/Http/Controllers/AdmissionController.php)
- Tests: [`legacy/tests/Feature/AdmissionTest.php`](../legacy/tests/Feature/AdmissionTest.php)

### Verified Business Rules
1. **Single Source of Truth**:
   - Bed occupancy is determined exclusively by `alloted_bed` where `d_time IS NULL`.
   - The static `bed.status` column is maintained as a cache but is never trusted as the authority.
2. **Mutual Exclusivity Constraints**:
   - A bed holds at most **one** patient at a time (`alloted_bed.occupied()->where('bed_id', $id)`).
   - A patient can be admitted to at most **one** bed at a time (`alloted_bed.occupied()->where('patient', $id)`).
   - Validated atomically under `lockForUpdate()`.
3. **Discharge Workflow**:
   - Discharge records `d_time = now()`. The bed immediately becomes available for re-allocation.

---

## 6. Patient ID Allocation & Demographic Governance (`PatientController`)

### Source References
- Implementation: [`legacy/app/Http/Controllers/PatientController.php`](../legacy/app/Http/Controllers/PatientController.php)
- Tests: [`legacy/tests/Feature/PatientTest.php`](../legacy/tests/Feature/PatientTest.php), [`legacy/tests/Feature/ConcurrentWriteTest.php`](../legacy/tests/Feature/ConcurrentWriteTest.php)

### Verified Business Rules
1. **Sequential Patient ID Generation**:
   - IDs are 6-digit zero-padded sequential numbers (`000001`, `000002`, ...).
   - Generated by taking the maximum numeric ID under row lock:
     ```sql
     SELECT MAX(CAST(patient_id AS UNSIGNED)) AS n FROM patient FOR UPDATE;
     ```
   - Derived from the highest numeric ID rather than table count, ensuring deletions never cause collision.
2. **Flexible Walk-in Validation**:
   - Only `name` is strictly required. Front-desk walk-ins lacking CNIC, phone, email, or DOB can be registered to prevent staff from entering bogus workaround data.
3. **Biometric & Photo Acquisition**:
   - Supports direct webcam capture sent as Base64 data URL (`data:image/jpeg;base64,...`) and standard multipart file uploads. Stored in public disk under `patients/{hash}.(jpg|png)`.
4. **Barcode Generation**:
   - Code-128 barcode generated via `Picqer\Barcode\BarcodeGeneratorPNG` formatted as base64 data URI for wristband and patient card printing.

---

## 7. Pharmacy Inventory & Dispensing (`PharmacyController`)

### Source References
- Implementation: [`legacy/app/Http/Controllers/PharmacyController.php`](../legacy/app/Http/Controllers/PharmacyController.php)
- Tests: [`legacy/tests/Feature/PharmacyTest.php`](../legacy/tests/Feature/PharmacyTest.php), [`legacy/tests/Feature/ConcurrentWriteTest.php`](../legacy/tests/Feature/ConcurrentWriteTest.php)

### Verified Business Rules
1. **Transactional Stock Depletion**:
   - Dispensing creates sale line items in `pharmacy_sale_item` and decrements `medicine.quantity` within the **same database transaction**.
   - If stock is insufficient, the transaction rolls back cleanly with a validation exception.
2. **Prescription Pre-loading**:
   - Dispensing counter allows pre-filling drugs, dosages, and patient identity directly from a prescription ID.

---

## 8. Multi-Tier Price Lists & Service Pricing (`PriceList` & `PricingController`)

### Source References
- Implementation: [`legacy/app/Support/PriceList.php`](../legacy/app/Support/PriceList.php), [`legacy/app/Http/Controllers/PricingController.php`](../legacy/app/Http/Controllers/PricingController.php)
- Tests: [`legacy/tests/Feature/PricingTest.php`](../legacy/tests/Feature/PricingTest.php), [`legacy/tests/Feature/ServicePriceListTest.php`](../legacy/tests/Feature/ServicePriceListTest.php)

### Verified Business Rules
1. **Price Lookup Hierarchy**:
   - Step 1: Look up `service_price` for the specific `patient_type_id` and care setting (`opd_price` or `ipd_price`).
   - Step 2: If no custom price is set, fall back to the service list price (`payment_category.c_price`).
2. **Patient Type Categories**:
   - Types: `general`, `panel` (corporate insurance), `charity`, `online`.
   - Deactivating a patient type preserves historical invoices and prevents new selection.
3. **Bulk Price Adjustments**:
   - Supports cloning a full price list from one patient type to another.
   - Supports bulk percentage updates across an entire price schedule.

---

## 9. Cashier Shift Closing & Reconciliation (`CashController` & `PaymentModes`)

### Source References
- Implementation: [`legacy/app/Support/PaymentModes.php`](../legacy/app/Support/PaymentModes.php), [`legacy/app/Http/Controllers/CashController.php`](../legacy/app/Http/Controllers/CashController.php)
- Tests: [`legacy/tests/Feature/CashTest.php`](../legacy/tests/Feature/CashTest.php)

### Verified Business Rules
1. **Payment Buckets**:
   - Flexible text parsing categorizes payments into 5 canonical buckets: `cash`, `bank_transfer`, `card`, `cheque`, `other`.
   - `Write-off` entries settle invoice balances but are strictly excluded from cash collection totals.
2. **Shift Close Balancing**:
   - Cashiers reconcile open unclosed payments by submitting physical counts.
   - Difference is tracked as `discrepancy = counted_cash - expected_cash`.
   - Once closed, payment records are linked to the `shift_close_id` and locked from re-closing.
   - Users with `cash_close_all_users` permission can inspect and close shifts on behalf of any cashier.

---

## 10. Laboratory Workflow & Diagnostic Orders (`LabOrder` & `LabController`)

### Source References
- Implementation: [`legacy/app/Support/LabOrder.php`](../legacy/app/Support/LabOrder.php), [`legacy/app/Http/Controllers/LabController.php`](../legacy/app/Http/Controllers/LabController.php)
- Tests: [`legacy/tests/Feature/LabRequestTest.php`](../legacy/tests/Feature/LabRequestTest.php)

### Verified Business Rules
1. **Order Creation**:
   - Lab orders create a parent `lab` record and child `lab_test` records with baseline reference values.
   - Status transitions: `requested` $\rightarrow$ `in progress` $\rightarrow$ `completed`.
2. **Results Recording**:
   - Test results record quantitative or qualitative values alongside standard reference ranges.

---

## 11. Multi-Branch Operations & Scoping (`Branch`)

### Source References
- Implementation: [`legacy/app/Support/Branch.php`](../legacy/app/Support/Branch.php), [`legacy/app/Http/Controllers/BranchController.php`](../legacy/app/Http/Controllers/BranchController.php)
- Tests: [`legacy/tests/Feature/BranchPackageVideoTest.php`](../legacy/tests/Feature/BranchPackageVideoTest.php)

### Verified Business Rules
1. **Branch Assignment**:
   - A user assigned to a `branch_id` is restricted to records from that branch.
   - An administrator with `branch_id = null` can switch active branches via session or view cross-branch aggregates.
2. **Legacy Row Scoping**:
   - Records with `branch_id IS NULL` predate multi-branch support and remain visible across all branches.

---

## 12. Automated Scheduled Reminders (`AppointmentReminder` & `PaymentReminder`)

### Source References
- Implementation: [`legacy/app/Console/Commands/AppointmentReminder.php`](../legacy/app/Console/Commands/AppointmentReminder.php), [`legacy/app/Console/Commands/PaymentReminder.php`](../legacy/app/Console/Commands/PaymentReminder.php)

### Verified Business Rules
1. **Appointment Reminders**:
   - Queries appointments scheduled for tomorrow (`--days=1`) or today (`--days=0`).
   - Dispatches formatted SMS reminders via ICTCore if notifications are enabled.
2. **Payment Reminders**:
   - Scans patients with outstanding invoice balances (`balance > 0`) and sends payment reminders.
   - Gracefully reports missing SMS gateway configurations without throwing exceptions.
