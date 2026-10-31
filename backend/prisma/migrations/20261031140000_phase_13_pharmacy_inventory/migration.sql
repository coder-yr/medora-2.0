-- AlterTable
ALTER TABLE "prescription_medicine" ADD COLUMN     "dispensed_quantity" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "medicine_batch" (
    "id" BIGSERIAL NOT NULL,
    "medicine_id" BIGINT NOT NULL,
    "batch_number" VARCHAR(100) NOT NULL,
    "mfg_date" VARCHAR(50),
    "expiry_date" DATE NOT NULL,
    "cost_price" DECIMAL(10,2) NOT NULL,
    "selling_price" DECIMAL(10,2),
    "initial_quantity" INTEGER NOT NULL,
    "current_quantity" INTEGER NOT NULL,
    "supplier_id" BIGINT,
    "status" VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "medicine_batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movement" (
    "id" BIGSERIAL NOT NULL,
    "medicine_id" BIGINT NOT NULL,
    "batch_id" BIGINT,
    "movement_type" VARCHAR(50) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "unit_cost" DECIMAL(10,2),
    "reference_type" VARCHAR(50),
    "reference_id" BIGINT,
    "performed_by" BIGINT,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order" (
    "id" BIGSERIAL NOT NULL,
    "po_number" VARCHAR(50) NOT NULL,
    "supplier_id" BIGINT NOT NULL,
    "order_date" VARCHAR(50) NOT NULL,
    "expected_date" VARCHAR(50),
    "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "status" VARCHAR(30) NOT NULL DEFAULT 'ORDERED',
    "notes" TEXT,
    "created_by_id" BIGINT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "purchase_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_item" (
    "id" BIGSERIAL NOT NULL,
    "purchase_order_id" BIGINT NOT NULL,
    "medicine_id" BIGINT NOT NULL,
    "quantity_ordered" INTEGER NOT NULL,
    "quantity_received" INTEGER NOT NULL DEFAULT 0,
    "unit_cost" DECIMAL(10,2) NOT NULL,
    "line_total" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "purchase_order_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipt" (
    "id" BIGSERIAL NOT NULL,
    "receipt_number" VARCHAR(50) NOT NULL,
    "purchase_order_id" BIGINT,
    "supplier_id" BIGINT NOT NULL,
    "receipt_date" VARCHAR(50) NOT NULL,
    "supplier_invoice_number" VARCHAR(100),
    "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "notes" TEXT,
    "received_by_id" BIGINT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "goods_receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipt_item" (
    "id" BIGSERIAL NOT NULL,
    "goods_receipt_id" BIGINT NOT NULL,
    "purchase_order_item_id" BIGINT,
    "medicine_id" BIGINT NOT NULL,
    "batch_id" BIGINT,
    "batch_number" VARCHAR(100) NOT NULL,
    "mfg_date" VARCHAR(50),
    "expiry_date" DATE NOT NULL,
    "quantity_received" INTEGER NOT NULL,
    "unit_cost" DECIMAL(10,2) NOT NULL,
    "selling_price" DECIMAL(10,2),
    "line_total" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "goods_receipt_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmacy_dispensation" (
    "id" BIGSERIAL NOT NULL,
    "dispensation_number" VARCHAR(50) NOT NULL,
    "prescription_id" BIGINT,
    "patient_id" BIGINT,
    "doctor_id" BIGINT,
    "patient_name" VARCHAR(100),
    "dispense_date" VARCHAR(50) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "tax" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "status" VARCHAR(30) NOT NULL DEFAULT 'COMPLETED',
    "invoice_id" BIGINT,
    "dispensed_by_id" BIGINT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "pharmacy_dispensation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmacy_dispensation_item" (
    "id" BIGSERIAL NOT NULL,
    "dispensation_id" BIGINT NOT NULL,
    "prescription_medicine_id" BIGINT,
    "medicine_id" BIGINT,
    "batch_id" BIGINT,
    "medicine_name" VARCHAR(200) NOT NULL,
    "batch_number" VARCHAR(100),
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "total_price" DECIMAL(10,2) NOT NULL,
    "returned_quantity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "pharmacy_dispensation_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_adjustment" (
    "id" BIGSERIAL NOT NULL,
    "adjustment_number" VARCHAR(50) NOT NULL,
    "adjustment_date" VARCHAR(50) NOT NULL,
    "reason" VARCHAR(100) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'APPROVED',
    "adjusted_by_id" BIGINT,
    "approved_by_id" BIGINT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "stock_adjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_adjustment_item" (
    "id" BIGSERIAL NOT NULL,
    "adjustment_id" BIGINT NOT NULL,
    "medicine_id" BIGINT NOT NULL,
    "batch_id" BIGINT NOT NULL,
    "system_quantity" INTEGER NOT NULL,
    "physical_quantity" INTEGER NOT NULL,
    "difference" INTEGER NOT NULL,
    "unit_cost" DECIMAL(10,2),

    CONSTRAINT "stock_adjustment_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmacy_return" (
    "id" BIGSERIAL NOT NULL,
    "return_number" VARCHAR(50) NOT NULL,
    "return_type" VARCHAR(30) NOT NULL,
    "dispensation_id" BIGINT,
    "supplier_id" BIGINT,
    "return_date" VARCHAR(50) NOT NULL,
    "reason" TEXT NOT NULL,
    "total_refund" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "restock_to_inventory" BOOLEAN NOT NULL DEFAULT true,
    "processed_by_id" BIGINT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pharmacy_return_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmacy_return_item" (
    "id" BIGSERIAL NOT NULL,
    "return_id" BIGINT NOT NULL,
    "dispensation_item_id" BIGINT,
    "medicine_id" BIGINT NOT NULL,
    "batch_id" BIGINT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "total_refund" DECIMAL(12,2) NOT NULL,
    "condition" VARCHAR(30) NOT NULL DEFAULT 'SALEABLE',

    CONSTRAINT "pharmacy_return_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "medicine_batch_medicine_id_idx" ON "medicine_batch"("medicine_id");

-- CreateIndex
CREATE INDEX "medicine_batch_expiry_date_idx" ON "medicine_batch"("expiry_date");

-- CreateIndex
CREATE INDEX "medicine_batch_status_idx" ON "medicine_batch"("status");

-- CreateIndex
CREATE INDEX "medicine_batch_supplier_id_idx" ON "medicine_batch"("supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "medicine_batch_medicine_id_batch_number_key" ON "medicine_batch"("medicine_id", "batch_number");

-- CreateIndex
CREATE INDEX "stock_movement_medicine_id_idx" ON "stock_movement"("medicine_id");

-- CreateIndex
CREATE INDEX "stock_movement_batch_id_idx" ON "stock_movement"("batch_id");

-- CreateIndex
CREATE INDEX "stock_movement_movement_type_idx" ON "stock_movement"("movement_type");

-- CreateIndex
CREATE INDEX "stock_movement_reference_type_reference_id_idx" ON "stock_movement"("reference_type", "reference_id");

-- CreateIndex
CREATE INDEX "stock_movement_created_at_idx" ON "stock_movement"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_order_po_number_key" ON "purchase_order"("po_number");

-- CreateIndex
CREATE INDEX "purchase_order_supplier_id_idx" ON "purchase_order"("supplier_id");

-- CreateIndex
CREATE INDEX "purchase_order_status_idx" ON "purchase_order"("status");

-- CreateIndex
CREATE INDEX "purchase_order_item_purchase_order_id_idx" ON "purchase_order_item"("purchase_order_id");

-- CreateIndex
CREATE INDEX "purchase_order_item_medicine_id_idx" ON "purchase_order_item"("medicine_id");

-- CreateIndex
CREATE UNIQUE INDEX "goods_receipt_receipt_number_key" ON "goods_receipt"("receipt_number");

-- CreateIndex
CREATE INDEX "goods_receipt_purchase_order_id_idx" ON "goods_receipt"("purchase_order_id");

-- CreateIndex
CREATE INDEX "goods_receipt_supplier_id_idx" ON "goods_receipt"("supplier_id");

-- CreateIndex
CREATE INDEX "goods_receipt_item_goods_receipt_id_idx" ON "goods_receipt_item"("goods_receipt_id");

-- CreateIndex
CREATE INDEX "goods_receipt_item_medicine_id_idx" ON "goods_receipt_item"("medicine_id");

-- CreateIndex
CREATE INDEX "goods_receipt_item_batch_id_idx" ON "goods_receipt_item"("batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "pharmacy_dispensation_dispensation_number_key" ON "pharmacy_dispensation"("dispensation_number");

-- CreateIndex
CREATE INDEX "pharmacy_dispensation_prescription_id_idx" ON "pharmacy_dispensation"("prescription_id");

-- CreateIndex
CREATE INDEX "pharmacy_dispensation_patient_id_idx" ON "pharmacy_dispensation"("patient_id");

-- CreateIndex
CREATE INDEX "pharmacy_dispensation_doctor_id_idx" ON "pharmacy_dispensation"("doctor_id");

-- CreateIndex
CREATE INDEX "pharmacy_dispensation_invoice_id_idx" ON "pharmacy_dispensation"("invoice_id");

-- CreateIndex
CREATE INDEX "pharmacy_dispensation_dispense_date_idx" ON "pharmacy_dispensation"("dispense_date");

-- CreateIndex
CREATE INDEX "pharmacy_dispensation_item_dispensation_id_idx" ON "pharmacy_dispensation_item"("dispensation_id");

-- CreateIndex
CREATE INDEX "pharmacy_dispensation_item_prescription_medicine_id_idx" ON "pharmacy_dispensation_item"("prescription_medicine_id");

-- CreateIndex
CREATE INDEX "pharmacy_dispensation_item_medicine_id_idx" ON "pharmacy_dispensation_item"("medicine_id");

-- CreateIndex
CREATE INDEX "pharmacy_dispensation_item_batch_id_idx" ON "pharmacy_dispensation_item"("batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_adjustment_adjustment_number_key" ON "stock_adjustment"("adjustment_number");

-- CreateIndex
CREATE INDEX "stock_adjustment_adjustment_date_idx" ON "stock_adjustment"("adjustment_date");

-- CreateIndex
CREATE INDEX "stock_adjustment_status_idx" ON "stock_adjustment"("status");

-- CreateIndex
CREATE INDEX "stock_adjustment_item_adjustment_id_idx" ON "stock_adjustment_item"("adjustment_id");

-- CreateIndex
CREATE INDEX "stock_adjustment_item_medicine_id_idx" ON "stock_adjustment_item"("medicine_id");

-- CreateIndex
CREATE INDEX "stock_adjustment_item_batch_id_idx" ON "stock_adjustment_item"("batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "pharmacy_return_return_number_key" ON "pharmacy_return"("return_number");

-- CreateIndex
CREATE INDEX "pharmacy_return_dispensation_id_idx" ON "pharmacy_return"("dispensation_id");

-- CreateIndex
CREATE INDEX "pharmacy_return_supplier_id_idx" ON "pharmacy_return"("supplier_id");

-- CreateIndex
CREATE INDEX "pharmacy_return_return_type_idx" ON "pharmacy_return"("return_type");

-- CreateIndex
CREATE INDEX "pharmacy_return_item_return_id_idx" ON "pharmacy_return_item"("return_id");

-- CreateIndex
CREATE INDEX "pharmacy_return_item_dispensation_item_id_idx" ON "pharmacy_return_item"("dispensation_item_id");

-- CreateIndex
CREATE INDEX "pharmacy_return_item_medicine_id_idx" ON "pharmacy_return_item"("medicine_id");

-- CreateIndex
CREATE INDEX "pharmacy_return_item_batch_id_idx" ON "pharmacy_return_item"("batch_id");

-- AddForeignKey
ALTER TABLE "medicine_batch" ADD CONSTRAINT "medicine_batch_medicine_id_fkey" FOREIGN KEY ("medicine_id") REFERENCES "medicine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicine_batch" ADD CONSTRAINT "medicine_batch_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_medicine_id_fkey" FOREIGN KEY ("medicine_id") REFERENCES "medicine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "medicine_batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_item" ADD CONSTRAINT "purchase_order_item_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_item" ADD CONSTRAINT "purchase_order_item_medicine_id_fkey" FOREIGN KEY ("medicine_id") REFERENCES "medicine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt" ADD CONSTRAINT "goods_receipt_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt" ADD CONSTRAINT "goods_receipt_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_item" ADD CONSTRAINT "goods_receipt_item_goods_receipt_id_fkey" FOREIGN KEY ("goods_receipt_id") REFERENCES "goods_receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_item" ADD CONSTRAINT "goods_receipt_item_purchase_order_item_id_fkey" FOREIGN KEY ("purchase_order_item_id") REFERENCES "purchase_order_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_item" ADD CONSTRAINT "goods_receipt_item_medicine_id_fkey" FOREIGN KEY ("medicine_id") REFERENCES "medicine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_item" ADD CONSTRAINT "goods_receipt_item_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "medicine_batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_dispensation" ADD CONSTRAINT "pharmacy_dispensation_prescription_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "prescription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_dispensation" ADD CONSTRAINT "pharmacy_dispensation_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_dispensation" ADD CONSTRAINT "pharmacy_dispensation_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_dispensation" ADD CONSTRAINT "pharmacy_dispensation_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_dispensation_item" ADD CONSTRAINT "pharmacy_dispensation_item_dispensation_id_fkey" FOREIGN KEY ("dispensation_id") REFERENCES "pharmacy_dispensation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_dispensation_item" ADD CONSTRAINT "pharmacy_dispensation_item_prescription_medicine_id_fkey" FOREIGN KEY ("prescription_medicine_id") REFERENCES "prescription_medicine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_dispensation_item" ADD CONSTRAINT "pharmacy_dispensation_item_medicine_id_fkey" FOREIGN KEY ("medicine_id") REFERENCES "medicine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_dispensation_item" ADD CONSTRAINT "pharmacy_dispensation_item_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "medicine_batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustment_item" ADD CONSTRAINT "stock_adjustment_item_adjustment_id_fkey" FOREIGN KEY ("adjustment_id") REFERENCES "stock_adjustment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustment_item" ADD CONSTRAINT "stock_adjustment_item_medicine_id_fkey" FOREIGN KEY ("medicine_id") REFERENCES "medicine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustment_item" ADD CONSTRAINT "stock_adjustment_item_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "medicine_batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_return" ADD CONSTRAINT "pharmacy_return_dispensation_id_fkey" FOREIGN KEY ("dispensation_id") REFERENCES "pharmacy_dispensation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_return" ADD CONSTRAINT "pharmacy_return_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_return_item" ADD CONSTRAINT "pharmacy_return_item_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "pharmacy_return"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_return_item" ADD CONSTRAINT "pharmacy_return_item_dispensation_item_id_fkey" FOREIGN KEY ("dispensation_item_id") REFERENCES "pharmacy_dispensation_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_return_item" ADD CONSTRAINT "pharmacy_return_item_medicine_id_fkey" FOREIGN KEY ("medicine_id") REFERENCES "medicine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_return_item" ADD CONSTRAINT "pharmacy_return_item_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "medicine_batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

