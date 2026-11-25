-- Phase 10.5.4: Prescription Management, Lifecycle & Clinical Safety
-- Add tenant, consultation, signature, lifecycle, and business number columns to prescription

ALTER TABLE "prescription"
  ADD COLUMN IF NOT EXISTS "prescription_number" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "consultation_id" BIGINT,
  ADD COLUMN IF NOT EXISTS "organization_id" BIGINT,
  ADD COLUMN IF NOT EXISTS "branch_id" BIGINT,
  ADD COLUMN IF NOT EXISTS "status" VARCHAR(30) DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS "signed_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "signed_by_id" BIGINT,
  ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "cancelled_by_id" BIGINT,
  ADD COLUMN IF NOT EXISTS "cancellation_reason" TEXT;

-- Create Unique constraint on prescription_number
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'prescription_prescription_number_key'
  ) THEN
    ALTER TABLE "prescription" ADD CONSTRAINT "prescription_prescription_number_key" UNIQUE ("prescription_number");
  END IF;
END $$;

-- Populate prescription_number for existing records if null
UPDATE "prescription"
SET "prescription_number" = 'RX-LEGACY-' || LPAD(id::text, 6, '0'),
    "status" = CASE WHEN "state" = 'dispensed' THEN 'DISPENSED' ELSE 'SIGNED' END
WHERE "prescription_number" IS NULL;

-- Foreign Keys on prescription
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'prescription_consultation_id_fkey'
  ) THEN
    ALTER TABLE "prescription"
      ADD CONSTRAINT "prescription_consultation_id_fkey"
      FOREIGN KEY ("consultation_id") REFERENCES "consultation"("id") ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'prescription_organization_id_fkey'
  ) THEN
    ALTER TABLE "prescription"
      ADD CONSTRAINT "prescription_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'prescription_branch_id_fkey'
  ) THEN
    ALTER TABLE "prescription"
      ADD CONSTRAINT "prescription_branch_id_fkey"
      FOREIGN KEY ("branch_id") REFERENCES "hospital_branch"("id") ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'prescription_signed_by_id_fkey'
  ) THEN
    ALTER TABLE "prescription"
      ADD CONSTRAINT "prescription_signed_by_id_fkey"
      FOREIGN KEY ("signed_by_id") REFERENCES "users"("id") ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'prescription_cancelled_by_id_fkey'
  ) THEN
    ALTER TABLE "prescription"
      ADD CONSTRAINT "prescription_cancelled_by_id_fkey"
      FOREIGN KEY ("cancelled_by_id") REFERENCES "users"("id") ON DELETE SET NULL;
  END IF;
END $$;

-- Indexes on prescription
CREATE INDEX IF NOT EXISTS "prescription_consultation_id_idx" ON "prescription"("consultation_id");
CREATE INDEX IF NOT EXISTS "prescription_organization_id_idx" ON "prescription"("organization_id");
CREATE INDEX IF NOT EXISTS "prescription_branch_id_idx" ON "prescription"("branch_id");
CREATE INDEX IF NOT EXISTS "prescription_status_idx" ON "prescription"("status");

-- Add clinical line item fields to prescription_medicine
ALTER TABLE "prescription_medicine"
  ADD COLUMN IF NOT EXISTS "quantity_prescribed" INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "unit" VARCHAR(30),
  ADD COLUMN IF NOT EXISTS "route" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "frequency" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "timing" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "refills" INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "start_date" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "end_date" VARCHAR(50);

-- Create prescription_amendment table for auditable corrections to signed prescriptions
CREATE TABLE IF NOT EXISTS "prescription_amendment" (
  "id" BIGSERIAL PRIMARY KEY,
  "prescription_id" BIGINT NOT NULL,
  "amended_by" BIGINT NOT NULL,
  "reason" TEXT NOT NULL,
  "amended_section" VARCHAR(50) NOT NULL DEFAULT 'GENERAL',
  "previous_notes" TEXT,
  "new_notes" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT "prescription_amendment_prescription_id_fkey"
    FOREIGN KEY ("prescription_id") REFERENCES "prescription"("id") ON DELETE CASCADE,
  CONSTRAINT "prescription_amendment_amended_by_fkey"
    FOREIGN KEY ("amended_by") REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "prescription_amendment_prescription_id_idx" ON "prescription_amendment"("prescription_id");
CREATE INDEX IF NOT EXISTS "prescription_amendment_amended_by_idx" ON "prescription_amendment"("amended_by");
