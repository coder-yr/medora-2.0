-- Phase 10.5.8: Clinical Follow-ups, Notifications, Automated Reminders & Critical Result Escalations Migration

-- 1. Extend notifications with organizationId
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "organization_id" BIGINT;
CREATE INDEX IF NOT EXISTS "notifications_organization_id_idx" ON "notifications"("organization_id");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_organization_id_fkey') THEN
    ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 2. Extend notification_preferences with communication consent & channel preferences
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "appointment_consent" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "lab_consent" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "follow_up_consent" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "billing_consent" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "consent_given_at" TIMESTAMPTZ;
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "consent_source" VARCHAR(50);
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "preferred_channel" VARCHAR(20) NOT NULL DEFAULT 'IN_APP';

-- 3. Create follow_ups table
CREATE TABLE IF NOT EXISTS "follow_ups" (
    "id" BIGSERIAL NOT NULL,
    "uuid" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "follow_up_number" VARCHAR(30) NOT NULL,
    "organization_id" BIGINT NOT NULL,
    "branch_id" BIGINT NOT NULL,
    "patient_id" BIGINT NOT NULL,
    "doctor_id" BIGINT NOT NULL,
    "consultation_id" BIGINT,
    "due_date" DATE NOT NULL,
    "due_time" VARCHAR(10),
    "reason" VARCHAR(255) NOT NULL,
    "priority" VARCHAR(20) NOT NULL DEFAULT 'ROUTINE',
    "status" VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',
    "clinical_notes" TEXT,
    "reminder_preference" VARCHAR(20) NOT NULL DEFAULT 'IN_APP',
    "reminder_scheduled_at" TIMESTAMPTZ,
    "reminder_sent_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "cancelled_at" TIMESTAMPTZ,
    "cancellation_reason" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follow_ups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "follow_ups_uuid_key" ON "follow_ups"("uuid");
CREATE UNIQUE INDEX IF NOT EXISTS "follow_ups_follow_up_number_key" ON "follow_ups"("follow_up_number");
CREATE INDEX IF NOT EXISTS "follow_ups_organization_id_branch_id_idx" ON "follow_ups"("organization_id", "branch_id");
CREATE INDEX IF NOT EXISTS "follow_ups_patient_id_idx" ON "follow_ups"("patient_id");
CREATE INDEX IF NOT EXISTS "follow_ups_doctor_id_idx" ON "follow_ups"("doctor_id");
CREATE INDEX IF NOT EXISTS "follow_ups_status_due_date_idx" ON "follow_ups"("status", "due_date");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'follow_ups_organization_id_fkey') THEN
    ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'follow_ups_branch_id_fkey') THEN
    ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "hospital_branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'follow_ups_patient_id_fkey') THEN
    ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'follow_ups_doctor_id_fkey') THEN
    ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'follow_ups_consultation_id_fkey') THEN
    ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "consultation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 4. Create critical_lab_escalations table
CREATE TABLE IF NOT EXISTS "critical_lab_escalations" (
    "id" BIGSERIAL NOT NULL,
    "lab_order_id" BIGINT NOT NULL,
    "lab_report_id" BIGINT,
    "patient_id" BIGINT NOT NULL,
    "responsible_clinician_id" BIGINT,
    "critical_findings" TEXT NOT NULL,
    "is_acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledged_at" TIMESTAMPTZ,
    "acknowledged_by_id" BIGINT,
    "acknowledgement_notes" TEXT,
    "escalated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disclaimer" VARCHAR(255) NOT NULL DEFAULT 'Electronic notification does not replace direct verbal clinical handoff.',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "critical_lab_escalations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "critical_lab_escalations_lab_order_id_idx" ON "critical_lab_escalations"("lab_order_id");
CREATE INDEX IF NOT EXISTS "critical_lab_escalations_patient_id_idx" ON "critical_lab_escalations"("patient_id");
CREATE INDEX IF NOT EXISTS "critical_lab_escalations_is_acknowledged_idx" ON "critical_lab_escalations"("is_acknowledged");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'critical_lab_escalations_lab_order_id_fkey') THEN
    ALTER TABLE "critical_lab_escalations" ADD CONSTRAINT "critical_lab_escalations_lab_order_id_fkey" FOREIGN KEY ("lab_order_id") REFERENCES "lab"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'critical_lab_escalations_patient_id_fkey') THEN
    ALTER TABLE "critical_lab_escalations" ADD CONSTRAINT "critical_lab_escalations_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'critical_lab_escalations_responsible_clinician_id_fkey') THEN
    ALTER TABLE "critical_lab_escalations" ADD CONSTRAINT "critical_lab_escalations_responsible_clinician_id_fkey" FOREIGN KEY ("responsible_clinician_id") REFERENCES "doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'critical_lab_escalations_acknowledged_by_id_fkey') THEN
    ALTER TABLE "critical_lab_escalations" ADD CONSTRAINT "critical_lab_escalations_acknowledged_by_id_fkey" FOREIGN KEY ("acknowledged_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
