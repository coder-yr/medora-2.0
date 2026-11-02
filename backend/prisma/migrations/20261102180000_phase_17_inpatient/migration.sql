-- Phase 17: Inpatient, Ward and Bed Management System Migration

-- 1. BedCategory (Wards)
ALTER TABLE "bed_category" ADD COLUMN IF NOT EXISTS "code" VARCHAR(50);
ALTER TABLE "bed_category" ADD COLUMN IF NOT EXISTS "base_rate" DECIMAL(10, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE "bed_category" ADD COLUMN IF NOT EXISTS "billing_unit" VARCHAR(20) NOT NULL DEFAULT 'DAILY';
ALTER TABLE "bed_category" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "bed_category" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "bed_category" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ;

-- 2. Bed (Bed Register)
ALTER TABLE "bed" ALTER COLUMN "status" SET DEFAULT 'AVAILABLE';
ALTER TABLE "bed" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS "bed_status_idx" ON "bed"("status");

-- 3. Admissions
CREATE TABLE IF NOT EXISTS "admissions" (
    "id" BIGSERIAL PRIMARY KEY,
    "admission_number" VARCHAR(50) NOT NULL,
    "patient_id" BIGINT NOT NULL,
    "attending_doctor_id" BIGINT,
    "admitting_doctor_id" BIGINT,
    "ward_id" BIGINT NOT NULL,
    "bed_id" BIGINT NOT NULL,
    "admission_date" TIMESTAMPTZ NOT NULL,
    "expected_discharge_date" TIMESTAMPTZ,
    "actual_discharge_date" TIMESTAMPTZ,
    "admission_type" VARCHAR(50) NOT NULL DEFAULT 'ELECTIVE',
    "admission_reason" TEXT,
    "diagnosis" TEXT,
    "clinical_notes" TEXT,
    "status" VARCHAR(50) NOT NULL DEFAULT 'ADMITTED',
    "discharge_summary" TEXT,
    "discharge_condition" VARCHAR(100),
    "created_by" BIGINT,
    "discharged_by" BIGINT,
    "branch_id" BIGINT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,
    CONSTRAINT "admissions_admission_number_key" UNIQUE ("admission_number"),
    CONSTRAINT "admissions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "admissions_attending_doctor_id_fkey" FOREIGN KEY ("attending_doctor_id") REFERENCES "doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "admissions_admitting_doctor_id_fkey" FOREIGN KEY ("admitting_doctor_id") REFERENCES "doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "admissions_ward_id_fkey" FOREIGN KEY ("ward_id") REFERENCES "bed_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "admissions_bed_id_fkey" FOREIGN KEY ("bed_id") REFERENCES "bed"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "admissions_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "hospital_branch"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "admissions_patient_id_idx" ON "admissions"("patient_id");
CREATE INDEX IF NOT EXISTS "admissions_bed_id_idx" ON "admissions"("bed_id");
CREATE INDEX IF NOT EXISTS "admissions_ward_id_idx" ON "admissions"("ward_id");
CREATE INDEX IF NOT EXISTS "admissions_status_idx" ON "admissions"("status");
CREATE INDEX IF NOT EXISTS "admissions_admission_date_idx" ON "admissions"("admission_date");

-- 4. Bed Allocation History
CREATE TABLE IF NOT EXISTS "bed_allocation_history" (
    "id" BIGSERIAL PRIMARY KEY,
    "admission_id" BIGINT NOT NULL,
    "bed_id" BIGINT NOT NULL,
    "allocated_at" TIMESTAMPTZ NOT NULL,
    "released_at" TIMESTAMPTZ,
    "rate_snapshot" DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    "transfer_reason" VARCHAR(255),
    "allocated_by" BIGINT,
    "released_by" BIGINT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,
    CONSTRAINT "bed_allocation_history_admission_id_fkey" FOREIGN KEY ("admission_id") REFERENCES "admissions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "bed_allocation_history_bed_id_fkey" FOREIGN KEY ("bed_id") REFERENCES "bed"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "bed_allocation_history_admission_id_idx" ON "bed_allocation_history"("admission_id");
CREATE INDEX IF NOT EXISTS "bed_allocation_history_bed_id_idx" ON "bed_allocation_history"("bed_id");
CREATE INDEX IF NOT EXISTS "bed_allocation_history_released_at_idx" ON "bed_allocation_history"("released_at");

-- 5. Inpatient Folios
CREATE TABLE IF NOT EXISTS "inpatient_folios" (
    "id" BIGSERIAL PRIMARY KEY,
    "folio_number" VARCHAR(50) NOT NULL,
    "admission_id" BIGINT NOT NULL,
    "patient_id" BIGINT NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'OPEN',
    "total_charges" DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    "total_paid" DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    "balance" DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    "settled_at" TIMESTAMPTZ,
    "settled_by" BIGINT,
    "final_invoice_id" BIGINT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,
    CONSTRAINT "inpatient_folios_folio_number_key" UNIQUE ("folio_number"),
    CONSTRAINT "inpatient_folios_admission_id_key" UNIQUE ("admission_id"),
    CONSTRAINT "inpatient_folios_admission_id_fkey" FOREIGN KEY ("admission_id") REFERENCES "admissions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "inpatient_folios_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "inpatient_folios_final_invoice_id_fkey" FOREIGN KEY ("final_invoice_id") REFERENCES "payment"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "inpatient_folios_patient_id_idx" ON "inpatient_folios"("patient_id");
CREATE INDEX IF NOT EXISTS "inpatient_folios_status_idx" ON "inpatient_folios"("status");

-- 6. Inpatient Folio Items
CREATE TABLE IF NOT EXISTS "inpatient_folio_items" (
    "id" BIGSERIAL PRIMARY KEY,
    "folio_id" BIGINT NOT NULL,
    "source_module" VARCHAR(50) NOT NULL,
    "source_record_id" VARCHAR(100),
    "idempotency_key" VARCHAR(150),
    "charge_category" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(10, 2) NOT NULL,
    "total_amount" DECIMAL(12, 2) NOT NULL,
    "posted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "posted_by" BIGINT,
    "is_reversed" BOOLEAN NOT NULL DEFAULT false,
    "reversed_at" TIMESTAMPTZ,
    "reversed_by" BIGINT,
    "reversal_reason" VARCHAR(255),
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,
    CONSTRAINT "inpatient_folio_items_idempotency_key_key" UNIQUE ("idempotency_key"),
    CONSTRAINT "inpatient_folio_items_folio_id_fkey" FOREIGN KEY ("folio_id") REFERENCES "inpatient_folios"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "inpatient_folio_items_folio_id_idx" ON "inpatient_folio_items"("folio_id");
CREATE INDEX IF NOT EXISTS "inpatient_folio_items_source_module_source_record_id_idx" ON "inpatient_folio_items"("source_module", "source_record_id");

-- 7. Foreign key integrations into existing clinical & financial tables
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "admission_id" BIGINT;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_admission_id_fkey') THEN
        ALTER TABLE "payment" ADD CONSTRAINT "payment_admission_id_fkey" FOREIGN KEY ("admission_id") REFERENCES "admissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS "payment_admission_id_idx" ON "payment"("admission_id");

ALTER TABLE "pharmacy_dispensation" ADD COLUMN IF NOT EXISTS "admission_id" BIGINT;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pharmacy_dispensation_admission_id_fkey') THEN
        ALTER TABLE "pharmacy_dispensation" ADD CONSTRAINT "pharmacy_dispensation_admission_id_fkey" FOREIGN KEY ("admission_id") REFERENCES "admissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS "pharmacy_dispensation_admission_id_idx" ON "pharmacy_dispensation"("admission_id");

ALTER TABLE "lab" ADD COLUMN IF NOT EXISTS "admission_id" BIGINT;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lab_admission_id_fkey') THEN
        ALTER TABLE "lab" ADD CONSTRAINT "lab_admission_id_fkey" FOREIGN KEY ("admission_id") REFERENCES "admissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS "lab_admission_id_idx" ON "lab"("admission_id");

ALTER TABLE "radiology_order" ADD COLUMN IF NOT EXISTS "admission_id" BIGINT;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'radiology_order_admission_id_fkey') THEN
        ALTER TABLE "radiology_order" ADD CONSTRAINT "radiology_order_admission_id_fkey" FOREIGN KEY ("admission_id") REFERENCES "admissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS "radiology_order_admission_id_idx" ON "radiology_order"("admission_id");
