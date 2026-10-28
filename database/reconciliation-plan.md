# Medora 2.0 — Data Migration Reconciliation & Rollback Plan

## 1. Executive Summary
This document specifies the validation criteria, automated verification queries, tolerance thresholds, and rollback procedures for data migration rehearsals transitioning the legacy ICTHospital database to **Supabase PostgreSQL**.

Reconciliations ensure 100% integrity across patient demographics, clinical records, pharmacy inventory, and cents-level financial ledgers.

---

## 2. Reconciliation Principles & Strict Tolerances

| Reconciliation Area | Permissible Tolerance | Enforcement Rule |
| :--- | :---: | :--- |
| **Financial Ledger Totals** | **$0.00 (Zero Tolerance)** | Sum of `gross_total`, `amount_received`, and line items must match legacy to the exact cent. |
| **Invoice Balances** | **$0.00 (Zero Tolerance)** | Every invoice's balance (`gross_total - sum(payments)`) must be identical in target. |
| **Patient MR Numbers** | **0 Missing / 0 Duplicates** | Every patient record must retain its unique 6-digit identifier (`000001`). |
| **Pharmacy Stock Units** | **0 Unit Discrepancy** | Sum of inventory on hand (`medicine.quantity`) must match exactly. |
| **Active Bed Admissions** | **0 Discrepancy** | Count of open admissions (`d_time IS NULL`) must match legacy active count. |
| **Row Count Integrity** | **100% Match** | Target operational table rows must match source rows minus documented purged test data. |
| **Historical Timestamps** | **+/- 0 Seconds** | Converted UTC timestamps must represent the exact instant of the source record. |

---

## 3. Automated Reconciliation Check Suite

### Check 1: Global Row Count Parity
Validates that every operational record from legacy MySQL/SQLite migrated into Supabase PostgreSQL:
```sql
SELECT 
  'patient' AS entity, 
  (SELECT COUNT(*) FROM legacy.patient) AS source_rows, 
  (SELECT COUNT(*) FROM target.patient) AS target_rows,
  ((SELECT COUNT(*) FROM legacy.patient) - (SELECT COUNT(*) FROM target.patient)) AS variance
UNION ALL
SELECT 'appointment', (SELECT COUNT(*) FROM legacy.appointment), (SELECT COUNT(*) FROM target.appointment),
  ((SELECT COUNT(*) FROM legacy.appointment) - (SELECT COUNT(*) FROM target.appointment))
UNION ALL
SELECT 'payment (invoices)', (SELECT COUNT(*) FROM legacy.payment), (SELECT COUNT(*) FROM target.payment),
  ((SELECT COUNT(*) FROM legacy.payment) - (SELECT COUNT(*) FROM target.payment))
UNION ALL
SELECT 'invoice_item', (SELECT COUNT(*) FROM legacy.invoice_item), (SELECT COUNT(*) FROM target.invoice_item),
  ((SELECT COUNT(*) FROM legacy.invoice_item) - (SELECT COUNT(*) FROM target.invoice_item))
UNION ALL
SELECT 'invoice_payment', (SELECT COUNT(*) FROM legacy.invoice_payment), (SELECT COUNT(*) FROM target.invoice_payment),
  ((SELECT COUNT(*) FROM legacy.invoice_payment) - (SELECT COUNT(*) FROM target.invoice_payment))
UNION ALL
SELECT 'medicine', (SELECT COUNT(*) FROM legacy.medicine), (SELECT COUNT(*) FROM target.medicine),
  ((SELECT COUNT(*) FROM legacy.medicine) - (SELECT COUNT(*) FROM target.medicine))
UNION ALL
SELECT 'alloted_bed', (SELECT COUNT(*) FROM legacy.alloted_bed), (SELECT COUNT(*) FROM target.alloted_bed),
  ((SELECT COUNT(*) FROM legacy.alloted_bed) - (SELECT COUNT(*) FROM target.alloted_bed));
```
**Pass Criterion**: `variance = 0` for all entities.

---

### Check 2: Financial Integrity & Invoice Balance Audit
Compares gross billed amounts, total payments collected, and outstanding balances:
```sql
WITH legacy_totals AS (
  SELECT 
    ROUND(SUM(CAST(COALESCE(NULLIF(gross_total, ''), '0') AS DECIMAL(15,2))), 2) AS gross,
    ROUND(SUM(CAST(COALESCE(NULLIF(amount_received, ''), '0') AS DECIMAL(15,2))), 2) AS received,
    ROUND(SUM(CAST(COALESCE(NULLIF(gross_total, ''), '0') AS DECIMAL(15,2)) - CAST(COALESCE(NULLIF(amount_received, ''), '0') AS DECIMAL(15,2))), 2) AS balance
  FROM legacy.payment
),
target_totals AS (
  SELECT 
    ROUND(SUM(gross_total), 2) AS gross,
    ROUND(SUM(amount_received), 2) AS received,
    ROUND(SUM(gross_total - amount_received), 2) AS balance
  FROM target.payment
)
SELECT 
  l.gross AS legacy_gross, t.gross AS target_gross, (l.gross - t.gross) AS gross_diff,
  l.received AS legacy_received, t.received AS target_received, (l.received - t.received) AS received_diff,
  l.balance AS legacy_balance, t.balance AS target_balance, (l.balance - t.balance) AS balance_diff
FROM legacy_totals l, target_totals t;
```
**Pass Criterion**: `gross_diff = 0.00`, `received_diff = 0.00`, `balance_diff = 0.00`.

---

### Check 3: Doctor Revenue Share Integrity
Verifies that all approved, pending, and paid doctor shares are accounted for without rounding drift:
```sql
SELECT 
  status,
  ROUND(SUM(doctor_share), 2) AS target_share_total,
  COUNT(*) AS count
FROM target.doctor_share
GROUP BY status;
```

---

### Check 4: Pharmacy Inventory Stock Balance
Verifies total physical units of medication:
```sql
SELECT 
  (SELECT SUM(quantity) FROM legacy.medicine) AS legacy_units,
  (SELECT SUM(quantity) FROM target.medicine) AS target_units,
  ((SELECT SUM(quantity) FROM legacy.medicine) - (SELECT SUM(quantity) FROM target.medicine)) AS discrepancy;
```
**Pass Criterion**: `discrepancy = 0`.

---

### Check 5: Active Inpatient Ward Occupancy
Ensures that patients currently admitted remain in their exact allocated beds:
```sql
SELECT 
  (SELECT COUNT(*) FROM legacy.alloted_bed WHERE d_time IS NULL) AS legacy_active_patients,
  (SELECT COUNT(*) FROM target.alloted_bed WHERE d_time IS NULL) AS target_active_patients;
```
**Pass Criterion**: `legacy_active_patients = target_active_patients`.

---

### Check 6: Referential Integrity & Orphan Prevention
Verifies that no child record points to a missing parent:
```sql
-- Orphan appointment check
SELECT COUNT(*) AS orphan_appointments 
FROM target.appointment a 
WHERE NOT EXISTS (SELECT 1 FROM target.patient p WHERE p.id = a.patient);

-- Orphan invoice items
SELECT COUNT(*) AS orphan_invoice_items 
FROM target.invoice_item i 
WHERE NOT EXISTS (SELECT 1 FROM target.payment p WHERE p.id = i.payment_id);
```
**Pass Criterion**: `0` across all orphan checks.

---

## 4. Rehearsal Rollback & Reset Strategy

During dry-run migrations in staging, if any reconciliation check fails:

### Step 1: Immediate Execution Abort
- Trigger an automatic rollback flag; do not switch API traffic.
- Capture discrepancy logs into `storage/logs/migration-rehearsal-failure.log`.

### Step 2: Database Schema Reset (Staging Only)
- Revert Supabase staging PostgreSQL schema using Prisma migrate down or schema reset:
  ```bash
  # Disposable staging environment reset
  npx prisma migrate reset --force --skip-seed
  ```
- Re-run pre-cleansing scripts (`database/scripts/profile-data-quality.php`) on source extract to isolate data corruption.

### Step 3: Zero-Risk Production Isolation
- Production databases are **never touched** during Phase 3 or Phase 4 rehearsals.
- Dual-run validation in Phase 6 will run the new NestJS backend in shadow/read-only mode alongside legacy ICTHospital until reconciliations pass 100% across 7 consecutive operational days.
