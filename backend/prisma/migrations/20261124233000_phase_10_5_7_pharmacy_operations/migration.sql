-- Migration: 20261124233000_phase_10_5_7_pharmacy_operations
-- Medora 2.0 Phase 10.5.7: Pharmacy Operations & Inventory Management

-- 1. Extend supplier table
ALTER TABLE "supplier" ADD COLUMN IF NOT EXISTS "gstin" VARCHAR(50);

-- 2. Extend medicine table with clinical catalogue & inventory fields
ALTER TABLE "medicine" 
  ADD COLUMN IF NOT EXISTS "brand_name" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "code" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "composition" TEXT,
  ADD COLUMN IF NOT EXISTS "barcode" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "prescription_required" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "reorder_level" INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS "min_stock_level" INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS "max_stock_level" INTEGER NOT NULL DEFAULT 1000;

CREATE UNIQUE INDEX IF NOT EXISTS "medicine_code_key" ON "medicine"("code");

-- 3. Extend purchase_order with approval metadata
ALTER TABLE "purchase_order" 
  ADD COLUMN IF NOT EXISTS "approved_by_id" BIGINT,
  ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMPTZ;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_order_approved_by_id_fkey') THEN
    ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_order_created_by_id_fkey') THEN
    ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 4. Extend pharmacy_dispensation_item with substitution tracking
ALTER TABLE "pharmacy_dispensation_item"
  ADD COLUMN IF NOT EXISTS "is_substituted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "original_medicine_id" BIGINT,
  ADD COLUMN IF NOT EXISTS "substitution_reason" VARCHAR(255);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pharmacy_dispensation_item_original_medicine_id_fkey') THEN
    ALTER TABLE "pharmacy_dispensation_item" ADD CONSTRAINT "pharmacy_dispensation_item_original_medicine_id_fkey" FOREIGN KEY ("original_medicine_id") REFERENCES "medicine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 5. Create stock_transfer table for inter-branch inventory transfers
CREATE TABLE IF NOT EXISTS "stock_transfer" (
    "id" BIGSERIAL NOT NULL,
    "transfer_number" VARCHAR(50) NOT NULL,
    "from_branch_id" BIGINT NOT NULL,
    "to_branch_id" BIGINT NOT NULL,
    "medicine_id" BIGINT NOT NULL,
    "batch_id" BIGINT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'COMPLETED',
    "transferred_by_id" BIGINT,
    "received_by_id" BIGINT,
    "reason" TEXT,
    "organization_id" BIGINT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "stock_transfer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "stock_transfer_transfer_number_key" ON "stock_transfer"("transfer_number");
CREATE INDEX IF NOT EXISTS "stock_transfer_organization_id_idx" ON "stock_transfer"("organization_id");
CREATE INDEX IF NOT EXISTS "stock_transfer_from_branch_id_idx" ON "stock_transfer"("from_branch_id");
CREATE INDEX IF NOT EXISTS "stock_transfer_to_branch_id_idx" ON "stock_transfer"("to_branch_id");
CREATE INDEX IF NOT EXISTS "stock_transfer_medicine_id_idx" ON "stock_transfer"("medicine_id");
CREATE INDEX IF NOT EXISTS "stock_transfer_batch_id_idx" ON "stock_transfer"("batch_id");
CREATE INDEX IF NOT EXISTS "stock_transfer_status_idx" ON "stock_transfer"("status");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_transfer_from_branch_id_fkey') THEN
    ALTER TABLE "stock_transfer" ADD CONSTRAINT "stock_transfer_from_branch_id_fkey" FOREIGN KEY ("from_branch_id") REFERENCES "hospital_branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_transfer_to_branch_id_fkey') THEN
    ALTER TABLE "stock_transfer" ADD CONSTRAINT "stock_transfer_to_branch_id_fkey" FOREIGN KEY ("to_branch_id") REFERENCES "hospital_branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_transfer_medicine_id_fkey') THEN
    ALTER TABLE "stock_transfer" ADD CONSTRAINT "stock_transfer_medicine_id_fkey" FOREIGN KEY ("medicine_id") REFERENCES "medicine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_transfer_batch_id_fkey') THEN
    ALTER TABLE "stock_transfer" ADD CONSTRAINT "stock_transfer_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "medicine_batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_transfer_transferred_by_id_fkey') THEN
    ALTER TABLE "stock_transfer" ADD CONSTRAINT "stock_transfer_transferred_by_id_fkey" FOREIGN KEY ("transferred_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_transfer_received_by_id_fkey') THEN
    ALTER TABLE "stock_transfer" ADD CONSTRAINT "stock_transfer_received_by_id_fkey" FOREIGN KEY ("received_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_transfer_organization_id_fkey') THEN
    ALTER TABLE "stock_transfer" ADD CONSTRAINT "stock_transfer_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

