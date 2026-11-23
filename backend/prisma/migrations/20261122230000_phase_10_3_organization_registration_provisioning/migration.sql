-- Phase 10.3: Organization Registration, Super Admin Approval & Automated Provisioning

-- 1. Create RegistrationStatus Enum if not exists
DO $$ BEGIN
  CREATE TYPE "registration_status" AS ENUM (
    'DRAFT',
    'PENDING_EMAIL_VERIFICATION',
    'PENDING_APPROVAL',
    'APPROVED',
    'REJECTED',
    'PROVISIONING',
    'ACTIVE',
    'SUSPENDED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Create organization_registrations table
CREATE TABLE IF NOT EXISTS "organization_registrations" (
  "id" BIGSERIAL PRIMARY KEY,
  "reference" VARCHAR(50) NOT NULL UNIQUE,
  "status" "registration_status" NOT NULL DEFAULT 'PENDING_EMAIL_VERIFICATION',
  "organization_name" VARCHAR(150) NOT NULL,
  "organization_type" "organization_type" NOT NULL DEFAULT 'HOSPITAL',
  "requested_edition" "organization_edition" NOT NULL DEFAULT 'HOSPITAL',
  "healthcare_specialization" VARCHAR(100),
  "license_number" VARCHAR(100),
  "organization_email" VARCHAR(100) NOT NULL,
  "contact_phone" VARCHAR(50) NOT NULL,
  "country" VARCHAR(100) NOT NULL DEFAULT 'Pakistan',
  "state" VARCHAR(100),
  "city" VARCHAR(100) NOT NULL,
  "address" VARCHAR(255),
  "postal_code" VARCHAR(20),
  "website" VARCHAR(150),
  "admin_full_name" VARCHAR(100) NOT NULL,
  "admin_email" VARCHAR(100) NOT NULL,
  "admin_phone" VARCHAR(50),
  "admin_designation" VARCHAR(100),
  "email_verification_token" VARCHAR(255),
  "email_verification_expires_at" TIMESTAMPTZ,
  "is_email_verified" BOOLEAN NOT NULL DEFAULT false,
  "email_verified_at" TIMESTAMPTZ,
  "verification_attempts" INTEGER NOT NULL DEFAULT 0,
  "last_verification_sent_at" TIMESTAMPTZ,
  "approved_by_id" BIGINT REFERENCES "users"("id") ON DELETE SET NULL,
  "approved_at" TIMESTAMPTZ,
  "rejected_by_id" BIGINT REFERENCES "users"("id") ON DELETE SET NULL,
  "rejected_at" TIMESTAMPTZ,
  "rejection_reason" TEXT,
  "approved_edition" "organization_edition",
  "approved_modules" JSONB DEFAULT '[]'::jsonb,
  "organization_id" BIGINT UNIQUE REFERENCES "organizations"("id") ON DELETE SET NULL,
  "provisioned_at" TIMESTAMPTZ,
  "provisioning_error" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "organization_registrations_status_idx" ON "organization_registrations"("status");
CREATE INDEX IF NOT EXISTS "organization_registrations_org_email_idx" ON "organization_registrations"("organization_email");
CREATE INDEX IF NOT EXISTS "organization_registrations_admin_email_idx" ON "organization_registrations"("admin_email");
CREATE INDEX IF NOT EXISTS "organization_registrations_created_at_idx" ON "organization_registrations"("created_at");

-- 3. Create organization_onboardings table
CREATE TABLE IF NOT EXISTS "organization_onboardings" (
  "id" BIGSERIAL PRIMARY KEY,
  "organization_id" BIGINT NOT NULL UNIQUE REFERENCES "organizations"("id") ON DELETE CASCADE,
  "is_completed" BOOLEAN NOT NULL DEFAULT false,
  "completed_at" TIMESTAMPTZ,
  "completed_by_id" BIGINT REFERENCES "users"("id") ON DELETE SET NULL,
  "current_step" VARCHAR(50) NOT NULL DEFAULT 'profile',
  "checklist" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
