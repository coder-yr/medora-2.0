-- Phase 10.5.6: Billing, Invoicing & Payment Management

-- 1. Extend PaymentCategory with catalogue, pricing, and multi-tenant scoping
ALTER TABLE "payment_category"
  ADD COLUMN IF NOT EXISTS "code" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "tax_rate" NUMERIC(5, 2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS "organization_id" BIGINT,
  ADD COLUMN IF NOT EXISTS "branch_id" BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payment_category_organization_id_fkey'
  ) THEN
    ALTER TABLE "payment_category"
      ADD CONSTRAINT "payment_category_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payment_category_branch_id_fkey'
  ) THEN
    ALTER TABLE "payment_category"
      ADD CONSTRAINT "payment_category_branch_id_fkey"
      FOREIGN KEY ("branch_id") REFERENCES "hospital_branch"("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "payment_category_organization_id_idx" ON "payment_category"("organization_id");
CREATE INDEX IF NOT EXISTS "payment_category_branch_id_idx" ON "payment_category"("branch_id");
CREATE INDEX IF NOT EXISTS "payment_category_code_idx" ON "payment_category"("code");

-- 2. Extend Payment (Invoice Header) with invoice number, tenancy, lifecycle, and clinical links
ALTER TABLE "payment"
  ADD COLUMN IF NOT EXISTS "invoice_number" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "organization_id" BIGINT,
  ADD COLUMN IF NOT EXISTS "due_date" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "consultation_id" BIGINT,
  ADD COLUMN IF NOT EXISTS "lab_order_id" BIGINT,
  ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "cancelled_by_id" BIGINT,
  ADD COLUMN IF NOT EXISTS "cancellation_reason" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payment_organization_id_fkey'
  ) THEN
    ALTER TABLE "payment"
      ADD CONSTRAINT "payment_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payment_consultation_id_fkey'
  ) THEN
    ALTER TABLE "payment"
      ADD CONSTRAINT "payment_consultation_id_fkey"
      FOREIGN KEY ("consultation_id") REFERENCES "consultation"("id") ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payment_cancelled_by_id_fkey'
  ) THEN
    ALTER TABLE "payment"
      ADD CONSTRAINT "payment_cancelled_by_id_fkey"
      FOREIGN KEY ("cancelled_by_id") REFERENCES "users"("id") ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'appointment_payment_id_fkey'
  ) THEN
    ALTER TABLE "appointment"
      ADD CONSTRAINT "appointment_payment_id_fkey"
      FOREIGN KEY ("payment_id") REFERENCES "payment"("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "payment_invoice_number_key" ON "payment"("invoice_number");
CREATE INDEX IF NOT EXISTS "payment_organization_id_idx" ON "payment"("organization_id");
CREATE INDEX IF NOT EXISTS "payment_consultation_id_idx" ON "payment"("consultation_id");

-- Backfill invoice numbers for existing rows where null
UPDATE "payment"
SET "invoice_number" = 'INV-LEGACY-' || LPAD("id"::TEXT, 6, '0')
WHERE "invoice_number" IS NULL;

-- 3. Extend InvoiceItem with tax and discount
ALTER TABLE "invoice_item"
  ADD COLUMN IF NOT EXISTS "tax_rate" NUMERIC(5, 2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS "tax_amount" NUMERIC(12, 2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS "discount" NUMERIC(12, 2) DEFAULT 0.00;

-- 4. Extend InvoicePayment with receipt number, tenancy, and refund tracking
ALTER TABLE "invoice_payment"
  ADD COLUMN IF NOT EXISTS "receipt_number" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "organization_id" BIGINT,
  ADD COLUMN IF NOT EXISTS "branch_id" BIGINT,
  ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) DEFAULT 'COMPLETED',
  ADD COLUMN IF NOT EXISTS "refunded_amount" NUMERIC(12, 2) DEFAULT 0.00;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoice_payment_organization_id_fkey'
  ) THEN
    ALTER TABLE "invoice_payment"
      ADD CONSTRAINT "invoice_payment_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoice_payment_branch_id_fkey'
  ) THEN
    ALTER TABLE "invoice_payment"
      ADD CONSTRAINT "invoice_payment_branch_id_fkey"
      FOREIGN KEY ("branch_id") REFERENCES "hospital_branch"("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "invoice_payment_receipt_number_key" ON "invoice_payment"("receipt_number");
CREATE INDEX IF NOT EXISTS "invoice_payment_organization_id_idx" ON "invoice_payment"("organization_id");
CREATE INDEX IF NOT EXISTS "invoice_payment_branch_id_idx" ON "invoice_payment"("branch_id");

-- Backfill receipt numbers for existing rows where null
UPDATE "invoice_payment"
SET "receipt_number" = 'RCP-LEGACY-' || LPAD("id"::TEXT, 6, '0')
WHERE "receipt_number" IS NULL;

-- 5. Create InvoiceRefund table
CREATE TABLE IF NOT EXISTS "invoice_refund" (
  "id" BIGSERIAL PRIMARY KEY,
  "refund_number" VARCHAR(50) NOT NULL,
  "payment_id" BIGINT NOT NULL REFERENCES "payment"("id") ON DELETE CASCADE,
  "invoice_payment_id" BIGINT REFERENCES "invoice_payment"("id") ON DELETE SET NULL,
  "organization_id" BIGINT REFERENCES "organizations"("id") ON DELETE SET NULL,
  "branch_id" BIGINT REFERENCES "hospital_branch"("id") ON DELETE SET NULL,
  "amount" NUMERIC(12, 2) NOT NULL,
  "reason" TEXT NOT NULL,
  "method" VARCHAR(50) NOT NULL DEFAULT 'Cash',
  "approved_by_id" BIGINT REFERENCES "users"("id") ON DELETE SET NULL,
  "processed_by_id" BIGINT NOT NULL REFERENCES "users"("id"),
  "refunded_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "created_at" TIMESTAMPTZ DEFAULT now(),
  "updated_at" TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "invoice_refund_refund_number_key" ON "invoice_refund"("refund_number");
CREATE INDEX IF NOT EXISTS "invoice_refund_payment_id_idx" ON "invoice_refund"("payment_id");
CREATE INDEX IF NOT EXISTS "invoice_refund_invoice_payment_id_idx" ON "invoice_refund"("invoice_payment_id");
CREATE INDEX IF NOT EXISTS "invoice_refund_organization_id_idx" ON "invoice_refund"("organization_id");
CREATE INDEX IF NOT EXISTS "invoice_refund_branch_id_idx" ON "invoice_refund"("branch_id");
CREATE INDEX IF NOT EXISTS "invoice_refund_refunded_at_idx" ON "invoice_refund"("refunded_at");

-- 6. Extend CashTransaction to reference refunds
ALTER TABLE "cash_transaction"
  ADD COLUMN IF NOT EXISTS "refund_id" BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cash_transaction_refund_id_fkey'
  ) THEN
    ALTER TABLE "cash_transaction"
      ADD CONSTRAINT "cash_transaction_refund_id_fkey"
      FOREIGN KEY ("refund_id") REFERENCES "invoice_refund"("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "cash_transaction_refund_id_idx" ON "cash_transaction"("refund_id");
