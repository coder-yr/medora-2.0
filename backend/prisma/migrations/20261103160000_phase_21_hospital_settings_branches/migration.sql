-- Phase 21: Hospital Settings, Branding & Multi-Branch Management Migration

-- 1. Hospital-Wide Settings
CREATE TABLE IF NOT EXISTS "hospital_settings" (
    "id" BIGSERIAL PRIMARY KEY,
    "hospital_name" VARCHAR(150) NOT NULL,
    "legal_name" VARCHAR(150),
    "registration_number" VARCHAR(50),
    "tax_number" VARCHAR(50),
    "email" VARCHAR(100),
    "phone" VARCHAR(50),
    "alternate_phone" VARCHAR(50),
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
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_by_id" BIGINT REFERENCES "users"("id") ON DELETE SET NULL
);

-- 2. Branch-Level Settings
CREATE TABLE IF NOT EXISTS "branch_settings" (
    "id" BIGSERIAL PRIMARY KEY,
    "branch_id" BIGINT NOT NULL UNIQUE REFERENCES "hospital_branch"("id") ON DELETE CASCADE,
    "operating_hours" JSONB,
    "timezone_override" VARCHAR(50),
    "currency_override" VARCHAR(10),
    "receipt_header_override" TEXT,
    "receipt_footer_override" TEXT,
    "invoice_prefix" VARCHAR(20),
    "mrn_prefix" VARCHAR(20),
    "appointment_prefix" VARCHAR(20),
    "admission_prefix" VARCHAR(20),
    "logo_url_override" VARCHAR(500),
    "primary_color_override" VARCHAR(10),
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_by_id" BIGINT REFERENCES "users"("id") ON DELETE SET NULL
);

-- 3. User Branch Memberships (Multi-Branch Access)
CREATE TABLE IF NOT EXISTS "user_branch_memberships" (
    "id" BIGSERIAL PRIMARY KEY,
    "user_id" BIGINT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "branch_id" BIGINT NOT NULL REFERENCES "hospital_branch"("id") ON DELETE CASCADE,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "access_role" VARCHAR(50),
    "assigned_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by_id" BIGINT REFERENCES "users"("id") ON DELETE SET NULL,
    "revoked_at" TIMESTAMPTZ,
    "revoked_by_id" BIGINT REFERENCES "users"("id") ON DELETE SET NULL,
    "notes" VARCHAR(255),
    CONSTRAINT "user_branch_memberships_user_id_branch_id_key" UNIQUE ("user_id", "branch_id")
);

CREATE INDEX IF NOT EXISTS "user_branch_memberships_user_id_idx" ON "user_branch_memberships"("user_id");
CREATE INDEX IF NOT EXISTS "user_branch_memberships_branch_id_idx" ON "user_branch_memberships"("branch_id");

-- 4. Configuration Change Audit Log
CREATE TABLE IF NOT EXISTS "configuration_audit_logs" (
    "id" BIGSERIAL PRIMARY KEY,
    "actor_user_id" BIGINT REFERENCES "users"("id") ON DELETE SET NULL,
    "scope" VARCHAR(20) NOT NULL,
    "branch_id" BIGINT REFERENCES "hospital_branch"("id") ON DELETE SET NULL,
    "setting_key" VARCHAR(100) NOT NULL,
    "previous_value" TEXT,
    "new_value" TEXT,
    "change_reason" VARCHAR(255),
    "correlation_id" VARCHAR(100),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "configuration_audit_logs_scope_setting_key_idx" ON "configuration_audit_logs"("scope", "setting_key");
CREATE INDEX IF NOT EXISTS "configuration_audit_logs_branch_id_idx" ON "configuration_audit_logs"("branch_id");
CREATE INDEX IF NOT EXISTS "configuration_audit_logs_actor_user_id_idx" ON "configuration_audit_logs"("actor_user_id");
CREATE INDEX IF NOT EXISTS "configuration_audit_logs_created_at_idx" ON "configuration_audit_logs"("created_at");

-- 5. Branch-Specific Document Sequences
CREATE TABLE IF NOT EXISTS "branch_document_sequences" (
    "id" BIGSERIAL PRIMARY KEY,
    "branch_id" BIGINT NOT NULL REFERENCES "hospital_branch"("id") ON DELETE CASCADE,
    "doc_type" VARCHAR(30) NOT NULL,
    "year" INTEGER NOT NULL,
    "sequence_num" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "branch_document_sequences_branch_id_doc_type_year_key" UNIQUE ("branch_id", "doc_type", "year")
);

CREATE INDEX IF NOT EXISTS "branch_document_sequences_branch_id_doc_type_idx" ON "branch_document_sequences"("branch_id", "doc_type");
