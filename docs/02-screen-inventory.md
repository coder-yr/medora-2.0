# Medora 2.0 — Legacy Screen & View Inventory

## 1. Executive Summary
- **Total Blade View Templates**: 134 files
- **Unique Interactive Screen Workflows**: ~45 consolidated operational screens
- **View Classification**:
  - **Standard Functional Screens**: 96 views extending `layouts.master` or `layouts.app`
  - **Standalone / Auth Screens**: 16 views (e.g. login, verification code, public splash)
  - **Printable Documents & Identity Cards**: 5 views (e.g. barcodes, receipts, cards)
  - **Reusable Partials & Modal Components**: 12 views (e.g. chart sub-views, branch switch, alert toasts)
  - **Layout Shells & Navigation**: 3 views (`layouts/master.blade.php`, `layouts/sidebarmenu.blade.php`, `layouts/app.blade.php`)
  - **System Error Pages**: 2 views (`errors/404.blade.php`, `errors/503.blade.php`)

> [!NOTE]
> **Screen Consolidation**: In Medora 2.0, the 134 fragmented Blade templates will be consolidated into modular, component-driven React views with client-side routing, shared UI layouts, and reactive modal dialogs.

---

## 2. Master Functional Screens Inventory

| Screen / View Path | Classification | Workflow Purpose | Associated Route(s) & Controller | Roles / Permissions | Key UI Dependencies | Source Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `dashboard.blade.php` | `screen` | Central hospital overview with patient/appointment counters, active admissions, clinical activities, income/expense breakdown, and recent patients. | *Included partial / sub-view* | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `login.blade.php` | `standalone_screen` | Authentication landing page for staff, doctors, and administrators with credentials and MFA verification. | / | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `verificationcode.blade.php` | `standalone_screen` | Two-factor authentication code entry screen during administrative or staff sign-in. | /verification_code | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `welcome.blade.php` | `standalone_screen` | Public hospital landing portal or legacy splash page. | *Included partial / sub-view* | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `app/accountExpence.blade.php` | `screen` | Template rendering `app.accountExpence` for clinical/administrative workflow. | *Included partial / sub-view* | `*Inherited from route*` | File Upload / Webcam, DatePicker | Verified (Source inspection) |
| `app/accountExpenceEdit.blade.php` | `screen` | Template rendering `app.accountExpenceEdit` for clinical/administrative workflow. | *Included partial / sub-view* | `*Inherited from route*` | DatePicker | Verified (Source inspection) |
| `app/accountExpenceView.blade.php` | `screen` | Template rendering `app.accountExpenceView` for clinical/administrative workflow. | *Included partial / sub-view* | `*Inherited from route*` | DataTables, File Upload / Webcam, DatePicker | Verified (Source inspection) |
| `app/accountIncome.blade.php` | `screen` | Template rendering `app.accountIncome` for clinical/administrative workflow. | *Included partial / sub-view* | `*Inherited from route*` | File Upload / Webcam, DatePicker | Verified (Source inspection) |
| `app/accountIncomeEdit.blade.php` | `screen` | Template rendering `app.accountIncomeEdit` for clinical/administrative workflow. | *Included partial / sub-view* | `*Inherited from route*` | DatePicker | Verified (Source inspection) |
| `app/accountIncomeView.blade.php` | `screen` | Template rendering `app.accountIncomeView` for clinical/administrative workflow. | *Included partial / sub-view* | `*Inherited from route*` | DataTables, File Upload / Webcam, DatePicker | Verified (Source inspection) |
| `app/accounting.blade.php` | `screen` | General financial ledger for income and expense transactions with category sectors. | *Included partial / sub-view* | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `app/accountingReport.blade.php` | `screen` | Template rendering `app.accountingReport` for clinical/administrative workflow. | *Included partial / sub-view* | `*Inherited from route*` | DatePicker | Verified (Source inspection) |
| `app/accountingReportsum.blade.php` | `screen` | Template rendering `app.accountingReportsum` for clinical/administrative workflow. | *Included partial / sub-view* | `*Inherited from route*` | DatePicker | Verified (Source inspection) |
| `app/accountreportprint.blade.php` | `printable` | Printable output / document template (app.accountreportprint). | *Included partial / sub-view* | `*Inherited from route*` | Window Print | Verified (Source inspection) |
| `app/accountreportprintsum.blade.php` | `printable` | Printable output / document template (app.accountreportprintsum). | *Included partial / sub-view* | `*Inherited from route*` | Window Print | Verified (Source inspection) |
| `app/accountsector.blade.php` | `screen` | Template rendering `app.accountsector` for clinical/administrative workflow. | *Included partial / sub-view* | `*Inherited from route*` | DataTables, File Upload / Webcam | Verified (Source inspection) |
| `app/barcode.blade.php` | `standalone_screen` | Template rendering `app.barcode` for clinical/administrative workflow. | *Included partial / sub-view* | `*Inherited from route*` | Window Print | Verified (Source inspection) |
| `app/barcodeform.blade.php` | `screen` | Template rendering `app.barcodeform` for clinical/administrative workflow. | *Included partial / sub-view* | `*Inherited from route*` | File Upload / Webcam | Verified (Source inspection) |
| `app/branches.blade.php` | `screen` | Template rendering `app.branches` for clinical/administrative workflow. | *Included partial / sub-view* | `*Inherited from route*` | File Upload / Webcam | Verified (Source inspection) |
| `app/ictcore.blade.php` | `screen` | Template rendering `app.ictcore` for clinical/administrative workflow. | *Included partial / sub-view* | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `app/ictcoreAttendance.blade.php` | `screen` | Template rendering `app.ictcoreAttendance` for clinical/administrative workflow. | *Included partial / sub-view* | `*Inherited from route*` | File Upload / Webcam | Verified (Source inspection) |
| `app/ictcoreFees.blade.php` | `screen` | Template rendering `app.ictcoreFees` for clinical/administrative workflow. | *Included partial / sub-view* | `*Inherited from route*` | File Upload / Webcam | Verified (Source inspection) |
| `app/institute.blade.php` | `screen` | Template rendering `app.institute` for clinical/administrative workflow. | *Included partial / sub-view* | `*Inherited from route*` | File Upload / Webcam | Verified (Source inspection) |
| `app/levelEdit.blade.php` | `screen` | Template rendering `app.levelEdit` for clinical/administrative workflow. | *Included partial / sub-view* | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `app/levelList.blade.php` | `screen` | Template rendering `app.levelList` for clinical/administrative workflow. | *Included partial / sub-view* | `*Inherited from route*` | DataTables | Verified (Source inspection) |
| `app/messageCreate.blade.php` | `screen` | Template rendering `app.messageCreate` for clinical/administrative workflow. | *Included partial / sub-view* | `*Inherited from route*` | File Upload / Webcam | Verified (Source inspection) |
| `app/messageEdit.blade.php` | `screen` | Template rendering `app.messageEdit` for clinical/administrative workflow. | *Included partial / sub-view* | `*Inherited from route*` | File Upload / Webcam | Verified (Source inspection) |
| `app/messageList.blade.php` | `screen` | Template rendering `app.messageList` for clinical/administrative workflow. | *Included partial / sub-view* | `*Inherited from route*` | DataTables | Verified (Source inspection) |
| `app/nopermission.blade.php` | `screen` | Template rendering `app.nopermission` for clinical/administrative workflow. | *Included partial / sub-view* | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `app/notifications.blade.php` | `screen` | Template rendering `app.notifications` for clinical/administrative workflow. | *Included partial / sub-view* | `*Inherited from route*` | File Upload / Webcam | Verified (Source inspection) |
| `app/permission.blade.php` | `screen` | Role-based access control matrix grid managing 97 permissions across 7 hospital roles. | *Included partial / sub-view* | `*Inherited from route*` | DataTables, File Upload / Webcam | Verified (Source inspection) |
| `app/schedulesetting.blade.php` | `screen` | Template rendering `app.schedulesetting` for clinical/administrative workflow. | *Included partial / sub-view* | `*Inherited from route*` | File Upload / Webcam | Verified (Source inspection) |
| `app/Settings.blade.php` | `screen` | Template rendering `app.Settings` for clinical/administrative workflow. | *Included partial / sub-view* | `*Inherited from route*` | File Upload / Webcam | Verified (Source inspection) |
| `app/smsFormat.blade.php` | `screen` | Template rendering `app.smsFormat` for clinical/administrative workflow. | *Included partial / sub-view* | `*Inherited from route*` | DataTables, File Upload / Webcam | Verified (Source inspection) |
| `app/smsLog.blade.php` | `screen` | Template rendering `app.smsLog` for clinical/administrative workflow. | *Included partial / sub-view* | `*Inherited from route*` | DataTables, File Upload / Webcam, DatePicker | Verified (Source inspection) |
| `app/smssender.blade.php` | `screen` | Template rendering `app.smssender` for clinical/administrative workflow. | *Included partial / sub-view* | `*Inherited from route*` | File Upload / Webcam, DatePicker | Verified (Source inspection) |
| `app/templateCreate.blade.php` | `screen` | Template rendering `app.templateCreate` for clinical/administrative workflow. | *Included partial / sub-view* | `*Inherited from route*` | File Upload / Webcam | Verified (Source inspection) |
| `app/users.blade.php` | `screen` | Template rendering `app.users` for clinical/administrative workflow. | *Included partial / sub-view* | `*Inherited from route*` | DataTables, File Upload / Webcam | Verified (Source inspection) |
| `app/admissions/form.blade.php` | `screen` | Patient admission workflow with bed picker restricted to currently unoccupied beds. | /admissions<br>/admissions/create | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `app/admissions/index.blade.php` | `screen` | Ward admission register showing currently admitted patients or discharged patient history. | /admissions | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `app/admissions/show.blade.php` | `screen` | Template rendering `app.admissions.show` for clinical/administrative workflow. | /admissions/create<br>/admissions | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `app/appointments/form.blade.php` | `screen` | Appointment scheduling form with start/end duration, doctor clinic schedule check, vitals recording, and Jitsi video consultation generation. | /appointments<br>/appointments | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `app/appointments/index.blade.php` | `screen` | Daily outpatient appointment day-view filterable by doctor, date, and status with double-booking protections. | /appointments | `appointment_add, appointment_cancel` | Standard HTML/CSS | Verified (Source inspection) |
| `app/appointments/show.blade.php` | `screen` | Appointment details view with patient summary, scheduled time, vitals, consultation status, and video visit link. | /appointments<br>/appointments/create | `consultation_add` | Standard HTML/CSS | Verified (Source inspection) |
| `app/beds/categories.blade.php` | `screen` | Template rendering `app.beds.categories` for clinical/administrative workflow. | /beds<br>/beds/create | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `app/beds/form.blade.php` | `screen` | Bed creation and category configuration form. | /beds<br>/beds | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `app/beds/index.blade.php` | `screen` | Hospital bed and ward management grid with occupancy status derived from active admissions. | /beds | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `app/branches/index.blade.php` | `screen` | Multi-site hospital branch management and location settings. | /hospital-branches | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `app/cash/close.blade.php` | `screen` | Cashier shift closing reconciliation matching physical drawer counts against collected totals by payment mode. | /cash-close | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `app/cash/daybook.blade.php` | `screen` | Template rendering `app.cash.daybook` for clinical/administrative workflow. | *Included partial / sub-view* | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `app/cash/settlement.blade.php` | `screen` | Template rendering `app.cash.settlement` for clinical/administrative workflow. | /settlement | `payment_update` | Standard HTML/CSS | Verified (Source inspection) |
| `app/cash/slip.blade.php` | `screen` | Template rendering `app.cash.slip` for clinical/administrative workflow. | /cash-close<br>/cash-close/{id} | `*Inherited from route*` | Window Print | Verified (Source inspection) |
| `app/consultations/form.blade.php` | `screen` | Template rendering `app.consultations.form` for clinical/administrative workflow. | /consultations<br>/consultations/visit/{id} | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `app/consultations/index.blade.php` | `screen` | Doctor consultation list filterable by date and doctor. | /consultations | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `app/consultations/print.blade.php` | `printable` | Printable output / document template (app.consultations.print). | /consultations/{id}/print | `*Inherited from route*` | Window Print | Verified (Source inspection) |
| `app/consultations/_radiology_orders.blade.php` | `partial` | Sub-view component included into parent screen (app.consultations._radiology_orders). | *Included partial / sub-view* | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `app/departments/index.blade.php` | `screen` | Template rendering `app.departments.index` for clinical/administrative workflow. | /departments | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `app/doctor-share/policies.blade.php` | `screen` | Doctor revenue share policies with multi-tier rules (service, department, patient type). | /doctor-share/policies | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `app/doctor-share/report.blade.php` | `screen` | Doctor revenue share audit report with approval and batch expense payout workflows. | /doctor-share<br>/doctor-share/policies/{id}/assign | `doctor_share_approve` | Standard HTML/CSS | Verified (Source inspection) |
| `app/doctors/form.blade.php` | `screen` | Template rendering `app.doctors.form` for clinical/administrative workflow. | /doctors<br>/doctors | `*Inherited from route*` | File Upload / Webcam | Verified (Source inspection) |
| `app/doctors/index.blade.php` | `screen` | Medical doctor register with departments, qualifications, and share policies. | /doctors | `*Inherited from route*` | DataTables | Verified (Source inspection) |
| `app/doctors/show.blade.php` | `screen` | Template rendering `app.doctors.show` for clinical/administrative workflow. | /doctors<br>/doctors/create | `doctor_schedule` | Standard HTML/CSS | Verified (Source inspection) |
| `app/gateways/index.blade.php` | `screen` | Template rendering `app.gateways.index` for clinical/administrative workflow. | /gateways | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `app/history/form.blade.php` | `screen` | Template rendering `app.history.form` for clinical/administrative workflow. | /history<br>/history | `*Inherited from route*` | File Upload / Webcam | Verified (Source inspection) |
| `app/history/index.blade.php` | `screen` | Template rendering `app.history.index` for clinical/administrative workflow. | /history | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `app/invoices/form.blade.php` | `screen` | Invoice generation interface with service price list auto-fill, patient type pricing, discount, and VAT. | /invoices<br>/invoices/create | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `app/invoices/index.blade.php` | `screen` | Patient billing registry showing outstanding or settled invoices with partial payment balances. | /invoices | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `app/invoices/show.blade.php` | `screen` | Invoice details view with line items, doctor share calculation, and payment entry modal. | /invoices<br>/invoices/create | `*Inherited from route*` | Window Print | Verified (Source inspection) |
| `app/lab/catalogue.blade.php` | `screen` | Template rendering `app.lab.catalogue` for clinical/administrative workflow. | /lab/catalogue | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `app/lab/form.blade.php` | `screen` | Lab test ordering interface selecting tests from the laboratory catalogue. | /lab<br>/lab/create | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `app/lab/index.blade.php` | `screen` | Laboratory test orders registry filterable by date and status. | /lab | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `app/lab/show.blade.php` | `screen` | Lab report entry and results recording screen with reference values and test completion. | /lab<br>/lab/create | `*Inherited from route*` | Window Print | Verified (Source inspection) |
| `app/medicines/categories.blade.php` | `screen` | Template rendering `app.medicines.categories` for clinical/administrative workflow. | /medicines<br>/medicines/create | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `app/medicines/form.blade.php` | `screen` | Medicine inventory entry form with batch details and pricing. | /medicines<br>/medicines | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `app/medicines/index.blade.php` | `screen` | Pharmacy medicine catalogue with stock levels, unit pricing, and generic names. | /medicines | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `app/opd/fees.blade.php` | `screen` | OPD visit fee pricing configuration for initial consultations and follow-up visits. | /opd/history<br>/opd/visit-fees | `service_update` | Standard HTML/CSS | Verified (Source inspection) |
| `app/opd/history.blade.php` | `screen` | OPD visit history and patient consultation audit logs. | /opd/{id}/bill<br>/opd/{id}/token | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `app/opd/queue.blade.php` | `screen` | Outpatient department active token queue for walk-ins and booked visits with arrival, in-consultation, and completion transitions. | /opd/queue | `appointment_update, payment_add, appointment_add, consultation_add` | Standard HTML/CSS | Verified (Source inspection) |
| `app/opd/slots.blade.php` | `screen` | Doctor weekly clinic hours and booking slot configuration (slot minutes, start/end windows). | /opd/visit-fees<br>/opd/visit-fees | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `app/opd/token.blade.php` | `standalone_screen` | Template rendering `app.opd.token` for clinical/administrative workflow. | /opd/walk-in<br>/opd/{id}/call-in | `*Inherited from route*` | Window Print | Verified (Source inspection) |
| `app/partials/_alerts.blade.php` | `partial` | Sub-view component included into parent screen (app.partials._alerts). | *Included partial / sub-view* | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `app/partials/_branch_switch.blade.php` | `partial` | Sub-view component included into parent screen (app.partials._branch_switch). | *Included partial / sub-view* | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `app/partials/_login_fields.blade.php` | `partial` | Sub-view component included into parent screen (app.partials._login_fields). | *Included partial / sub-view* | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `app/patients/card.blade.php` | `printable` | Printable output / document template (app.patients.card). | /patients/{id}/card<br>/patients/{id}/card | `*Inherited from route*` | Window Print | Verified (Source inspection) |
| `app/patients/form.blade.php` | `screen` | Patient registration and profile update form with demographics, photo upload/webcam capture, and patient type selection. | /patients<br>/patients/create | `*Inherited from route*` | File Upload / Webcam | Verified (Source inspection) |
| `app/patients/index.blade.php` | `screen` | Patient master register with search box (name, ID, CNIC, phone, MRN) and pagination. | /patients | `*Inherited from route*` | DataTables | Verified (Source inspection) |
| `app/patients/show.blade.php` | `screen` | Comprehensive clinical patient chart consolidating demographics, appointments, prescriptions, labs, admissions, medical history, and billing. | /patients<br>/patients/{id} | `payment_add` | Standard HTML/CSS | Verified (Source inspection) |
| `app/patients/_chart.blade.php` | `partial` | Sub-view component included into parent screen (app.patients._chart). | *Included partial / sub-view* | `diagnostic_report_view, consultation_view` | Standard HTML/CSS | Verified (Source inspection) |
| `app/pharmacy/form.blade.php` | `screen` | Medicine dispensing counter with stock validation, prescription pre-fill, and itemized billing. | /pharmacy<br>/pharmacy/create | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `app/pharmacy/index.blade.php` | `screen` | Pharmacy sales and dispensing register with financial takings calculation. | /pharmacy | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `app/pharmacy/show.blade.php` | `screen` | Pharmacy sale receipt and itemized dispensing record. | /pharmacy<br>/pharmacy/create | `*Inherited from route*` | Window Print | Verified (Source inspection) |
| `app/prescriptions/form.blade.php` | `screen` | Prescription authoring interface with dosage, frequency, duration, instructions, and medicine selector. | /prescriptions<br>/prescriptions | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `app/prescriptions/index.blade.php` | `screen` | Clinical prescription registry with search by patient and doctor. | /prescriptions | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `app/prescriptions/show.blade.php` | `screen` | Printable and reviewable clinical prescription sheet. | /prescriptions<br>/prescriptions/create | `*Inherited from route*` | Window Print | Verified (Source inspection) |
| `app/pricing/index.blade.php` | `screen` | Comprehensive price matrix editor for OPD/IPD service fees across patient types. | /patient-types<br>/patient-types | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `app/pricing/types.blade.php` | `screen` | Patient classification catalogue (General, Panel/Corporate, Charity, Online) with price overrides. | /patient-types | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `app/radiology/catalogue.blade.php` | `screen` | Template rendering `app.radiology.catalogue` for clinical/administrative workflow. | /radiology/catalogue<br>/radiology/{id}/bill | `diagnostic_report_add` | Standard HTML/CSS | Verified (Source inspection) |
| `app/radiology/create.blade.php` | `screen` | Radiology examination order form linked to service billing. | /radiology<br>/radiology/create | `payment_add` | Standard HTML/CSS | Verified (Source inspection) |
| `app/radiology/index.blade.php` | `screen` | Radiology department worklist sorted by urgency (urgent first, then FIFO) with modality filters. | /radiology | `diagnostic_report_add` | Standard HTML/CSS | Verified (Source inspection) |
| `app/radiology/print.blade.php` | `printable` | Printable output / document template (app.radiology.print). | /radiology/{id}<br>/radiology/{id}/bill | `*Inherited from route*` | Window Print | Verified (Source inspection) |
| `app/radiology/show.blade.php` | `screen` | Radiology report authoring and diagnostic findings entry screen. | /radiology<br>/radiology/create | `diagnostic_report_add, payment_add` | Standard HTML/CSS | Verified (Source inspection) |
| `app/reports/debtors.blade.php` | `screen` | Template rendering `app.reports.debtors` for clinical/administrative workflow. | /reports/debtors | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `app/reports/drug-usage.blade.php` | `screen` | Template rendering `app.reports.drug-usage` for clinical/administrative workflow. | /reports/drug-usage | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `app/reports/index.blade.php` | `screen` | Hospital administrative, clinical, and financial report portal. | /reports | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `app/reports/lab.blade.php` | `screen` | Template rendering `app.reports.lab` for clinical/administrative workflow. | /reports<br>/reports/lab | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `app/reports/occupancy.blade.php` | `screen` | Template rendering `app.reports.occupancy` for clinical/administrative workflow. | /reports/occupancy | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `app/services/index.blade.php` | `screen` | Template rendering `app.services.index` for clinical/administrative workflow. | /services | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `app/services/package.blade.php` | `screen` | Template rendering `app.services.package` for clinical/administrative workflow. | /services/{id}/package | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `app/staff/form.blade.php` | `screen` | Template rendering `app.staff.form` for clinical/administrative workflow. | /staff/{type}<br>/staff/{type} | `*Inherited from route*` | File Upload / Webcam | Verified (Source inspection) |
| `app/staff/index.blade.php` | `screen` | Hospital staff register for nurses, accountants, receptionists, pharmacists, and laboratorists. | /staff/{type} | `*Inherited from route*` | DataTables | Verified (Source inspection) |
| `app/users/verify.blade.php` | `standalone_screen` | Template rendering `app.users.verify` for clinical/administrative workflow. | *Included partial / sub-view* | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `errors/404.blade.php` | `error_page` | HTTP error display page (errors.404). | *Included partial / sub-view* | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `errors/503.blade.php` | `error_page` | HTTP error display page (errors.503). | *Included partial / sub-view* | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `layouts/app.blade.php` | `layout` | Top-level structural layout template providing sidebar, header, and assets. | *Included partial / sub-view* | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `layouts/master.blade.php` | `layout` | Top-level structural layout template providing sidebar, header, and assets. | *Included partial / sub-view* | `*Inherited from route*` | DataTables, Chart.js, Select2, DatePicker | Verified (Source inspection) |
| `layouts/sidebarmenu.blade.php` | `layout` | Top-level structural layout template providing sidebar, header, and assets. | *Included partial / sub-view* | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `search/search.blade.php` | `screen` | Template rendering `search.search` for clinical/administrative workflow. | /search | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `vendor/LaravelLogger/forms/clear-activity-log.blade.php` | `standalone_screen` | Template rendering `vendor.LaravelLogger.forms.clear-activity-log` for clinical/administrative workflow. | *Included partial / sub-view* | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `vendor/LaravelLogger/forms/delete-activity-log.blade.php` | `standalone_screen` | Template rendering `vendor.LaravelLogger.forms.delete-activity-log` for clinical/administrative workflow. | *Included partial / sub-view* | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `vendor/LaravelLogger/forms/restore-activity-log.blade.php` | `standalone_screen` | Template rendering `vendor.LaravelLogger.forms.restore-activity-log` for clinical/administrative workflow. | *Included partial / sub-view* | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `vendor/LaravelLogger/logger/activity-log-cleared.blade.php` | `standalone_screen` | Template rendering `vendor.LaravelLogger.logger.activity-log-cleared` for clinical/administrative workflow. | *Included partial / sub-view* | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `vendor/LaravelLogger/logger/activity-log-item.blade.php` | `standalone_screen` | Template rendering `vendor.LaravelLogger.logger.activity-log-item` for clinical/administrative workflow. | *Included partial / sub-view* | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `vendor/LaravelLogger/logger/activity-log.blade.php` | `standalone_screen` | Template rendering `vendor.LaravelLogger.logger.activity-log` for clinical/administrative workflow. | *Included partial / sub-view* | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `vendor/LaravelLogger/logger/partials/activity-table.blade.php` | `partial` | Sub-view component included into parent screen (vendor.LaravelLogger.logger.partials.activity-table). | *Included partial / sub-view* | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `vendor/LaravelLogger/modals/confirm-modal.blade.php` | `partial` | Sub-view component included into parent screen (vendor.LaravelLogger.modals.confirm-modal). | *Included partial / sub-view* | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `vendor/LaravelLogger/partials/form-search.blade.php` | `partial` | Sub-view component included into parent screen (vendor.LaravelLogger.partials.form-search). | *Included partial / sub-view* | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `vendor/LaravelLogger/partials/form-status.blade.php` | `partial` | Sub-view component included into parent screen (vendor.LaravelLogger.partials.form-status). | *Included partial / sub-view* | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `vendor/LaravelLogger/partials/scripts.blade.php` | `partial` | Sub-view component included into parent screen (vendor.LaravelLogger.partials.scripts). | *Included partial / sub-view* | `*Inherited from route*` | DataTables | Verified (Source inspection) |
| `vendor/LaravelLogger/partials/styles.blade.php` | `partial` | Sub-view component included into parent screen (vendor.LaravelLogger.partials.styles). | *Included partial / sub-view* | `*Inherited from route*` | DataTables, Window Print | Verified (Source inspection) |
| `vendor/LaravelLogger/scripts/add-title-attribute.blade.php` | `standalone_screen` | Template rendering `vendor.LaravelLogger.scripts.add-title-attribute` for clinical/administrative workflow. | *Included partial / sub-view* | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `vendor/LaravelLogger/scripts/clickable-row.blade.php` | `standalone_screen` | Template rendering `vendor.LaravelLogger.scripts.clickable-row` for clinical/administrative workflow. | *Included partial / sub-view* | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `vendor/LaravelLogger/scripts/confirm-modal.blade.php` | `partial` | Sub-view component included into parent screen (vendor.LaravelLogger.scripts.confirm-modal). | *Included partial / sub-view* | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |
| `vendor/LaravelLogger/scripts/datatables.blade.php` | `standalone_screen` | Template rendering `vendor.LaravelLogger.scripts.datatables` for clinical/administrative workflow. | *Included partial / sub-view* | `*Inherited from route*` | DataTables | Verified (Source inspection) |
| `vendor/LaravelLogger/scripts/tooltip.blade.php` | `standalone_screen` | Template rendering `vendor.LaravelLogger.scripts.tooltip` for clinical/administrative workflow. | *Included partial / sub-view* | `*Inherited from route*` | Standard HTML/CSS | Verified (Source inspection) |

---

## 3. UI Layout Architecture & Shared Component Breakdown

### A. Shell Layouts (`layouts/`)
1. **`layouts/master.blade.php`**:
   - Primary administrative and clinical shell (774 lines).
   - Embeds Bootstrap 4, FontAwesome 4 & 5, jQuery 3.2.1, Select2, DataTables, and responsive sidebar navigation.
   - Injects the branch switcher (`partials._branch_switch`) and alert notifications (`partials._alerts`).
2. **`layouts/sidebarmenu.blade.php`**:
   - Dynamic sidebar navigation evaluating `Permissions::allows(...)` per link.
   - Groups links into Clinical, Patients, Appointments, OPD, Radiology, Pharmacy, Financial, Staff, and Administration.
3. **`layouts/app.blade.php`**:
   - Lightweight authentication layout used by login, logout, and verification code screens.

### B. Key Sub-View Partials (`partials/`)
- **`app/patients/_chart.blade.php`**: Reusable clinical timeline chart rendered inside patient details and consultation visits.
- **`app/partials/_alerts.blade.php`**: Toast and session flash alert banner handler (`success`, `error`, `warning`).
- **`app/partials/_branch_switch.blade.php`**: Header dropdown allowing users with cross-branch privileges to switch active `branch_id` session.
- **`app/partials/_login_fields.blade.php`**: Shared username/password input block for doctor and staff registration forms.