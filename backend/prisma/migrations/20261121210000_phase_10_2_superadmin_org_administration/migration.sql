-- Phase 10.2: Exclusive Super Admin & Organization Administration Architecture
-- Migration: 20261121210000_phase_10_2_superadmin_org_administration

-- 1. Create Enums
DO $$ BEGIN
  CREATE TYPE "organization_edition" AS ENUM ('CLINIC', 'PROFESSIONAL', 'HOSPITAL', 'ENTERPRISE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "audit_action" AS ENUM (
    'CREATE', 'UPDATE', 'DELETE', 'SUSPEND', 'REACTIVATE', 
    'LOGIN', 'PASSWORD_RESET', 'MEMBER_INVITE', 'MEMBER_ROLE_CHANGE', 
    'MEMBER_REVOKE', 'PERMISSION_OVERRIDE', 'EDITION_CHANGE', 
    'ENTITLEMENT_TOGGLE', 'BREAK_GLASS_ACCESS'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "invitation_status" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Additive columns on users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_super_admin" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_mfa_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_secret" VARCHAR(100);

-- Backfill is_super_admin for existing SuperAdmin accounts
UPDATE "users" SET "is_super_admin" = true WHERE "group" = 'SuperAdmin';

-- 3. Additive columns on organizations table
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "edition" "organization_edition" NOT NULL DEFAULT 'HOSPITAL';
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "subscription_tier" VARCHAR(50) DEFAULT 'STANDARD';
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "subscription_expires_at" TIMESTAMPTZ;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "max_branches" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "max_users" INTEGER NOT NULL DEFAULT 100;

-- 4. Create platform_audit_logs table
CREATE TABLE IF NOT EXISTS "platform_audit_logs" (
  "id" BIGSERIAL PRIMARY KEY,
  "action" "audit_action" NOT NULL,
  "entity_type" VARCHAR(50) NOT NULL,
  "entity_id" VARCHAR(50),
  "actor_user_id" BIGINT REFERENCES "users"("id") ON DELETE SET NULL,
  "actor_email" VARCHAR(100),
  "actor_role" VARCHAR(50),
  "organization_id" BIGINT REFERENCES "organizations"("id") ON DELETE SET NULL,
  "details" JSONB,
  "ip_address" VARCHAR(50),
  "user_agent" VARCHAR(255),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "platform_audit_logs_actor_user_id_idx" ON "platform_audit_logs"("actor_user_id");
CREATE INDEX IF NOT EXISTS "platform_audit_logs_organization_id_idx" ON "platform_audit_logs"("organization_id");
CREATE INDEX IF NOT EXISTS "platform_audit_logs_action_idx" ON "platform_audit_logs"("action");
CREATE INDEX IF NOT EXISTS "platform_audit_logs_created_at_idx" ON "platform_audit_logs"("created_at");

-- 5. Create emergency_support_grants table (Break-Glass Clinical Access)
CREATE TABLE IF NOT EXISTS "emergency_support_grants" (
  "id" BIGSERIAL PRIMARY KEY,
  "organization_id" BIGINT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "granted_to_user_id" BIGINT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "requested_reason" VARCHAR(255) NOT NULL,
  "authorized_by_id" BIGINT REFERENCES "users"("id") ON DELETE SET NULL,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "is_revoked" BOOLEAN NOT NULL DEFAULT false,
  "revoked_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "emergency_support_grants_organization_id_idx" ON "emergency_support_grants"("organization_id");
CREATE INDEX IF NOT EXISTS "emergency_support_grants_granted_to_user_id_idx" ON "emergency_support_grants"("granted_to_user_id");

-- 6. Create staff_invitations table
CREATE TABLE IF NOT EXISTS "staff_invitations" (
  "id" BIGSERIAL PRIMARY KEY,
  "token" VARCHAR(100) NOT NULL UNIQUE,
  "email" VARCHAR(100) NOT NULL,
  "name" VARCHAR(100),
  "organization_id" BIGINT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "branch_id" BIGINT REFERENCES "hospital_branch"("id") ON DELETE SET NULL,
  "role" VARCHAR(50) NOT NULL DEFAULT 'Doctor',
  "status" "invitation_status" NOT NULL DEFAULT 'PENDING',
  "expires_at" TIMESTAMPTZ NOT NULL,
  "invited_by_id" BIGINT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "accepted_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "staff_invitations_organization_id_idx" ON "staff_invitations"("organization_id");
CREATE INDEX IF NOT EXISTS "staff_invitations_email_idx" ON "staff_invitations"("email");
