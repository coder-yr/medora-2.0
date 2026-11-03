# Medora 2.0 — Executive Dashboard Metric Catalog

| Metric Key | Metric Name | Business Definition | Authoritative Data Source | Calculation / Formula | Branch Scoped | Permission Required |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `PAT_TOTAL` | Total Registered Patients | Cumulative distinct registered patients in system | `patient` | `COUNT(id)` | Yes (Branch filterable) | `DASHBOARD_VIEW` / `PATIENT_VIEW` |
| `PAT_NEW_PERIOD` | New Registrations in Period | Patient registrations created within selected date range | `patient` | `COUNT(id) WHERE createdAt BETWEEN start AND end` | Yes | `DASHBOARD_VIEW` |
| `APP_TOTAL_PERIOD` | Total Appointments in Period | All scheduled, visited, or cancelled appointments | `appointment` | `COUNT(id) WHERE date BETWEEN start AND end` | Yes | `APPOINTMENT_VIEW` |
| `APP_COMPLETED_PERIOD`| Completed Appointments | Appointments with status `Visited` or `Completed` | `appointment` | `COUNT(id) WHERE status IN ('Visited', 'Completed')` | Yes | `APPOINTMENT_VIEW` |
| `APP_COMPLETION_RATE` | Appointment Completion Rate | Percentage of non-cancelled appointments successfully completed | `appointment` | `(Completed / (Total - Cancelled)) * 100` | Yes | `APPOINTMENT_VIEW` |
| `CONS_COMPLETED_PERIOD`| Completed Consultations | Clinical outpatient encounters completed in period | `consultation` | `COUNT(id) WHERE status = 'COMPLETED'` | Yes | `CONSULTATION_VIEW` |
| `INP_ACTIVE_ADMISSIONS`| Current Inpatient Census | Patients currently admitted in hospital wards | `admission` | `COUNT(id) WHERE status = 'ADMITTED'` | Yes | `INPATIENT_VIEW` |
| `INP_BED_OCCUPANCY_RATE`| Bed Occupancy Rate | Percentage of operational hospital beds currently occupied | `bed`, `admission` | `(Occupied Beds / Total Usable Beds) * 100` | Yes | `INPATIENT_VIEW` |
| `INP_AVG_LENGTH_OF_STAY`| Average Length of Stay (ALOS)| Mean duration in days of inpatient admissions discharged in period | `admission` | `AVG(dischargeDate - admissionDate) WHERE status = 'DISCHARGED'` | Yes | `INPATIENT_VIEW` |
| `PHAR_LOW_STOCK_COUNT` | Low Stock Items | Active medicines whose total batch inventory $\le$ reorder level | `medicine_batch`, `medicine` | `COUNT(DISTINCT medicineId) WHERE batchSum <= minStock` | Yes | `PHARMACY_VIEW` |
| `PHAR_EXPIRING_COUNT` | Near-Expiry Batches | Batches expiring within next 60 days with remaining quantity > 0 | `medicine_batch` | `COUNT(id) WHERE remainingQuantity > 0 AND expiryDate <= (NOW() + 60d)` | Yes | `PHARMACY_VIEW` |
| `LAB_PENDING_SAMPLES` | Lab Orders Awaiting Collection/Testing | Requisitions received not yet verified | `lab` | `COUNT(id) WHERE status IN ('PENDING', 'SAMPLE_COLLECTED', 'IN_PROGRESS')` | Yes | `LAB_VIEW` |
| `RAD_PENDING_STUDIES` | Radiology Studies Pending | Orders scheduled or in progress awaiting radiologist verification | `radiology_order` | `COUNT(id) WHERE status IN ('REQUESTED', 'SCHEDULED', 'IN_PROGRESS')` | Yes | `RADIOLOGY_VIEW` |
| `FIN_REVENUE_PERIOD` | Recognized Revenue in Period | Total value of invoices issued during the period | `invoice` | `SUM(totalAmount - discountAmount) WHERE createdAt BETWEEN start AND end` | Yes | `DASHBOARD_FINANCIAL_VIEW` |
| `FIN_COLLECTIONS_CASH` | Cash Drawer Collections | Total cash received at cashier desks in period | `cash_transaction` | `SUM(amount) WHERE isCash = true AND direction = 'IN'` | Yes | `DASHBOARD_FINANCIAL_VIEW` |
| `FIN_COLLECTIONS_NONCASH`| Digital/Card Collections | Total bank/card/online collections at cashier in period | `cash_transaction` | `SUM(amount) WHERE isCash = false AND direction = 'IN'` | Yes | `DASHBOARD_FINANCIAL_VIEW` |
| `FIN_OUTSTANDING_AR` | Accounts Receivable (Unpaid Invoices)| Remaining unpaid balance on issued patient invoices | `invoice` | `SUM(totalAmount - paidAmount - discountAmount) WHERE status != 'PAID'` | Yes | `DASHBOARD_FINANCIAL_VIEW` |
| `NOTIF_DEAD_LETTER` | Dead-Letter Outbox Queue | Failed background notifications exceeding max retry attempts | `notification_outbox` | `COUNT(id) WHERE status = 'DEAD_LETTER'` | Yes | `NOTIFICATION_QUEUE_MONITOR` |
