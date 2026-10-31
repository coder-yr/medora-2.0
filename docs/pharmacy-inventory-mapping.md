# Pharmacy & Inventory System Mapping Specification

**Project:** Medora 2.0  
**Phase:** Phase 13 — Pharmacy & Inventory Management System  
**Repository:** `F:\yash\projects\full system\ICTHospital`  
**Status:** Canonical Reference

---

## 1. Executive Summary & Legacy Audit

In the legacy Laravel application (`legacy/app/Http/Controllers/PharmacyController.php`, `legacy/app/Models/PharmacyPayment.php`, `legacy/app/Models/PharmacySaleItem.php`), pharmacy operations were limited to a basic sales record:
1. **Un-batched Single Stock Integer**: `medicine.quantity` was a standalone integer column with no batch tracking, no expiration tracking per lot, and no movement ledger.
2. **Dispensing Workflow**: `PharmacyController::store()` validated stock using `Medicine::lockForUpdate()`, decremented `medicine.quantity`, created a `PharmacyPayment` record, and created `PharmacySaleItem` records. Totals and descriptions were packed into legacy comma-separated strings (`category_name` and `category_amount`).
3. **No Batch Purchasing Workflow**: There were no purchase orders, goods receipt notes (GRN), or batch creation workflows. Purchases were recorded either as manual edits to `medicine.quantity` or as unlinked financial records in `pharmacy_expense`.
4. **No Auditable Returns or Adjustments**: The only return operation was `PharmacyController::destroy()`, which deleted the entire sale and incremented `medicine.quantity`. Physical count variances had no audit trail.
5. **Prescription Disconnect**: `PharmacyController::create()` accepted a `?prescription=ID` query parameter to prefill item names, but did not track whether a prescription was fully dispensed, partially dispensed, or prevent duplicate dispensing.

Medora 2.0 modernizes this domain into an auditable, batch-level pharmaceutical inventory system with authoritative ledger movements, FEFO (First Expiry, First Out) batch allocation, transactional concurrency safety (`SELECT FOR UPDATE`), multi-stage purchasing, dispensing linked to `PrescriptionModule` and `InvoiceModule`, returns, and stock adjustments.

---

## 2. Legacy Table & Column Mapping

### 2.1 `pharmacy_payment` (Legacy Sale Header)

| Legacy Column | Legacy Type | Nullable | Medora 2.0 Target Entity / Field | Description & Conversion Rule |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | NO (PK) | `PharmacyDispensation.id` / `PharmacyPayment.id` | Primary key sequence. |
| `patient` | `VARCHAR` / FK | YES | `PharmacyDispensation.patientId` | Foreign key referencing `patient.id`. Supports walk-in / anonymous OTC sales (`patientId = null`). |
| `doctor` | `VARCHAR` / FK | YES | `PharmacyDispensation.doctorId` | Foreign key referencing attending/prescribing `doctor.id`. |
| `date` | `VARCHAR(50)` | YES | `PharmacyDispensation.dispenseDate` | Dispensation date (`YYYY-MM-DD`). |
| `amount` | `VARCHAR` / `NUMERIC` | NO | `PharmacyDispensation.subtotal` | Subtotal of line items before discounts and taxes. |
| `vat` | `VARCHAR` / `NUMERIC` | NO (Def 0) | `PharmacyDispensation.tax` | Tax / VAT amount. |
| `discount` | `VARCHAR` / `NUMERIC` | NO (Def 0) | `PharmacyDispensation.discount` | Total discount granted on the sale. |
| `gross_total` | `VARCHAR` / `NUMERIC` | NO | `PharmacyDispensation.totalAmount` | Net billable amount (`subtotal - discount + tax`). |
| `amount_received` | `VARCHAR` / `NUMERIC` | YES | `Payment.amountReceived` | Financial payment handled via `InvoiceModule` / `Payment` reference. |
| `status` | `VARCHAR` | YES | `PharmacyDispensation.status` | Sale state: `COMPLETED`, `RETURNED`, `CANCELLED`. |
| `category_name` | `VARCHAR(1000)` | YES | Deprecated | Legacy packed comma-separated summary string. Replaced by relational line items. |
| `category_amount` | `VARCHAR(1000)` | YES | Deprecated | Legacy packed comma-separated amounts. Replaced by relational line items. |
| `x_ray`, `flat_vat`, `flat_discount`, `hospital_amount`, `doctor_amount` | Mixed | YES | Deprecated | Legacy billing artifacts. Replaced by normalized billing structures. |

### 2.2 `pharmacy_sale_item` (Legacy Sale Line Items)

| Legacy Column | Legacy Type | Nullable | Medora 2.0 Target Entity / Field | Description & Conversion Rule |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | NO (PK) | `PharmacyDispensationItem.id` | Primary key sequence. |
| `pharmacy_payment_id` | `INTEGER` | NO (FK) | `PharmacyDispensationItem.dispensationId` | References parent dispensation header. |
| `medicine_id` | `INTEGER` | YES (FK) | `PharmacyDispensationItem.medicineId` | References catalogue `medicine.id`. Null for custom/unlisted items. |
| `name` | `VARCHAR` | NO | `PharmacyDispensationItem.medicineName` | Copied snapshot of drug name at moment of sale (immutable). |
| `quantity` | `INTEGER` | NO (Def 1) | `PharmacyDispensationItem.quantity` | Quantity dispensed. |
| `unit_price` | `NUMERIC` | NO (Def 0) | `PharmacyDispensationItem.unitPrice` | Retail selling price charged per unit. |
| `line_total` | `NUMERIC` | NO (Def 0) | `PharmacyDispensationItem.totalPrice` | Total price for line (`quantity * unitPrice`). |
| *(None)* | *(None)* | *(None)* | `PharmacyDispensationItem.batchId` | **NEW**: Links dispensed units to specific `MedicineBatch`. |
| *(None)* | *(None)* | *(None)* | `PharmacyDispensationItem.batchNumber` | **NEW**: Copied batch number snapshot. |
| *(None)* | *(None)* | *(None)* | `PharmacyDispensationItem.prescriptionMedicineId` | **NEW**: Links to specific prescription line item. |
| *(None)* | *(None)* | *(None)* | `PharmacyDispensationItem.returnedQuantity` | **NEW**: Tracks quantity refunded/returned. |

---

## 3. Medora 2.0 Target Domain Architecture

### 3.1 Inventory Balance Strategy: Batch-Level Ledger

To eliminate stock drift and guarantee auditable inventory:
1. **`MedicineBatch` is the Authoritative Balance**:
   - Each batch tracks `initialQuantity` and `currentQuantity`.
   - `Medicine.quantity` is a materialized sum of all non-expired, active batch balances (`sum(currentQuantity)`), updated atomically within the same transaction.
2. **`StockMovement` is the Mandatory Audit Ledger**:
   - No stock balance may ever increase or decrease without an associated `StockMovement` row recording the `movementType`, `quantity`, `balanceAfter`, `referenceType`, `referenceId`, and `performedBy`.
   - Movement types:
     - `PURCHASE_RECEIPT` (+)
     - `DISPENSING` (-)
     - `CUSTOMER_RETURN` (+)
     - `SUPPLIER_RETURN` (-)
     - `STOCK_ADJUSTMENT_IN` (+)
     - `STOCK_ADJUSTMENT_OUT` (-)
     - `EXPIRED_WRITE_OFF` (-)
     - `DAMAGED_WRITE_OFF` (-)

### 3.2 FEFO Batch Selection Strategy

When dispensing a medication:
1. Active batches (`status = 'ACTIVE'`, `currentQuantity > 0`) for the requested `medicineId` are queried ordered by `expiryDate ASC` (First Expiry, First Out).
2. Batches that are already expired (`expiryDate < today`) are automatically excluded from saleable inventory.
3. If the requested quantity exceeds the nearest-expiring batch, the allocator splits the line across subsequent batches until the full quantity is fulfilled.
4. If total available unexpired stock across all batches is insufficient, the transaction is rejected (`400 Bad Request: Insufficient stock. Only X units available.`).

### 3.3 Concurrency & Transaction Safety

To prevent race conditions where concurrent requests oversell the last units:
1. Interactive PostgreSQL transactions (`prisma.$transaction`) are used.
2. Row-level locks (`SELECT * FROM medicine_batch WHERE id = ... FOR UPDATE`) are acquired before evaluating available quantity.
3. Decrements use atomic conditions (`WHERE id = ... AND current_quantity >= ...`).
4. Any attempt to reduce a batch balance below 0 triggers a database-level rejection and rolls back the entire dispensation transaction.

---

## 4. Multi-Stage Purchasing Workflow

1. **Purchase Order (`PurchaseOrder` & `PurchaseOrderItem`)**:
   - Created with status `DRAFT` or `ORDERED`.
   - Specifies supplier, order date, items, ordered quantities, and estimated unit costs.
2. **Goods Receipt Note (`GoodsReceipt` & `GoodsReceiptItem`)**:
   - Received against a `PurchaseOrder` (or direct walk-in supplier invoice).
   - Records supplier invoice/challan number, delivery date, batch numbers, manufacturing dates, expiration dates, received quantities, and cost prices.
   - Atomically creates or updates `MedicineBatch` records.
   - Generates `PURCHASE_RECEIPT` stock movements.
   - Updates `PurchaseOrderItem.quantityReceived` and sets PO status to `PARTIALLY_RECEIVED` or `RECEIVED`.

---

## 5. Dispensing & Prescription Integration

1. **Prescription Status & Line Tracking**:
   - `PrescriptionMedicine` tracks `dispensedQuantity` (default 0).
   - If `dispensedQuantity == 0`: Prescribed but un-dispensed.
   - If `0 < dispensedQuantity < prescribedQuantity`: Partially dispensed.
   - If `dispensedQuantity >= prescribedQuantity`: Fully dispensed.
   - `Prescription.state` moves from `'issued'` to `'partially_dispensed'` to `'dispensed'`.
2. **Prescription Verification**:
   - Pharmacy verifies attending physician credentials and patient MRN.
   - Doctor's original prescription lines are immutable; pharmacy users cannot modify doctor notes or dosage instructions.
3. **Billing Integration**:
   - Dispensation creates a `PharmacyDispensation` record and can generate or link to a patient `Payment` (invoice) in `InvoiceModule` with invoice items mapped to `PHARMACY` payment category, preventing dual-entry bookkeeping.

---

## 6. Returns & Adjustments

1. **Patient Returns (`PharmacyReturn` & `PharmacyReturnItem`)**:
   - Referenced to an original `PharmacyDispensation`.
   - Validates that returned quantity does not exceed original dispensed quantity minus previously returned quantities.
   - Restocks to batch inventory only if condition is `SALEABLE`. Damaged or opened medications are written off.
   - Generates `CUSTOMER_RETURN` stock movement.
2. **Supplier Returns**:
   - Deducts from batch inventory and generates `SUPPLIER_RETURN` stock movement.
3. **Stock Adjustments (`StockAdjustment` & `StockAdjustmentItem`)**:
   - Records physical stock counts, calculates variance (`difference = physical - system`), and upon approval adjustments generate `STOCK_ADJUSTMENT_IN` or `STOCK_ADJUSTMENT_OUT` ledger entries.
