-- Phase 10.2.2: MFA Hardening & Single-use Hashed Recovery Codes
ALTER TABLE "users" ALTER COLUMN "mfa_secret" TYPE VARCHAR(255);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_recovery_codes" JSONB DEFAULT '[]'::jsonb;
