-- Phase 10.1: Organization & Tenant Foundation Migration
-- Additive, Non-Destructive Schema Evolution

-- 1. Create Enums if they do not exist
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'organization_type') THEN
        CREATE TYPE "organization_type" AS ENUM ('CLINIC', 'POLYCLINIC', 'DIAGNOSTIC_CENTER', 'HOSPITAL', 'HOSPITAL_NETWORK');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'organization_status') THEN
        CREATE TYPE "organization_status" AS ENUM ('ACTIVE', 'TRIAL', 'SUSPENDED', 'INACTIVE');
    END IF;
END $$;

-- 2. Create Organizations Table
CREATE TABLE IF NOT EXISTS "organizations" (
    "id" BIGSERIAL PRIMARY KEY,
    "name" VARCHAR(150) NOT NULL,
    "code" VARCHAR(50) NOT NULL UNIQUE,
    "type" "organization_type" NOT NULL DEFAULT 'HOSPITAL',
    "status" "organization_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS "organizations_code_idx" ON "organizations"("code");
CREATE INDEX IF NOT EXISTS "organizations_status_idx" ON "organizations"("status");

-- 3. Create Organization Settings Table
CREATE TABLE IF NOT EXISTS "organization_settings" (
    "id" BIGSERIAL PRIMARY KEY,
    "organization_id" BIGINT NOT NULL UNIQUE REFERENCES "organizations"("id") ON DELETE CASCADE,
    "legal_name" VARCHAR(150),
    "registration_number" VARCHAR(50),
    "tax_number" VARCHAR(50),
    "email" VARCHAR(100),
    "phone" VARCHAR(50),
    "website" VARCHAR(150),
    "address" VARCHAR(255),
    "default_locale" VARCHAR(10) NOT NULL DEFAULT 'en',
    "default_timezone" VARCHAR(50) NOT NULL DEFAULT 'Asia/Karachi',
    "default_currency" VARCHAR(10) NOT NULL DEFAULT 'PKR',
    "date_format" VARCHAR(20) NOT NULL DEFAULT 'YYYY-MM-DD',
    "time_format" VARCHAR(20) NOT NULL DEFAULT 'HH:mm',
    "logo_url" VARCHAR(500),
    "favicon_url" VARCHAR(500),
    "primary_color" VARCHAR(10) NOT NULL DEFAULT '#0284c7',
    "secondary_color" VARCHAR(10) NOT NULL DEFAULT '#0f172a',
    "receipt_header" TEXT,
    "receipt_footer" TEXT,
    "invoice_footer" TEXT,
    "enabled_modules" JSONB,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_by_id" BIGINT REFERENCES "users"("id") ON DELETE SET NULL
);

-- 4. Create User Organization Memberships Table
CREATE TABLE IF NOT EXISTS "user_organization_memberships" (
    "id" BIGSERIAL PRIMARY KEY,
    "user_id" BIGINT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "organization_id" BIGINT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "access_role" VARCHAR(50),
    "assigned_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by_id" BIGINT REFERENCES "users"("id") ON DELETE SET NULL,
    "revoked_at" TIMESTAMPTZ,
    "revoked_by_id" BIGINT REFERENCES "users"("id") ON DELETE SET NULL,
    "notes" VARCHAR(255),
    CONSTRAINT "user_organization_memberships_user_id_organization_id_key" UNIQUE ("user_id", "organization_id")
);

CREATE INDEX IF NOT EXISTS "user_organization_memberships_user_id_idx" ON "user_organization_memberships"("user_id");
CREATE INDEX IF NOT EXISTS "user_organization_memberships_organization_id_idx" ON "user_organization_memberships"("organization_id");

-- 5. Add Nullable Organization Reference to Existing Models
ALTER TABLE "hospital_branch" ADD COLUMN IF NOT EXISTS "organization_id" BIGINT REFERENCES "organizations"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "hospital_branch_organization_id_idx" ON "hospital_branch"("organization_id");

ALTER TABLE "hospital_settings" ADD COLUMN IF NOT EXISTS "organization_id" BIGINT REFERENCES "organizations"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "hospital_settings_organization_id_idx" ON "hospital_settings"("organization_id");

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "organization_id" BIGINT REFERENCES "organizations"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "users_organization_id_idx" ON "users"("organization_id");

-- 6. Backfill Default Organization for Existing Hospital Installation
INSERT INTO "organizations" ("name", "code", "type", "status", "created_at", "updated_at")
VALUES ('Medora Healthcare System', 'MEDORA-HOSP-01', 'HOSPITAL', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- 7. Backfill Organization Settings from Existing Hospital Settings
INSERT INTO "organization_settings" (
    "organization_id",
    "legal_name",
    "registration_number",
    "tax_number",
    "email",
    "phone",
    "website",
    "address",
    "default_locale",
    "default_timezone",
    "default_currency",
    "date_format",
    "time_format",
    "logo_url",
    "favicon_url",
    "primary_color",
    "secondary_color",
    "receipt_header",
    "receipt_footer",
    "invoice_footer",
    "created_at",
    "updated_at"
)
SELECT 
    o.id,
    COALESCE(hs.legal_name, 'Medora Healthcare System'),
    hs.registration_number,
    hs.tax_number,
    COALESCE(hs.email, 'info@medora.hospital'),
    hs.phone,
    hs.website,
    hs.address,
    COALESCE(hs.default_locale, 'en'),
    COALESCE(hs.default_timezone, 'Asia/Karachi'),
    COALESCE(hs.default_currency, 'PKR'),
    COALESCE(hs.date_format, 'YYYY-MM-DD'),
    COALESCE(hs.time_format, 'HH:mm'),
    hs.logo_url,
    hs.favicon_url,
    COALESCE(hs.primary_color, '#0284c7'),
    COALESCE(hs.secondary_color, '#0f172a'),
    hs.receipt_header,
    hs.receipt_footer,
    hs.invoice_footer,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "organizations" o
LEFT JOIN (SELECT * FROM "hospital_settings" LIMIT 1) hs ON true
WHERE o.code = 'MEDORA-HOSP-01'
ON CONFLICT ("organization_id") DO NOTHING;

-- 8. Backfill Organization Relationship on Existing Branches
UPDATE "hospital_branch"
SET "organization_id" = (SELECT id FROM "organizations" WHERE "code" = 'MEDORA-HOSP-01' LIMIT 1)
WHERE "organization_id" IS NULL;

-- 9. Backfill Organization Relationship on Existing Hospital Settings
UPDATE "hospital_settings"
SET "organization_id" = (SELECT id FROM "organizations" WHERE "code" = 'MEDORA-HOSP-01' LIMIT 1)
WHERE "organization_id" IS NULL;

-- 10. Backfill Organization Relationship on Existing Users
UPDATE "users"
SET "organization_id" = (SELECT id FROM "organizations" WHERE "code" = 'MEDORA-HOSP-01' LIMIT 1)
WHERE "organization_id" IS NULL;

-- 11. Create Default Organization Membership for All Existing Users
INSERT INTO "user_organization_memberships" ("user_id", "organization_id", "is_default", "is_active", "access_role", "assigned_at")
SELECT u.id, o.id, true, true, u.group, CURRENT_TIMESTAMP
FROM "users" u
CROSS JOIN (SELECT id FROM "organizations" WHERE "code" = 'MEDORA-HOSP-01' LIMIT 1) o
ON CONFLICT ("user_id", "organization_id") DO NOTHING;
