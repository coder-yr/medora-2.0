-- AlterTable
ALTER TABLE "medicine" ADD COLUMN     "dosage_form_id" BIGINT,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "manufacturer_id" BIGINT,
ADD COLUMN     "strength" VARCHAR(50),
ADD COLUMN     "supplier_id" BIGINT,
ADD COLUMN     "unit_id" BIGINT,
ALTER COLUMN "price" DROP NOT NULL,
ALTER COLUMN "price" SET DEFAULT 0.00,
ALTER COLUMN "box" SET DATA TYPE VARCHAR(100);

-- AlterTable
ALTER TABLE "medicine_category" ADD COLUMN     "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "updated_at" TIMESTAMPTZ;

-- CreateTable
CREATE TABLE "manufacturer" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "country" VARCHAR(100),
    "contact_email" VARCHAR(100),
    "contact_phone" VARCHAR(50),
    "address" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "manufacturer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dosage_form" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "dosage_form_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "measurement_unit" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "symbol" VARCHAR(20) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "measurement_unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "contact_person" VARCHAR(100),
    "email" VARCHAR(100),
    "phone" VARCHAR(50),
    "address" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "supplier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "manufacturer_name_key" ON "manufacturer"("name");

-- CreateIndex
CREATE UNIQUE INDEX "dosage_form_name_key" ON "dosage_form"("name");

-- CreateIndex
CREATE UNIQUE INDEX "measurement_unit_name_key" ON "measurement_unit"("name");

-- CreateIndex
CREATE INDEX "medicine_manufacturer_id_idx" ON "medicine"("manufacturer_id");

-- CreateIndex
CREATE INDEX "medicine_dosage_form_id_idx" ON "medicine"("dosage_form_id");

-- CreateIndex
CREATE INDEX "medicine_unit_id_idx" ON "medicine"("unit_id");

-- CreateIndex
CREATE INDEX "medicine_supplier_id_idx" ON "medicine"("supplier_id");

-- CreateIndex
CREATE INDEX "medicine_name_idx" ON "medicine"("name");

-- CreateIndex
CREATE INDEX "medicine_generic_idx" ON "medicine"("generic");

-- AddForeignKey
ALTER TABLE "medicine" ADD CONSTRAINT "medicine_manufacturer_id_fkey" FOREIGN KEY ("manufacturer_id") REFERENCES "manufacturer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicine" ADD CONSTRAINT "medicine_dosage_form_id_fkey" FOREIGN KEY ("dosage_form_id") REFERENCES "dosage_form"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicine" ADD CONSTRAINT "medicine_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "measurement_unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicine" ADD CONSTRAINT "medicine_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
