# Notification Event Catalog
## Medora 2.0 — Phase 22 Specification

### 1. Catalog Principles & Privacy Safeguards
Every notification event in Medora 2.0 adheres to strict design and privacy standards:
1. **Privacy Classification**:
   - `OPERATIONAL_MINIMAL`: General notifications containing zero clinical diagnostic data.
   - `INTERNAL_STAFF`: System, clinical handover, and staff assignment notifications.
   - `FINANCIAL_RECEIPT`: Transaction acknowledgments with payment reference numbers and amounts; never contains breakdown of sensitive medical procedures.
2. **Channel Policy**:
   - High-security clinical alerts (lab release, radiology verification) are sent via **IN_APP** directing the user to sign in to the patient or doctor portal.
   - **SMS / EMAIL** are restricted to appointment reminders, receipt delivery notices, and admission alerts with sanitized non-clinical summaries.
3. **Deduplication Key Scheme**:
   $$\text{DeduplicationKey} = \text{EVENT\_TYPE} + \text{"\_"} + \text{ENTITY\_ID} + \text{"\_"} + \text{RECIPIENT\_ID} + (\text{OPTIONAL\_DATE})$$

---

### 2. Comprehensive Event Matrix

| Event Type Key | Triggering Business Action | Recipient Resolution | Channels Supported | Default Template Key | Deduplication Key Pattern | Privacy Classification |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `APPOINTMENT_CONFIRMED` | Doctor/Receptionist schedules appointment | Patient (`patientId` / phone / email) | `IN_APP`, `SMS`, `EMAIL` | `tpl_appointment_confirmed` | `APT_CONF_{appointmentId}_{patientId}` | `OPERATIONAL_MINIMAL` |
| `APPOINTMENT_RESCHEDULED` | Appointment time/date modified | Patient & Attending Doctor | `IN_APP`, `SMS`, `EMAIL` | `tpl_appointment_rescheduled` | `APT_RESCHED_{appointmentId}_{timestamp}` | `OPERATIONAL_MINIMAL` |
| `APPOINTMENT_CANCELLED` | Appointment marked cancelled | Patient & Attending Doctor | `IN_APP`, `SMS`, `EMAIL` | `tpl_appointment_cancelled` | `APT_CANCEL_{appointmentId}_{patientId}` | `OPERATIONAL_MINIMAL` |
| `APPOINTMENT_REMINDER` | Scheduled job 24h/2h before clinic visit | Patient (`patient.phone`) | `SMS`, `IN_APP` | `tpl_appointment_reminder` | `APT_REM_{appointmentId}_{appointmentDate}` | `OPERATIONAL_MINIMAL` |
| `INVOICE_ISSUED` | Billing clerk finalizes patient invoice | Patient / Guarantor | `IN_APP`, `EMAIL`, `SMS` | `tpl_invoice_issued` | `INV_ISSUE_{invoiceId}_{patientId}` | `FINANCIAL_RECEIPT` |
| `PAYMENT_RECEIVED` | Cashier collects payment against invoice | Patient / Depositor | `IN_APP`, `SMS`, `EMAIL` | `tpl_payment_received` | `PAY_RCVD_{paymentId}_{patientId}` | `FINANCIAL_RECEIPT` |
| `ADMISSION_CREATED` | Inpatient bed allocated and stay initiated | Emergency Contact & Attending Doctor | `IN_APP`, `SMS` | `tpl_admission_created` | `ADM_INIT_{admissionId}_{patientId}` | `OPERATIONAL_MINIMAL` |
| `INPATIENT_DISCHARGE` | Medical discharge approved & settled | Patient & Primary Nurse | `IN_APP`, `SMS` | `tpl_inpatient_discharge` | `ADM_DISCH_{admissionId}_{patientId}` | `OPERATIONAL_MINIMAL` |
| `BED_TRANSFER` | Patient moved between wards/rooms | Ward Head Nurse & Attending Doctor | `IN_APP` | `tpl_bed_transfer` | `BED_XFER_{admissionId}_{targetBedId}` | `INTERNAL_STAFF` |
| `LAB_REPORT_APPROVED` | Pathologist verifies and releases results | Ordering Physician & Patient | `IN_APP`, `SMS` | `tpl_lab_report_ready` | `LAB_READY_{orderId}_{patientId}` | `OPERATIONAL_MINIMAL` (directs to portal) |
| `RADIOLOGY_REPORT_APPROVED`| Radiologist signs off diagnostic imaging | Ordering Physician & Patient | `IN_APP`, `SMS` | `tpl_rad_report_ready` | `RAD_READY_{orderId}_{patientId}` | `OPERATIONAL_MINIMAL` (directs to portal) |
| `STAFF_ASSIGNMENT` | HR assigns employee to branch or dept | Staff User (`userId`) | `IN_APP`, `EMAIL` | `tpl_staff_assignment` | `STAFF_ASGN_{profileId}_{branchId}` | `INTERNAL_STAFF` |
| `SHIFT_HANDOVER_ALERT` | Cashier shift submitted for manager approval | Branch Supervisor / Accountant | `IN_APP` | `tpl_shift_pending_approval`| `SHIFT_APP_{shiftId}_{supervisorId}` | `INTERNAL_STAFF` |
| `SYSTEM_ALERT` | System administrator broadcast / alert | All active branch staff | `IN_APP` | `tpl_system_alert` | `SYS_ALERT_{alertId}_{userId}` | `INTERNAL_STAFF` |

---

### 3. Disallowed Events & Anti-Patterns (Explicit Non-Goals)
1. **No Internal Accounting / General Ledger Patient Notifications**:
   - Journal entry postings, expense approvals, and period closes must NEVER trigger patient-facing notifications.
2. **No Unauthenticated Cron Route**:
   - The legacy `GET /cronjob/payment-reminder` endpoint is permanently banned. Outstanding payment reminders are run exclusively via authenticated server tasks.
3. **No Direct Clinical Diagnoses in SMS/Email**:
   - SMS and Email messages must NEVER contain ICD-10 diagnostic codes, pathology values, or radiology narratives. The message simply states: *"Your diagnostic report is ready. Please log in to your patient portal to review."*
