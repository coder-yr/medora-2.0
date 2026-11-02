-- AlterTable
ALTER TABLE "lab" ADD COLUMN     "appointment_id" BIGINT,
ADD COLUMN     "approved_at" TIMESTAMPTZ,
ADD COLUMN     "approved_by" BIGINT,
ADD COLUMN     "cancel_reason" TEXT,
ADD COLUMN     "cancelled_at" TIMESTAMPTZ,
ADD COLUMN     "clinical_notes" TEXT,
ADD COLUMN     "completed_at" TIMESTAMPTZ,
ADD COLUMN     "consultation_id" BIGINT,
ADD COLUMN     "invoice_id" BIGINT,
ADD COLUMN     "order_number" VARCHAR(50),
ADD COLUMN     "priority" VARCHAR(20) NOT NULL DEFAULT 'ROUTINE',
ADD COLUMN     "verified_at" TIMESTAMPTZ,
ADD COLUMN     "verified_by" BIGINT;

-- AlterTable
ALTER TABLE "lab_category" ADD COLUMN     "instructions" TEXT,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sample_type" VARCHAR(50),
ADD COLUMN     "turnaround_hours" INTEGER DEFAULT 24;

-- AlterTable
ALTER TABLE "lab_test" ADD COLUMN     "price_snapshot" DECIMAL(10,2),
ADD COLUMN     "reported_at" TIMESTAMPTZ,
ADD COLUMN     "sample_id" BIGINT,
ADD COLUMN     "sample_type" VARCHAR(50);

-- CreateTable
CREATE TABLE "lab_test_parameter" (
    "id" BIGSERIAL NOT NULL,
    "lab_category_id" BIGINT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "unit" VARCHAR(50),
    "reference_range" VARCHAR(255),
    "gender" VARCHAR(20) DEFAULT 'ALL',
    "age_min" INTEGER,
    "age_max" INTEGER,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_test_parameter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_sample" (
    "id" BIGSERIAL NOT NULL,
    "lab_id" BIGINT NOT NULL,
    "sample_number" VARCHAR(50) NOT NULL,
    "sample_type" VARCHAR(50) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    "collected_at" TIMESTAMPTZ,
    "collected_by" BIGINT,
    "received_at" TIMESTAMPTZ,
    "received_by" BIGINT,
    "rejected_at" TIMESTAMPTZ,
    "rejected_by" BIGINT,
    "rejection_reason" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "lab_sample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_result_parameter" (
    "id" BIGSERIAL NOT NULL,
    "lab_test_id" BIGINT NOT NULL,
    "parameter_id" BIGINT,
    "parameter_name" VARCHAR(100) NOT NULL,
    "value" VARCHAR(255) NOT NULL,
    "unit_snapshot" VARCHAR(50),
    "reference_range_snapshot" VARCHAR(255),
    "abnormal_flag" VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    "clinical_comments" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "lab_result_parameter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_report_amendment" (
    "id" BIGSERIAL NOT NULL,
    "lab_id" BIGINT NOT NULL,
    "amended_by" BIGINT NOT NULL,
    "reason" TEXT NOT NULL,
    "previous_snapshot" JSONB NOT NULL,
    "new_snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_report_amendment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lab_test_parameter_lab_category_id_idx" ON "lab_test_parameter"("lab_category_id");

-- CreateIndex
CREATE UNIQUE INDEX "lab_sample_sample_number_key" ON "lab_sample"("sample_number");

-- CreateIndex
CREATE INDEX "lab_sample_lab_id_idx" ON "lab_sample"("lab_id");

-- CreateIndex
CREATE INDEX "lab_sample_status_idx" ON "lab_sample"("status");

-- CreateIndex
CREATE INDEX "lab_result_parameter_lab_test_id_idx" ON "lab_result_parameter"("lab_test_id");

-- CreateIndex
CREATE INDEX "lab_report_amendment_lab_id_idx" ON "lab_report_amendment"("lab_id");

-- CreateIndex
CREATE UNIQUE INDEX "lab_order_number_key" ON "lab"("order_number");

-- CreateIndex
CREATE INDEX "lab_doctor_idx" ON "lab"("doctor");

-- CreateIndex
CREATE INDEX "lab_invoice_id_idx" ON "lab"("invoice_id");

-- CreateIndex
CREATE INDEX "lab_test_lab_category_id_idx" ON "lab_test"("lab_category_id");

-- CreateIndex
CREATE INDEX "lab_test_sample_id_idx" ON "lab_test"("sample_id");

-- AddForeignKey
ALTER TABLE "lab_test_parameter" ADD CONSTRAINT "lab_test_parameter_lab_category_id_fkey" FOREIGN KEY ("lab_category_id") REFERENCES "lab_category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab" ADD CONSTRAINT "lab_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab" ADD CONSTRAINT "lab_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "consultation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab" ADD CONSTRAINT "lab_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_sample" ADD CONSTRAINT "lab_sample_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "lab"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_test" ADD CONSTRAINT "lab_test_sample_id_fkey" FOREIGN KEY ("sample_id") REFERENCES "lab_sample"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_result_parameter" ADD CONSTRAINT "lab_result_parameter_lab_test_id_fkey" FOREIGN KEY ("lab_test_id") REFERENCES "lab_test"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_result_parameter" ADD CONSTRAINT "lab_result_parameter_parameter_id_fkey" FOREIGN KEY ("parameter_id") REFERENCES "lab_test_parameter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_report_amendment" ADD CONSTRAINT "lab_report_amendment_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "lab"("id") ON DELETE CASCADE ON UPDATE CASCADE;
