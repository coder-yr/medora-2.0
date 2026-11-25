-- Phase 10.5.3: Doctor Workspace, Clinical Encounters & SOAP Documentation

-- 1. Enhance consultation table with SOAP, structured vitals, diagnoses, and digital signature
ALTER TABLE consultation ADD COLUMN IF NOT EXISTS soap_subjective TEXT;
ALTER TABLE consultation ADD COLUMN IF NOT EXISTS soap_objective TEXT;
ALTER TABLE consultation ADD COLUMN IF NOT EXISTS soap_assessment TEXT;
ALTER TABLE consultation ADD COLUMN IF NOT EXISTS soap_plan TEXT;
ALTER TABLE consultation ADD COLUMN IF NOT EXISTS chief_complaint_details JSONB;
ALTER TABLE consultation ADD COLUMN IF NOT EXISTS hpi_details JSONB;
ALTER TABLE consultation ADD COLUMN IF NOT EXISTS vitals JSONB;
ALTER TABLE consultation ADD COLUMN IF NOT EXISTS diagnoses JSONB;
ALTER TABLE consultation ADD COLUMN IF NOT EXISTS treatment_plan JSONB;
ALTER TABLE consultation ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;
ALTER TABLE consultation ADD COLUMN IF NOT EXISTS signed_by_id BIGINT;
ALTER TABLE consultation ADD COLUMN IF NOT EXISTS branch_id BIGINT;
ALTER TABLE consultation ADD COLUMN IF NOT EXISTS allergy_status VARCHAR(30) DEFAULT 'UNKNOWN';

-- 2. Create consultation amendment audit table
CREATE TABLE IF NOT EXISTS consultation_amendment (
  id BIGSERIAL PRIMARY KEY,
  consultation_id BIGINT NOT NULL REFERENCES consultation(id) ON DELETE CASCADE,
  amended_by BIGINT NOT NULL REFERENCES "users"(id),
  reason TEXT NOT NULL,
  amended_section VARCHAR(50) NOT NULL,
  previous_notes TEXT,
  new_notes TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Indexes for rapid lookups and branch authorization
CREATE INDEX IF NOT EXISTS idx_consultation_amendment_consultation_id ON consultation_amendment(consultation_id);
CREATE INDEX IF NOT EXISTS idx_consultation_amendment_amended_by ON consultation_amendment(amended_by);
CREATE INDEX IF NOT EXISTS idx_consultation_branch_id ON consultation(branch_id);
CREATE INDEX IF NOT EXISTS idx_consultation_signed_by_id ON consultation(signed_by_id);

-- 4. Foreign key constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_consultation_branch'
  ) THEN
    ALTER TABLE consultation ADD CONSTRAINT fk_consultation_branch FOREIGN KEY (branch_id) REFERENCES hospital_branch(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_consultation_signed_by'
  ) THEN
    ALTER TABLE consultation ADD CONSTRAINT fk_consultation_signed_by FOREIGN KEY (signed_by_id) REFERENCES "users"(id) ON DELETE SET NULL;
  END IF;
END $$;
