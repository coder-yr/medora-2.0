-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');

-- CreateEnum
CREATE TYPE "NormalBalance" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "AccountingPeriodStatus" AS ENUM ('OPEN', 'CLOSING', 'CLOSED');

-- CreateEnum
CREATE TYPE "JournalStatus" AS ENUM ('DRAFT', 'POSTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PAID', 'CANCELLED');

-- CreateTable
CREATE TABLE "accounting_account" (
    "id" BIGSERIAL NOT NULL,
    "account_code" VARCHAR(50) NOT NULL,
    "account_name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "account_type" "AccountType" NOT NULL,
    "account_sub_type" VARCHAR(100),
    "normal_balance" "NormalBalance" NOT NULL,
    "parent_account_id" BIGINT,
    "is_system_account" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "allow_manual_posting" BOOLEAN NOT NULL DEFAULT true,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'PKR',
    "branch_id" BIGINT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "accounting_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_period" (
    "id" BIGSERIAL NOT NULL,
    "period_code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" "AccountingPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "branch_id" BIGINT,
    "closed_at" TIMESTAMPTZ,
    "closed_by" BIGINT,
    "closing_notes" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "accounting_period_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_journal_entry" (
    "id" BIGSERIAL NOT NULL,
    "journal_number" VARCHAR(50) NOT NULL,
    "accounting_date" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "reference_type" VARCHAR(50),
    "reference_id" VARCHAR(100),
    "source_module" VARCHAR(50) NOT NULL DEFAULT 'MANUAL',
    "source_reference" VARCHAR(100),
    "idempotency_key" VARCHAR(150),
    "status" "JournalStatus" NOT NULL DEFAULT 'DRAFT',
    "total_debit" DECIMAL(14,2) NOT NULL,
    "total_credit" DECIMAL(14,2) NOT NULL,
    "branch_id" BIGINT,
    "period_id" BIGINT,
    "created_by_id" BIGINT NOT NULL,
    "posted_by_id" BIGINT,
    "posted_at" TIMESTAMPTZ,
    "reversed_entry_id" BIGINT,
    "reversal_reason" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "accounting_journal_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_journal_line" (
    "id" BIGSERIAL NOT NULL,
    "journal_entry_id" BIGINT NOT NULL,
    "account_id" BIGINT NOT NULL,
    "line_number" INTEGER NOT NULL DEFAULT 1,
    "debit" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    "credit" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    "description" VARCHAR(255),
    "branch_id" BIGINT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounting_journal_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_expense_category" (
    "id" BIGSERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "account_id" BIGINT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "accounting_expense_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_expense" (
    "id" BIGSERIAL NOT NULL,
    "expense_number" VARCHAR(50) NOT NULL,
    "category_id" BIGINT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "expense_date" DATE NOT NULL,
    "vendor_name" VARCHAR(150),
    "invoice_number" VARCHAR(100),
    "payment_method" VARCHAR(50) NOT NULL DEFAULT 'CASH',
    "status" "ExpenseStatus" NOT NULL DEFAULT 'DRAFT',
    "branch_id" BIGINT,
    "created_by_id" BIGINT NOT NULL,
    "approved_by_id" BIGINT,
    "approved_at" TIMESTAMPTZ,
    "rejection_reason" TEXT,
    "paid_at" TIMESTAMPTZ,
    "paid_by_id" BIGINT,
    "posted_journal_entry_id" BIGINT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "accounting_expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_setting" (
    "id" BIGSERIAL NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "value" TEXT NOT NULL,
    "description" VARCHAR(255),
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "accounting_setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(255),
    "sector" VARCHAR(255),
    "category" VARCHAR(50),
    "description" TEXT,
    "amount" DECIMAL(12,2),
    "date" VARCHAR(50),
    "receipt_no" VARCHAR(100),
    "user_id" BIGINT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "accounting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_sector" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "status" VARCHAR(50) DEFAULT 'active',
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "accounting_sector_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounting_account_account_code_key" ON "accounting_account"("account_code");
CREATE INDEX "accounting_account_account_code_idx" ON "accounting_account"("account_code");
CREATE INDEX "accounting_account_account_type_idx" ON "accounting_account"("account_type");
CREATE INDEX "accounting_account_parent_account_id_idx" ON "accounting_account"("parent_account_id");
CREATE INDEX "accounting_account_branch_id_idx" ON "accounting_account"("branch_id");
CREATE INDEX "accounting_account_is_active_idx" ON "accounting_account"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_period_period_code_key" ON "accounting_period"("period_code");
CREATE INDEX "accounting_period_period_code_idx" ON "accounting_period"("period_code");
CREATE INDEX "accounting_period_status_idx" ON "accounting_period"("status");
CREATE INDEX "accounting_period_start_date_end_date_idx" ON "accounting_period"("start_date", "end_date");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_journal_entry_journal_number_key" ON "accounting_journal_entry"("journal_number");
CREATE UNIQUE INDEX "accounting_journal_entry_idempotency_key_key" ON "accounting_journal_entry"("idempotency_key");
CREATE UNIQUE INDEX "accounting_journal_entry_reversed_entry_id_key" ON "accounting_journal_entry"("reversed_entry_id");
CREATE INDEX "accounting_journal_entry_journal_number_idx" ON "accounting_journal_entry"("journal_number");
CREATE INDEX "accounting_journal_entry_accounting_date_idx" ON "accounting_journal_entry"("accounting_date");
CREATE INDEX "accounting_journal_entry_status_idx" ON "accounting_journal_entry"("status");
CREATE INDEX "accounting_journal_entry_source_module_idx" ON "accounting_journal_entry"("source_module");
CREATE INDEX "accounting_journal_entry_reference_type_reference_id_idx" ON "accounting_journal_entry"("reference_type", "reference_id");

-- CreateIndex
CREATE INDEX "accounting_journal_line_journal_entry_id_idx" ON "accounting_journal_line"("journal_entry_id");
CREATE INDEX "accounting_journal_line_account_id_idx" ON "accounting_journal_line"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_expense_category_code_key" ON "accounting_expense_category"("code");
CREATE INDEX "accounting_expense_category_code_idx" ON "accounting_expense_category"("code");
CREATE INDEX "accounting_expense_category_is_active_idx" ON "accounting_expense_category"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_expense_expense_number_key" ON "accounting_expense"("expense_number");
CREATE INDEX "accounting_expense_expense_number_idx" ON "accounting_expense"("expense_number");
CREATE INDEX "accounting_expense_status_idx" ON "accounting_expense"("status");
CREATE INDEX "accounting_expense_expense_date_idx" ON "accounting_expense"("expense_date");
CREATE INDEX "accounting_expense_category_id_idx" ON "accounting_expense"("category_id");
CREATE INDEX "accounting_expense_created_by_id_idx" ON "accounting_expense"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_setting_key_key" ON "accounting_setting"("key");

-- AddForeignKey
ALTER TABLE "accounting_account" ADD CONSTRAINT "accounting_account_parent_account_id_fkey" FOREIGN KEY ("parent_account_id") REFERENCES "accounting_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "accounting_account" ADD CONSTRAINT "accounting_account_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "hospital_branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_period" ADD CONSTRAINT "accounting_period_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "hospital_branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "accounting_period" ADD CONSTRAINT "accounting_period_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_journal_entry" ADD CONSTRAINT "accounting_journal_entry_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "hospital_branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "accounting_journal_entry" ADD CONSTRAINT "accounting_journal_entry_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "accounting_period"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "accounting_journal_entry" ADD CONSTRAINT "accounting_journal_entry_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "accounting_journal_entry" ADD CONSTRAINT "accounting_journal_entry_posted_by_id_fkey" FOREIGN KEY ("posted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "accounting_journal_entry" ADD CONSTRAINT "accounting_journal_entry_reversed_entry_id_fkey" FOREIGN KEY ("reversed_entry_id") REFERENCES "accounting_journal_entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_journal_line" ADD CONSTRAINT "accounting_journal_line_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "accounting_journal_entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "accounting_journal_line" ADD CONSTRAINT "accounting_journal_line_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounting_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_expense_category" ADD CONSTRAINT "accounting_expense_category_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounting_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_expense" ADD CONSTRAINT "accounting_expense_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "accounting_expense_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "accounting_expense" ADD CONSTRAINT "accounting_expense_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "hospital_branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "accounting_expense" ADD CONSTRAINT "accounting_expense_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "accounting_expense" ADD CONSTRAINT "accounting_expense_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "accounting_expense" ADD CONSTRAINT "accounting_expense_paid_by_id_fkey" FOREIGN KEY ("paid_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "accounting_expense" ADD CONSTRAINT "accounting_expense_posted_journal_entry_id_fkey" FOREIGN KEY ("posted_journal_entry_id") REFERENCES "accounting_journal_entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

