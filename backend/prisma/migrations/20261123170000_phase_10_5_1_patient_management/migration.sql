-- AlterTable patient
ALTER TABLE "patient" ADD COLUMN IF NOT EXISTS "emergency_contact_name" VARCHAR(100);
ALTER TABLE "patient" ADD COLUMN IF NOT EXISTS "emergency_contact_phone" VARCHAR(50);
ALTER TABLE "patient" ADD COLUMN IF NOT EXISTS "emergency_contact_relation" VARCHAR(50);
ALTER TABLE "patient" ADD COLUMN IF NOT EXISTS "allergies" TEXT;
ALTER TABLE "patient" ADD COLUMN IF NOT EXISTS "medical_history" TEXT;
ALTER TABLE "patient" ADD COLUMN IF NOT EXISTS "surgical_history" TEXT;
ALTER TABLE "patient" ADD COLUMN IF NOT EXISTS "family_history" TEXT;
ALTER TABLE "patient" ADD COLUMN IF NOT EXISTS "current_medications" TEXT;

-- CreateTable patient_documents
CREATE TABLE IF NOT EXISTS "patient_documents" (
    "id" BIGSERIAL NOT NULL,
    "patient_id" BIGINT NOT NULL,
    "branch_id" BIGINT,
    "title" VARCHAR(150) NOT NULL,
    "document_type" VARCHAR(50) NOT NULL DEFAULT 'GENERAL',
    "file_url" VARCHAR(500) NOT NULL,
    "file_size" INTEGER,
    "mime_type" VARCHAR(100),
    "notes" TEXT,
    "uploaded_by_id" BIGINT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "patient_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "patient_documents_patient_id_idx" ON "patient_documents"("patient_id");
CREATE INDEX IF NOT EXISTS "patient_documents_branch_id_idx" ON "patient_documents"("branch_id");

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'patient_documents_patient_id_fkey') THEN
        ALTER TABLE "patient_documents" ADD CONSTRAINT "patient_documents_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'patient_documents_branch_id_fkey') THEN
        ALTER TABLE "patient_documents" ADD CONSTRAINT "patient_documents_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "hospital_branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'patient_documents_uploaded_by_id_fkey') THEN
        ALTER TABLE "patient_documents" ADD CONSTRAINT "patient_documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
