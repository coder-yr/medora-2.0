-- Phase 10.5.5: Laboratory Integration & Diagnostic Workflow

-- 1. Add tenant and branch isolation columns to "lab"
ALTER TABLE "lab"
  ADD COLUMN IF NOT EXISTS "organization_id" BIGINT,
  ADD COLUMN IF NOT EXISTS "branch_id" BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lab_organization_id_fkey'
  ) THEN
    ALTER TABLE "lab"
      ADD CONSTRAINT "lab_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lab_branch_id_fkey'
  ) THEN
    ALTER TABLE "lab"
      ADD CONSTRAINT "lab_branch_id_fkey"
      FOREIGN KEY ("branch_id") REFERENCES "hospital_branch"("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "lab_organization_id_idx" ON "lab"("organization_id");
CREATE INDEX IF NOT EXISTS "lab_branch_id_idx" ON "lab"("branch_id");

-- 2. Add catalogue and critical range fields to "lab_category"
ALTER TABLE "lab_category"
  ADD COLUMN IF NOT EXISTS "code" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "department" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "specimen_type" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "collection_notes" TEXT,
  ADD COLUMN IF NOT EXISTS "critical_low" NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS "critical_high" NUMERIC(10, 2);

CREATE INDEX IF NOT EXISTS "lab_category_code_idx" ON "lab_category"("code");
CREATE INDEX IF NOT EXISTS "lab_category_department_idx" ON "lab_category"("department");

-- 3. Add sample tracking, condition, and recollection fields to "lab_sample"
ALTER TABLE "lab_sample"
  ADD COLUMN IF NOT EXISTS "collector_location" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "condition" VARCHAR(50) DEFAULT 'SUITABLE',
  ADD COLUMN IF NOT EXISTS "is_recollection" BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "recollected_from_id" BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lab_sample_recollected_from_id_fkey'
  ) THEN
    ALTER TABLE "lab_sample"
      ADD CONSTRAINT "lab_sample_recollected_from_id_fkey"
      FOREIGN KEY ("recollected_from_id") REFERENCES "lab_sample"("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "lab_sample_recollected_from_id_idx" ON "lab_sample"("recollected_from_id");

-- 4. Add audit columns to "lab_result_parameter"
ALTER TABLE "lab_result_parameter"
  ADD COLUMN IF NOT EXISTS "entered_by_id" BIGINT,
  ADD COLUMN IF NOT EXISTS "entered_at" TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lab_result_parameter_entered_by_id_fkey'
  ) THEN
    ALTER TABLE "lab_result_parameter"
      ADD CONSTRAINT "lab_result_parameter_entered_by_id_fkey"
      FOREIGN KEY ("entered_by_id") REFERENCES "users"("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "lab_result_parameter_entered_by_id_idx" ON "lab_result_parameter"("entered_by_id");
