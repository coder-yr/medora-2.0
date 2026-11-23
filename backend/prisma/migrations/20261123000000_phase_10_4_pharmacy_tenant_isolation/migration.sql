-- Phase 10.4: Multi-Tenant Pharmacy & Inventory Isolation Migration

-- 1. Add organization_id and branch_id to pharmacy & inventory models
ALTER TABLE "medicine_batch" ADD COLUMN IF NOT EXISTS "organization_id" BIGINT;
ALTER TABLE "medicine_batch" ADD COLUMN IF NOT EXISTS "branch_id" BIGINT;

ALTER TABLE "stock_movement" ADD COLUMN IF NOT EXISTS "organization_id" BIGINT;
ALTER TABLE "stock_movement" ADD COLUMN IF NOT EXISTS "branch_id" BIGINT;

ALTER TABLE "purchase_order" ADD COLUMN IF NOT EXISTS "organization_id" BIGINT;
ALTER TABLE "purchase_order" ADD COLUMN IF NOT EXISTS "branch_id" BIGINT;

ALTER TABLE "goods_receipt" ADD COLUMN IF NOT EXISTS "organization_id" BIGINT;
ALTER TABLE "goods_receipt" ADD COLUMN IF NOT EXISTS "branch_id" BIGINT;

ALTER TABLE "stock_adjustment" ADD COLUMN IF NOT EXISTS "organization_id" BIGINT;
ALTER TABLE "stock_adjustment" ADD COLUMN IF NOT EXISTS "branch_id" BIGINT;

ALTER TABLE "pharmacy_return" ADD COLUMN IF NOT EXISTS "organization_id" BIGINT;
ALTER TABLE "pharmacy_return" ADD COLUMN IF NOT EXISTS "branch_id" BIGINT;

ALTER TABLE "pharmacy_dispensation" ADD COLUMN IF NOT EXISTS "organization_id" BIGINT;
ALTER TABLE "pharmacy_dispensation" ADD COLUMN IF NOT EXISTS "branch_id" BIGINT;

ALTER TABLE "supplier" ADD COLUMN IF NOT EXISTS "organization_id" BIGINT;

-- 2. Backfill existing legacy records to Organization #1 and Branch #1
UPDATE "medicine_batch" SET "organization_id" = 1, "branch_id" = 1 WHERE "organization_id" IS NULL;
UPDATE "stock_movement" SET "organization_id" = 1, "branch_id" = 1 WHERE "organization_id" IS NULL;
UPDATE "purchase_order" SET "organization_id" = 1, "branch_id" = 1 WHERE "organization_id" IS NULL;
UPDATE "goods_receipt" SET "organization_id" = 1, "branch_id" = 1 WHERE "organization_id" IS NULL;
UPDATE "stock_adjustment" SET "organization_id" = 1, "branch_id" = 1 WHERE "organization_id" IS NULL;
UPDATE "pharmacy_return" SET "organization_id" = 1, "branch_id" = 1 WHERE "organization_id" IS NULL;
UPDATE "pharmacy_dispensation" SET "organization_id" = 1, "branch_id" = 1 WHERE "organization_id" IS NULL;
UPDATE "supplier" SET "organization_id" = 1 WHERE "organization_id" IS NULL;

-- 3. Foreign Key Constraints
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'medicine_batch_organization_id_fkey') THEN
    ALTER TABLE "medicine_batch" ADD CONSTRAINT "medicine_batch_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'medicine_batch_branch_id_fkey') THEN
    ALTER TABLE "medicine_batch" ADD CONSTRAINT "medicine_batch_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "hospital_branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_movement_organization_id_fkey') THEN
    ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_movement_branch_id_fkey') THEN
    ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "hospital_branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_order_organization_id_fkey') THEN
    ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_order_branch_id_fkey') THEN
    ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "hospital_branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'goods_receipt_organization_id_fkey') THEN
    ALTER TABLE "goods_receipt" ADD CONSTRAINT "goods_receipt_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'goods_receipt_branch_id_fkey') THEN
    ALTER TABLE "goods_receipt" ADD CONSTRAINT "goods_receipt_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "hospital_branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_adjustment_organization_id_fkey') THEN
    ALTER TABLE "stock_adjustment" ADD CONSTRAINT "stock_adjustment_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_adjustment_branch_id_fkey') THEN
    ALTER TABLE "stock_adjustment" ADD CONSTRAINT "stock_adjustment_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "hospital_branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pharmacy_return_organization_id_fkey') THEN
    ALTER TABLE "pharmacy_return" ADD CONSTRAINT "pharmacy_return_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pharmacy_return_branch_id_fkey') THEN
    ALTER TABLE "pharmacy_return" ADD CONSTRAINT "pharmacy_return_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "hospital_branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pharmacy_dispensation_organization_id_fkey') THEN
    ALTER TABLE "pharmacy_dispensation" ADD CONSTRAINT "pharmacy_dispensation_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pharmacy_dispensation_branch_id_fkey') THEN
    ALTER TABLE "pharmacy_dispensation" ADD CONSTRAINT "pharmacy_dispensation_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "hospital_branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'supplier_organization_id_fkey') THEN
    ALTER TABLE "supplier" ADD CONSTRAINT "supplier_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 4. Scope unique batch number to branch
DROP INDEX IF EXISTS "medicine_batch_medicine_id_batch_number_key";
CREATE UNIQUE INDEX IF NOT EXISTS "medicine_batch_branch_id_medicine_id_batch_number_key" ON "medicine_batch"("branch_id", "medicine_id", "batch_number");

-- 5. Tenant and Branch indexes
CREATE INDEX IF NOT EXISTS "medicine_batch_organization_id_idx" ON "medicine_batch"("organization_id");
CREATE INDEX IF NOT EXISTS "medicine_batch_branch_id_idx" ON "medicine_batch"("branch_id");

CREATE INDEX IF NOT EXISTS "stock_movement_organization_id_idx" ON "stock_movement"("organization_id");
CREATE INDEX IF NOT EXISTS "stock_movement_branch_id_idx" ON "stock_movement"("branch_id");

CREATE INDEX IF NOT EXISTS "purchase_order_organization_id_idx" ON "purchase_order"("organization_id");
CREATE INDEX IF NOT EXISTS "purchase_order_branch_id_idx" ON "purchase_order"("branch_id");

CREATE INDEX IF NOT EXISTS "goods_receipt_organization_id_idx" ON "goods_receipt"("organization_id");
CREATE INDEX IF NOT EXISTS "goods_receipt_branch_id_idx" ON "goods_receipt"("branch_id");

CREATE INDEX IF NOT EXISTS "stock_adjustment_organization_id_idx" ON "stock_adjustment"("organization_id");
CREATE INDEX IF NOT EXISTS "stock_adjustment_branch_id_idx" ON "stock_adjustment"("branch_id");

CREATE INDEX IF NOT EXISTS "pharmacy_return_organization_id_idx" ON "pharmacy_return"("organization_id");
CREATE INDEX IF NOT EXISTS "pharmacy_return_branch_id_idx" ON "pharmacy_return"("branch_id");

CREATE INDEX IF NOT EXISTS "pharmacy_dispensation_organization_id_idx" ON "pharmacy_dispensation"("organization_id");
CREATE INDEX IF NOT EXISTS "pharmacy_dispensation_branch_id_idx" ON "pharmacy_dispensation"("branch_id");

CREATE INDEX IF NOT EXISTS "supplier_organization_id_idx" ON "supplier"("organization_id");
