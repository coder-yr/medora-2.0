-- AlterTable
ALTER TABLE "bed" ALTER COLUMN "status" SET NOT NULL;

-- AlterTable
ALTER TABLE "invoice_payment" ADD COLUMN     "shift_id" BIGINT;

-- CreateTable
CREATE TABLE "cash_drawer" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "branch_id" BIGINT,
    "assigned_cashier_id" BIGINT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "cash_drawer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cashier_shift" (
    "id" BIGSERIAL NOT NULL,
    "shift_number" VARCHAR(50) NOT NULL,
    "cashier_id" BIGINT NOT NULL,
    "branch_id" BIGINT,
    "cash_drawer_id" BIGINT,
    "opened_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMPTZ,
    "opening_cash" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "expected_cash" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "counted_cash" DECIMAL(12,2),
    "cash_variance" DECIMAL(12,2),
    "status" VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    "approved_by" BIGINT,
    "approved_at" TIMESTAMPTZ,
    "rejection_reason" TEXT,
    "closing_notes" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "cashier_shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_transaction" (
    "id" BIGSERIAL NOT NULL,
    "shift_id" BIGINT NOT NULL,
    "transaction_number" VARCHAR(50) NOT NULL,
    "transaction_type" VARCHAR(30) NOT NULL,
    "payment_id" BIGINT,
    "invoice_payment_id" BIGINT,
    "source_module" VARCHAR(30) NOT NULL DEFAULT 'INVOICE',
    "source_reference" VARCHAR(100),
    "idempotency_key" VARCHAR(100),
    "payment_method" VARCHAR(50) NOT NULL DEFAULT 'Cash',
    "amount" DECIMAL(12,2) NOT NULL,
    "is_cash" BOOLEAN NOT NULL DEFAULT true,
    "direction" VARCHAR(10) NOT NULL DEFAULT 'INFLOW',
    "recorded_by" BIGINT NOT NULL,
    "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversal_reference" VARCHAR(100),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "cash_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_close_denomination" (
    "id" BIGSERIAL NOT NULL,
    "shift_id" BIGINT NOT NULL,
    "denomination" DECIMAL(10,2) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_close_denomination_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cash_drawer_code_key" ON "cash_drawer"("code");

-- CreateIndex
CREATE UNIQUE INDEX "cashier_shift_shift_number_key" ON "cashier_shift"("shift_number");

-- CreateIndex
CREATE INDEX "cashier_shift_cashier_id_idx" ON "cashier_shift"("cashier_id");

-- CreateIndex
CREATE INDEX "cashier_shift_status_idx" ON "cashier_shift"("status");

-- CreateIndex
CREATE INDEX "cashier_shift_branch_id_idx" ON "cashier_shift"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "cash_transaction_transaction_number_key" ON "cash_transaction"("transaction_number");

-- CreateIndex
CREATE UNIQUE INDEX "cash_transaction_idempotency_key_key" ON "cash_transaction"("idempotency_key");

-- CreateIndex
CREATE INDEX "cash_transaction_shift_id_idx" ON "cash_transaction"("shift_id");

-- CreateIndex
CREATE INDEX "cash_transaction_payment_id_idx" ON "cash_transaction"("payment_id");

-- CreateIndex
CREATE INDEX "cash_transaction_transaction_type_idx" ON "cash_transaction"("transaction_type");

-- CreateIndex
CREATE INDEX "cash_transaction_occurred_at_idx" ON "cash_transaction"("occurred_at");

-- CreateIndex
CREATE INDEX "shift_close_denomination_shift_id_idx" ON "shift_close_denomination"("shift_id");

-- CreateIndex
CREATE INDEX "invoice_payment_shift_id_idx" ON "invoice_payment"("shift_id");

-- AddForeignKey
ALTER TABLE "invoice_payment" ADD CONSTRAINT "invoice_payment_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "cashier_shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_drawer" ADD CONSTRAINT "cash_drawer_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "hospital_branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_drawer" ADD CONSTRAINT "cash_drawer_assigned_cashier_id_fkey" FOREIGN KEY ("assigned_cashier_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cashier_shift" ADD CONSTRAINT "cashier_shift_cashier_id_fkey" FOREIGN KEY ("cashier_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cashier_shift" ADD CONSTRAINT "cashier_shift_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cashier_shift" ADD CONSTRAINT "cashier_shift_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "hospital_branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cashier_shift" ADD CONSTRAINT "cashier_shift_cash_drawer_id_fkey" FOREIGN KEY ("cash_drawer_id") REFERENCES "cash_drawer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_transaction" ADD CONSTRAINT "cash_transaction_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "cashier_shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_transaction" ADD CONSTRAINT "cash_transaction_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_transaction" ADD CONSTRAINT "cash_transaction_invoice_payment_id_fkey" FOREIGN KEY ("invoice_payment_id") REFERENCES "invoice_payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_transaction" ADD CONSTRAINT "cash_transaction_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_close_denomination" ADD CONSTRAINT "shift_close_denomination_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "cashier_shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;
