-- AlterTable
ALTER TABLE "radiology_exam" ADD COLUMN     "category_id" BIGINT,
ADD COLUMN     "preparation_instructions" TEXT,
ADD COLUMN     "price" DECIMAL(10,2),
ADD COLUMN     "report_template" TEXT,
ADD COLUMN     "turnaround_hours" INTEGER DEFAULT 24,
ALTER COLUMN "code" SET DATA TYPE VARCHAR(30),
ALTER COLUMN "name" SET DATA TYPE VARCHAR(120);

-- AlterTable
ALTER TABLE "radiology_order" ADD COLUMN     "appointment_id" BIGINT,
ADD COLUMN     "arrived_at" TIMESTAMPTZ,
ADD COLUMN     "cancel_reason" TEXT,
ADD COLUMN     "cancelled_at" TIMESTAMPTZ,
ADD COLUMN     "cancelled_by" BIGINT,
ADD COLUMN     "consultation_id" BIGINT,
ADD COLUMN     "created_by" BIGINT,
ADD COLUMN     "equipment_room" VARCHAR(50),
ADD COLUMN     "exam_name" VARCHAR(120),
ADD COLUMN     "modality" VARCHAR(20),
ADD COLUMN     "performed_at" TIMESTAMPTZ,
ADD COLUMN     "scheduled_at" TIMESTAMPTZ,
ADD COLUMN     "urgent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "verified_at" TIMESTAMPTZ,
ADD COLUMN     "verified_by" BIGINT,
ALTER COLUMN "urgency" SET DATA TYPE VARCHAR(20),
ALTER COLUMN "status" SET DATA TYPE VARCHAR(30);

-- CreateTable
CREATE TABLE "radiology_category" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "modality" VARCHAR(20) NOT NULL,
    "description" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "radiology_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radiology_report_amendment" (
    "id" BIGSERIAL NOT NULL,
    "radiology_order_id" BIGINT NOT NULL,
    "amended_by" BIGINT NOT NULL,
    "reason" TEXT NOT NULL,
    "previous_findings" TEXT,
    "previous_impression" TEXT,
    "new_findings" TEXT,
    "new_impression" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "radiology_report_amendment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "radiology_category_name_key" ON "radiology_category"("name");

-- CreateIndex
CREATE INDEX "radiology_report_amendment_radiology_order_id_idx" ON "radiology_report_amendment"("radiology_order_id");

-- CreateIndex
CREATE INDEX "radiology_report_amendment_amended_by_idx" ON "radiology_report_amendment"("amended_by");

-- CreateIndex
CREATE INDEX "radiology_exam_category_id_idx" ON "radiology_exam"("category_id");

-- CreateIndex
CREATE INDEX "radiology_exam_modality_idx" ON "radiology_exam"("modality");

-- CreateIndex
CREATE INDEX "radiology_order_doctor_id_idx" ON "radiology_order"("doctor_id");

-- CreateIndex
CREATE INDEX "radiology_order_appointment_id_idx" ON "radiology_order"("appointment_id");

-- CreateIndex
CREATE INDEX "radiology_order_scheduled_at_idx" ON "radiology_order"("scheduled_at");

-- CreateIndex
CREATE INDEX "radiology_order_equipment_room_idx" ON "radiology_order"("equipment_room");

-- CreateIndex
CREATE INDEX "radiology_order_invoice_id_idx" ON "radiology_order"("invoice_id");

-- AddForeignKey
ALTER TABLE "radiology_exam" ADD CONSTRAINT "radiology_exam_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "radiology_category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radiology_order" ADD CONSTRAINT "radiology_order_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radiology_order" ADD CONSTRAINT "radiology_order_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "consultation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radiology_order" ADD CONSTRAINT "radiology_order_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radiology_order" ADD CONSTRAINT "radiology_order_technologist_id_fkey" FOREIGN KEY ("technologist_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radiology_report_amendment" ADD CONSTRAINT "radiology_report_amendment_radiology_order_id_fkey" FOREIGN KEY ("radiology_order_id") REFERENCES "radiology_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radiology_report_amendment" ADD CONSTRAINT "radiology_report_amendment_amended_by_fkey" FOREIGN KEY ("amended_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
