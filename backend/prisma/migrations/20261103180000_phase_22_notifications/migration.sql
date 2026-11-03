-- Phase 22: Notifications, Messaging & Background Job Infrastructure Migration

-- 1. Notifications Table
CREATE TABLE IF NOT EXISTS "notifications" (
    "id" BIGSERIAL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL UNIQUE,
    "event_type" VARCHAR(50) NOT NULL,
    "channel" VARCHAR(20) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "priority" VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "branch_id" BIGINT REFERENCES "hospital_branch"("id") ON DELETE SET NULL,
    "scheduled_at" TIMESTAMPTZ,
    "sent_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "notifications_event_type_idx" ON "notifications"("event_type");
CREATE INDEX IF NOT EXISTS "notifications_channel_status_idx" ON "notifications"("channel", "status");
CREATE INDEX IF NOT EXISTS "notifications_branch_id_idx" ON "notifications"("branch_id");
CREATE INDEX IF NOT EXISTS "notifications_created_at_idx" ON "notifications"("created_at");

-- 2. Notification Recipients Table
CREATE TABLE IF NOT EXISTS "notification_recipients" (
    "id" BIGSERIAL PRIMARY KEY,
    "notification_id" BIGINT NOT NULL REFERENCES "notifications"("id") ON DELETE CASCADE,
    "user_id" BIGINT REFERENCES "users"("id") ON DELETE CASCADE,
    "patient_id" BIGINT REFERENCES "patient"("id") ON DELETE CASCADE,
    "destination" VARCHAR(150),
    "recipient_name" VARCHAR(100),
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "notification_recipients_notification_id_idx" ON "notification_recipients"("notification_id");
CREATE INDEX IF NOT EXISTS "notification_recipients_user_id_is_read_idx" ON "notification_recipients"("user_id", "is_read");
CREATE INDEX IF NOT EXISTS "notification_recipients_patient_id_idx" ON "notification_recipients"("patient_id");

-- 3. Notification Templates Table
CREATE TABLE IF NOT EXISTS "notification_templates" (
    "id" BIGSERIAL PRIMARY KEY,
    "template_key" VARCHAR(100) NOT NULL,
    "channel" VARCHAR(20) NOT NULL,
    "locale" VARCHAR(10) NOT NULL DEFAULT 'en',
    "subject" VARCHAR(200),
    "body" TEXT NOT NULL,
    "variables" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "branch_id" BIGINT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notification_templates_template_key_channel_locale_key" UNIQUE ("template_key", "channel", "locale")
);

CREATE INDEX IF NOT EXISTS "notification_templates_template_key_idx" ON "notification_templates"("template_key");

-- 4. Notification Preferences Table
CREATE TABLE IF NOT EXISTS "notification_preferences" (
    "id" BIGSERIAL PRIMARY KEY,
    "user_id" BIGINT UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
    "patient_id" BIGINT UNIQUE REFERENCES "patient"("id") ON DELETE CASCADE,
    "in_app_enabled" BOOLEAN NOT NULL DEFAULT true,
    "email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sms_enabled" BOOLEAN NOT NULL DEFAULT true,
    "channel_overrides" JSONB,
    "quiet_hours_start" VARCHAR(5),
    "quiet_hours_end" VARCHAR(5),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Notification Outbox Table
CREATE TABLE IF NOT EXISTS "notification_outbox" (
    "id" BIGSERIAL PRIMARY KEY,
    "notification_id" BIGINT NOT NULL UNIQUE REFERENCES "notifications"("id") ON DELETE CASCADE,
    "channel" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "scheduled_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "next_retry_at" TIMESTAMPTZ,
    "processing_started_at" TIMESTAMPTZ,
    "last_error" TEXT,
    "last_error_category" VARCHAR(50),
    "deduplication_key" VARCHAR(150) UNIQUE,
    "delivered_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "notification_outbox_status_scheduled_at_idx" ON "notification_outbox"("status", "scheduled_at");
CREATE INDEX IF NOT EXISTS "notification_outbox_status_next_retry_at_idx" ON "notification_outbox"("status", "next_retry_at");

-- 6. Notification Deliveries Table
CREATE TABLE IF NOT EXISTS "notification_deliveries" (
    "id" BIGSERIAL PRIMARY KEY,
    "notification_id" BIGINT NOT NULL REFERENCES "notifications"("id") ON DELETE CASCADE,
    "channel" VARCHAR(20) NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "provider_message_id" VARCHAR(150),
    "attempt_number" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "status_code" VARCHAR(50),
    "response_body" TEXT,
    "error_message" TEXT,
    "duration_ms" INTEGER,
    "sent_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "notification_deliveries_notification_id_idx" ON "notification_deliveries"("notification_id");
CREATE INDEX IF NOT EXISTS "notification_deliveries_provider_status_idx" ON "notification_deliveries"("provider", "status");
CREATE INDEX IF NOT EXISTS "notification_deliveries_sent_at_idx" ON "notification_deliveries"("sent_at");
