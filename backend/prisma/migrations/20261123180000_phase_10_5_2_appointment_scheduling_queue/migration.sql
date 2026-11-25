-- AlterTable appointment
ALTER TABLE "appointment" ADD COLUMN IF NOT EXISTS "priority" VARCHAR(20) NOT NULL DEFAULT 'NORMAL';
ALTER TABLE "appointment" ADD COLUMN IF NOT EXISTS "cancellation_reason" TEXT;
ALTER TABLE "appointment" ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMPTZ;
ALTER TABLE "appointment" ADD COLUMN IF NOT EXISTS "rescheduled_from_id" BIGINT;
ALTER TABLE "appointment" ADD COLUMN IF NOT EXISTS "reschedule_reason" TEXT;
ALTER TABLE "appointment" ADD COLUMN IF NOT EXISTS "department" VARCHAR(100);

-- AlterTable doctor_slot
ALTER TABLE "doctor_slot" ADD COLUMN IF NOT EXISTS "branch_id" BIGINT;
ALTER TABLE "doctor_slot" ADD COLUMN IF NOT EXISTS "break_start_time" VARCHAR(5);
ALTER TABLE "doctor_slot" ADD COLUMN IF NOT EXISTS "break_end_time" VARCHAR(5);

-- AlterTable slot_block
ALTER TABLE "slot_block" ADD COLUMN IF NOT EXISTS "branch_id" BIGINT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "doctor_slot_branch_id_idx" ON "doctor_slot"("branch_id");
CREATE INDEX IF NOT EXISTS "slot_block_branch_id_idx" ON "slot_block"("branch_id");

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'doctor_slot_branch_id_fkey') THEN
        ALTER TABLE "doctor_slot" ADD CONSTRAINT "doctor_slot_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "hospital_branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'slot_block_branch_id_fkey') THEN
        ALTER TABLE "slot_block" ADD CONSTRAINT "slot_block_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "hospital_branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
