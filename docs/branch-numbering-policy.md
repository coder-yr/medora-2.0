# Branch Numbering Policy & Concurrency Safety
## Medora 2.0 — Phase 21 Specification

### 1. Business Requirements & Problem Statement
In a multi-facility hospital system, invoice numbers (`INV-0001`), medical record numbers (`MRN-0001`), appointment numbers (`APT-0001`), and admission numbers (`ADM-0001`) must:
1. **Uniquely Identify Origin Facility**: Healthcare staff, patients, and insurance auditors must immediately identify which facility issued the document.
2. **Prevent Collisions Across Branches**: Independent branch operations must never generate duplicate document numbers, even when generating hundreds of invoices per hour simultaneously.
3. **Guarantee Strict Monotonic Ordering & Concurrency Safety**: High-concurrency cashier desks at the same branch must not generate duplicate numbers or produce race conditions.

---

### 2. Document Number Format Specification

Medora 2.0 uses a structured, standardized numbering format across all branches:

$$\text{Document Number} = \langle\text{Branch Prefix}\rangle - \langle\text{Year}\rangle - \langle\text{Zero-Padded Sequence}\rangle$$

Examples:
- **Invoices**: `INV-MAIN-2026-000042` or `INV-KHI-2026-000128`
- **Medical Records (MRN)**: `MRN-MAIN-2026-001099` or `MRN-LHR-2026-000301`
- **Admissions**: `ADM-MAIN-2026-000512`
- **Appointments**: `APT-MAIN-2026-003410`

#### Branch-Level Overrides:
Each branch can configure custom prefixes in `BranchSettings`:
- `invoicePrefix`: Overrides default `INV-<BRANCH_CODE>-` (e.g., `INV-ISB-`).
- `mrnPrefix`: Overrides default `MRN-<BRANCH_CODE>-` (e.g., `MRN-ISB-`).
- `appointmentPrefix`: Overrides default `APT-<BRANCH_CODE>-`.
- `admissionPrefix`: Overrides default `ADM-<BRANCH_CODE>-`.

If no branch override is defined, the system defaults to `PREFIX-<BRANCH_CODE>-`. If the branch has no code, `PREFIX-MAIN-` is used.

---

### 3. Concurrency Safety & Allocation Mechanism

To prevent duplicate numbers under concurrent workloads, Medora 2.0 provides two complementary mechanisms:

#### A. Database Sequence / Advisory Lock Pattern (Recommended)
When generating document numbers in transactional workflows:
```sql
-- PostgreSQL Transaction with Branch-Document Advisory Lock
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('NUMBER_SEQ_' || branch_id || '_' || doc_type));

-- Query current maximum sequence for branch and year
SELECT COALESCE(MAX(sequence_num), 0) + 1 AS next_seq
FROM branch_document_sequences
WHERE branch_id = $1 AND doc_type = $2 AND year = $3;

-- Insert or update sequence record
INSERT INTO branch_document_sequences (branch_id, doc_type, year, sequence_num)
VALUES ($1, $2, $3, next_seq)
ON CONFLICT (branch_id, doc_type, year)
DO UPDATE SET sequence_num = EXCLUDED.sequence_num;

COMMIT;
```

#### B. Unique Constraint Guarantee & Retry Protocol
Every document table enforces a database-level `UNIQUE` constraint on the generated reference number:
- `payment`: `invoice_number VARCHAR(50) UNIQUE`
- `patient`: `patient_id VARCHAR(50) UNIQUE`
- `admission`: `admission_number VARCHAR(50) UNIQUE`

If an unexpected lock timeout or sequence collision occurs, the service layer intercepts the unique constraint violation (`23505` error code) and automatically retries sequence generation up to 3 times with exponential backoff before throwing an error.

---

### 4. Implementation Helper: `BranchNumberingService`
The `BranchNumberingService` provides standard generator methods:
```typescript
generateInvoiceNumber(branchId: bigint): Promise<string>;
generateMrn(branchId: bigint): Promise<string>;
generateAppointmentNumber(branchId: bigint): Promise<string>;
generateAdmissionNumber(branchId: bigint): Promise<string>;
```
Each method:
1. Retrieves effective prefix from `BranchSettings` (with fallback to `HospitalBranch.code`).
2. Calculates the current year (`YYYY`).
3. Safely obtains the next increment using PostgreSQL atomic sequence / transactional lock.
4. Returns the zero-padded formatted string (e.g. `INV-MAIN-2026-000001`).
