-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserGroup" AS ENUM ('Admin', 'Doctor', 'Nurse', 'Accountant', 'Receptionist', 'Pharmacist', 'Laboratorist');

-- CreateTable
CREATE TABLE "users" (
    "id" BIGSERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "firstname" VARCHAR(50) NOT NULL,
    "lastname" VARCHAR(50) NOT NULL,
    "login" VARCHAR(100) NOT NULL,
    "email" VARCHAR(100) NOT NULL DEFAULT '',
    "password" VARCHAR(255) NOT NULL,
    "group" VARCHAR(20) NOT NULL,
    "desc" VARCHAR(255),
    "branch_id" BIGINT,
    "photo" VARCHAR(255),
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" BIGSERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "refresh_token_hash" VARCHAR(255) NOT NULL,
    "family_id" VARCHAR(100) NOT NULL,
    "is_revoked" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "user_agent" VARCHAR(255),
    "ip_address" VARCHAR(50),
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission" (
    "id" BIGSERIAL NOT NULL,
    "permission_name" VARCHAR(100) NOT NULL,
    "permission_group" VARCHAR(50) NOT NULL,
    "permission_type" VARCHAR(10) NOT NULL DEFAULT 'no',

    CONSTRAINT "permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hospital_branch" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "address" VARCHAR(255),
    "phone" VARCHAR(50),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "hospital_branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "institute" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "establish" VARCHAR(10),
    "email" VARCHAR(100),
    "web" VARCHAR(100),
    "phoneNo" VARCHAR(50),
    "address" VARCHAR(255),
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "institute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(1000),
    "x" VARCHAR(50) DEFAULT '',
    "y" VARCHAR(50) DEFAULT '',
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_type" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "slug" VARCHAR(50) NOT NULL,
    "description" VARCHAR(255),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "patient_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient" (
    "id" BIGSERIAL NOT NULL,
    "patient_id" VARCHAR(100),
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(100),
    "phone" VARCHAR(100),
    "address" VARCHAR(255),
    "birthdate" VARCHAR(100),
    "age" VARCHAR(100),
    "sex" VARCHAR(50),
    "bloodgroup" VARCHAR(50),
    "patient_type_id" BIGINT,
    "cnic" VARCHAR(50),
    "father_name" VARCHAR(100),
    "guardian_relation" VARCHAR(50),
    "guardian_mrn" VARCHAR(50),
    "mlc" BOOLEAN NOT NULL DEFAULT false,
    "old_mrn" VARCHAR(50),
    "employee_no" VARCHAR(50),
    "alt_phone" VARCHAR(50),
    "city" VARCHAR(100),
    "branch_id" BIGINT,
    "img_url" VARCHAR(255),
    "doctor" VARCHAR(100),
    "add_date" VARCHAR(100),
    "registration_time" VARCHAR(100),
    "ion_user_id" VARCHAR(100),
    "how_added" VARCHAR(100),
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bed_category" (
    "id" BIGSERIAL NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "description" TEXT,

    CONSTRAINT "bed_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bed" (
    "id" BIGSERIAL NOT NULL,
    "category" BIGINT NOT NULL,
    "number" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255),
    "status" VARCHAR(50) DEFAULT 'available',
    "branch_id" BIGINT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "bed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alloted_bed" (
    "id" BIGSERIAL NOT NULL,
    "patient" BIGINT NOT NULL,
    "bed_id" BIGINT NOT NULL,
    "a_time" VARCHAR(100) NOT NULL,
    "d_time" VARCHAR(100),
    "category" VARCHAR(100),
    "description" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "alloted_bed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_history" (
    "id" BIGSERIAL NOT NULL,
    "patient_id" BIGINT NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "description" TEXT NOT NULL,
    "date" VARCHAR(50) NOT NULL,
    "img_url" VARCHAR(255),
    "patient_name" VARCHAR(100),
    "patient_phone" VARCHAR(50),
    "patient_address" VARCHAR(255),
    "registration_time" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "medical_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_deposit" (
    "id" BIGSERIAL NOT NULL,
    "patient" BIGINT NOT NULL,
    "deposited_amount" DECIMAL(10,2) NOT NULL,
    "date" VARCHAR(50) NOT NULL,
    "user" VARCHAR(50),
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "patient_deposit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(100),
    "phone" VARCHAR(50),
    "address" VARCHAR(255),
    "department" VARCHAR(100),
    "profile" TEXT,
    "img_url" VARCHAR(255),
    "x" VARCHAR(50) DEFAULT '',
    "y" VARCHAR(50) DEFAULT '',
    "ion_user_id" VARCHAR(50),
    "procedure_id" VARCHAR(100),
    "share_policy_id" BIGINT,
    "branch_id" BIGINT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "doctor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment" (
    "id" BIGSERIAL NOT NULL,
    "patient" BIGINT NOT NULL,
    "doctor" BIGINT NOT NULL,
    "date" VARCHAR(50) NOT NULL,
    "time_slot" VARCHAR(100),
    "s_time" VARCHAR(50) NOT NULL,
    "e_time" VARCHAR(50) NOT NULL,
    "s_time_key" VARCHAR(50),
    "status" VARCHAR(50) NOT NULL DEFAULT 'scheduled',
    "remarks" TEXT,
    "add_date" VARCHAR(50),
    "registration_time" VARCHAR(50),
    "user" VARCHAR(100) DEFAULT '',
    "request" VARCHAR(100) DEFAULT '',
    "b_p" VARCHAR(100),
    "pulse" VARCHAR(100),
    "temprature" VARCHAR(100),
    "weight" VARCHAR(100),
    "token_no" INTEGER,
    "queue_number" INTEGER,
    "token_number" VARCHAR(50),
    "visit_type" VARCHAR(50) DEFAULT 'first_visit',
    "payment_id" BIGINT,
    "mode" VARCHAR(20) NOT NULL DEFAULT 'in_person',
    "video_room" VARCHAR(100),
    "branch_id" BIGINT,
    "checked_in_at" TIMESTAMPTZ,
    "consult_started_at" TIMESTAMPTZ,
    "called_in_at" TIMESTAMPTZ,
    "checked_out_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_slot" (
    "id" BIGSERIAL NOT NULL,
    "doctor_id" BIGINT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "slot_minutes" INTEGER NOT NULL DEFAULT 15,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "doctor_slot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slot_block" (
    "id" BIGSERIAL NOT NULL,
    "doctor_id" BIGINT NOT NULL,
    "date" DATE NOT NULL,
    "start_time" VARCHAR(5),
    "end_time" VARCHAR(5),
    "reason" VARCHAR(255),
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "slot_block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visit_fee" (
    "id" BIGSERIAL NOT NULL,
    "doctor_id" BIGINT,
    "visit_type" VARCHAR(20) NOT NULL,
    "patient_type_id" BIGINT,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'PKR',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "visit_fee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holidays" (
    "id" BIGSERIAL NOT NULL,
    "date" VARCHAR(50) NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultation" (
    "id" BIGSERIAL NOT NULL,
    "appointment_id" BIGINT,
    "patient_id" BIGINT NOT NULL,
    "doctor_id" BIGINT,
    "date" DATE NOT NULL,
    "presenting_complaint" TEXT,
    "history" TEXT,
    "examination" JSONB,
    "provisional_diagnosis" TEXT,
    "diagnosis" TEXT,
    "plan" TEXT,
    "treatment" TEXT,
    "follow_up_date" DATE,
    "follow_up_notes" VARCHAR(255),
    "allergies" TEXT,
    "past_history" JSONB,
    "social_history" JSONB,
    "specialty" JSONB,
    "immunizations" JSONB,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "completed_at" TIMESTAMPTZ,
    "created_by" BIGINT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "consultation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consult_template" (
    "id" BIGSERIAL NOT NULL,
    "doctor_id" BIGINT,
    "name" VARCHAR(100) NOT NULL,
    "fields" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "consult_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription" (
    "id" BIGSERIAL NOT NULL,
    "patient" BIGINT NOT NULL,
    "doctor" BIGINT NOT NULL,
    "date" VARCHAR(50) NOT NULL,
    "symptom" TEXT,
    "advice" TEXT,
    "state" VARCHAR(50) DEFAULT 'issued',
    "dd" VARCHAR(100),
    "medicine" TEXT,
    "validity" VARCHAR(100),
    "note" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "prescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription_medicine" (
    "id" BIGSERIAL NOT NULL,
    "prescription_id" BIGINT NOT NULL,
    "medicine_id" BIGINT,
    "name" VARCHAR(200) NOT NULL,
    "dosage" VARCHAR(100),
    "duration" VARCHAR(100),
    "instructions" VARCHAR(500),

    CONSTRAINT "prescription_medicine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_category" (
    "id" BIGSERIAL NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "reference_value" VARCHAR(255),
    "description" TEXT,
    "price" DECIMAL(10,2),

    CONSTRAINT "lab_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab" (
    "id" BIGSERIAL NOT NULL,
    "patient" BIGINT NOT NULL,
    "doctor" BIGINT,
    "date" VARCHAR(50) NOT NULL,
    "date_string" VARCHAR(50),
    "category" VARCHAR(255),
    "category_name" VARCHAR(1000),
    "report" TEXT,
    "status" VARCHAR(50) NOT NULL DEFAULT 'requested',
    "user" VARCHAR(50),
    "patient_name" VARCHAR(100),
    "patient_phone" VARCHAR(50),
    "patient_address" VARCHAR(255),
    "doctor_name" VARCHAR(100),
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "lab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_test" (
    "id" BIGSERIAL NOT NULL,
    "lab_id" BIGINT NOT NULL,
    "lab_category_id" BIGINT,
    "name" VARCHAR(100) NOT NULL,
    "reference_value" VARCHAR(255),
    "result" TEXT,
    "status" VARCHAR(50) NOT NULL DEFAULT 'requested',
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "lab_test_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radiology_exam" (
    "id" BIGSERIAL NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "modality" VARCHAR(20) NOT NULL,
    "body_part" VARCHAR(50),
    "payment_category_id" BIGINT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "radiology_exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radiology_order" (
    "id" BIGSERIAL NOT NULL,
    "order_number" VARCHAR(30) NOT NULL,
    "patient_id" BIGINT NOT NULL,
    "doctor_id" BIGINT,
    "radiology_exam_id" BIGINT NOT NULL,
    "order_date" TIMESTAMPTZ NOT NULL,
    "clinical_indication" TEXT,
    "urgency" VARCHAR(10) NOT NULL DEFAULT 'routine',
    "status" VARCHAR(20) NOT NULL DEFAULT 'ordered',
    "reported_at" TIMESTAMPTZ,
    "reported_by" BIGINT,
    "technologist_id" BIGINT,
    "invoice_id" BIGINT,
    "branch_id" BIGINT,
    "findings" TEXT,
    "impression" TEXT,
    "recommendations" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "radiology_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medicine_category" (
    "id" BIGSERIAL NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "description" TEXT,

    CONSTRAINT "medicine_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medicine" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "category" BIGINT,
    "price" DECIMAL(10,2) NOT NULL,
    "box" DECIMAL(10,2),
    "s_price" DECIMAL(10,2),
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "generic" VARCHAR(100),
    "company" VARCHAR(100),
    "effects" TEXT,
    "e_date" VARCHAR(50),
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "medicine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmacy_payment" (
    "id" BIGSERIAL NOT NULL,
    "patient" BIGINT,
    "doctor" BIGINT,
    "date" VARCHAR(50) NOT NULL,
    "gross_total" DECIMAL(10,2) NOT NULL,
    "amount_received" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(10,2) DEFAULT 0.00,
    "status" VARCHAR(20) NOT NULL DEFAULT 'unpaid',
    "shift_close_id" BIGINT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "pharmacy_payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmacy_sale_item" (
    "id" BIGSERIAL NOT NULL,
    "pharmacy_payment_id" BIGINT NOT NULL,
    "medicine_id" BIGINT NOT NULL,
    "medicine_name" VARCHAR(100) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "total_price" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "pharmacy_sale_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_category" (
    "id" BIGSERIAL NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "c_price" DECIMAL(10,2) NOT NULL,
    "d_commission" DECIMAL(5,2),
    "kind" VARCHAR(20) NOT NULL DEFAULT 'misc',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "payment_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_price" (
    "id" BIGSERIAL NOT NULL,
    "payment_category_id" BIGINT NOT NULL,
    "patient_type_id" BIGINT NOT NULL,
    "opd_price" DECIMAL(10,2),
    "ipd_price" DECIMAL(10,2),
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "service_price_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment" (
    "id" BIGSERIAL NOT NULL,
    "patient" BIGINT NOT NULL,
    "doctor" VARCHAR(100),
    "referring_doctor" VARCHAR(100),
    "date" VARCHAR(50) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "gross_total" DECIMAL(12,2) NOT NULL,
    "amount_received" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "discount" DECIMAL(12,2) DEFAULT 0.00,
    "vat" DECIMAL(12,2) DEFAULT 0.00,
    "status" VARCHAR(20) NOT NULL DEFAULT 'unpaid',
    "patient_type_id" BIGINT,
    "care_setting" VARCHAR(10) NOT NULL DEFAULT 'opd',
    "shift_close_id" BIGINT,
    "branch_id" BIGINT,
    "remarks" TEXT,
    "doctor_name" VARCHAR(100),
    "user" VARCHAR(100),
    "date_string" VARCHAR(50),
    "patient_name" VARCHAR(100),
    "patient_phone" VARCHAR(50),
    "patient_address" VARCHAR(255),
    "category" VARCHAR(255),
    "category_name" VARCHAR(1000),
    "category_amount" VARCHAR(1000),
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_item" (
    "id" BIGSERIAL NOT NULL,
    "payment_id" BIGINT NOT NULL,
    "payment_category_id" BIGINT,
    "name" VARCHAR(200) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "line_total" DECIMAL(12,2) NOT NULL,
    "doctor_id" BIGINT,

    CONSTRAINT "invoice_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_payment" (
    "id" BIGSERIAL NOT NULL,
    "payment_id" BIGINT NOT NULL,
    "date" VARCHAR(50),
    "amount" DECIMAL(12,2) NOT NULL,
    "method" VARCHAR(60) DEFAULT 'Cash',
    "reference" VARCHAR(120),
    "paid_at" VARCHAR(100),
    "received_by" BIGINT,
    "shift_close_id" BIGINT,
    "user" VARCHAR(50),
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "invoice_payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_close" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "closed_at" TIMESTAMPTZ NOT NULL,
    "expected_cash" DECIMAL(12,2) NOT NULL,
    "counted_cash" DECIMAL(12,2) NOT NULL,
    "discrepancy" DECIMAL(12,2) NOT NULL,
    "bank_transfer_total" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "card_total" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "cheque_total" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "other_total" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "write_off_total" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "notes" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'closed',
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "shift_close_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_share" (
    "id" BIGSERIAL NOT NULL,
    "payment_id" BIGINT NOT NULL,
    "invoice_item_id" BIGINT,
    "doctor_id" BIGINT NOT NULL,
    "share_rule_id" BIGINT,
    "role" VARCHAR(20) NOT NULL DEFAULT 'performing',
    "base_amount" DECIMAL(10,2) NOT NULL,
    "percent" DECIMAL(5,2),
    "amount" DECIMAL(10,2) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "approved_by" BIGINT,
    "approved_at" TIMESTAMPTZ,
    "payout_ref" VARCHAR(50),
    "paid_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "doctor_share_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_uuid_key" ON "users"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "users_login_key" ON "users"("login");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_uuid_key" ON "user_sessions"("uuid");

-- CreateIndex
CREATE INDEX "user_sessions_user_id_idx" ON "user_sessions"("user_id");

-- CreateIndex
CREATE INDEX "user_sessions_refresh_token_hash_idx" ON "user_sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "user_sessions_family_id_idx" ON "user_sessions"("family_id");

-- CreateIndex
CREATE INDEX "permission_permission_group_idx" ON "permission"("permission_group");

-- CreateIndex
CREATE UNIQUE INDEX "permission_permission_name_permission_group_key" ON "permission"("permission_name", "permission_group");

-- CreateIndex
CREATE UNIQUE INDEX "hospital_branch_code_key" ON "hospital_branch"("code");

-- CreateIndex
CREATE UNIQUE INDEX "department_name_key" ON "department"("name");

-- CreateIndex
CREATE UNIQUE INDEX "patient_type_slug_key" ON "patient_type"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "patient_patient_id_key" ON "patient"("patient_id");

-- CreateIndex
CREATE INDEX "patient_patient_type_id_idx" ON "patient"("patient_type_id");

-- CreateIndex
CREATE INDEX "patient_branch_id_idx" ON "patient"("branch_id");

-- CreateIndex
CREATE INDEX "patient_cnic_idx" ON "patient"("cnic");

-- CreateIndex
CREATE INDEX "patient_phone_idx" ON "patient"("phone");

-- CreateIndex
CREATE INDEX "patient_old_mrn_idx" ON "patient"("old_mrn");

-- CreateIndex
CREATE INDEX "bed_branch_id_idx" ON "bed"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "bed_category_number_key" ON "bed"("category", "number");

-- CreateIndex
CREATE INDEX "alloted_bed_patient_idx" ON "alloted_bed"("patient");

-- CreateIndex
CREATE INDEX "alloted_bed_bed_id_idx" ON "alloted_bed"("bed_id");

-- CreateIndex
CREATE INDEX "alloted_bed_d_time_idx" ON "alloted_bed"("d_time");

-- CreateIndex
CREATE INDEX "medical_history_patient_id_idx" ON "medical_history"("patient_id");

-- CreateIndex
CREATE INDEX "patient_deposit_patient_idx" ON "patient_deposit"("patient");

-- CreateIndex
CREATE INDEX "doctor_email_idx" ON "doctor"("email");

-- CreateIndex
CREATE INDEX "doctor_department_idx" ON "doctor"("department");

-- CreateIndex
CREATE INDEX "doctor_branch_id_idx" ON "doctor"("branch_id");

-- CreateIndex
CREATE INDEX "appointment_doctor_date_idx" ON "appointment"("doctor", "date");

-- CreateIndex
CREATE INDEX "appointment_patient_idx" ON "appointment"("patient");

-- CreateIndex
CREATE INDEX "appointment_status_idx" ON "appointment"("status");

-- CreateIndex
CREATE INDEX "appointment_s_time_key_idx" ON "appointment"("s_time_key");

-- CreateIndex
CREATE INDEX "appointment_branch_id_idx" ON "appointment"("branch_id");

-- CreateIndex
CREATE INDEX "doctor_slot_doctor_id_weekday_idx" ON "doctor_slot"("doctor_id", "weekday");

-- CreateIndex
CREATE INDEX "slot_block_doctor_id_date_idx" ON "slot_block"("doctor_id", "date");

-- CreateIndex
CREATE INDEX "visit_fee_doctor_id_idx" ON "visit_fee"("doctor_id");

-- CreateIndex
CREATE UNIQUE INDEX "consultation_appointment_id_key" ON "consultation"("appointment_id");

-- CreateIndex
CREATE INDEX "consultation_patient_id_idx" ON "consultation"("patient_id");

-- CreateIndex
CREATE INDEX "consultation_doctor_id_idx" ON "consultation"("doctor_id");

-- CreateIndex
CREATE INDEX "consultation_date_idx" ON "consultation"("date");

-- CreateIndex
CREATE INDEX "consult_template_doctor_id_idx" ON "consult_template"("doctor_id");

-- CreateIndex
CREATE INDEX "prescription_patient_idx" ON "prescription"("patient");

-- CreateIndex
CREATE INDEX "prescription_doctor_idx" ON "prescription"("doctor");

-- CreateIndex
CREATE INDEX "prescription_medicine_prescription_id_idx" ON "prescription_medicine"("prescription_id");

-- CreateIndex
CREATE INDEX "prescription_medicine_medicine_id_idx" ON "prescription_medicine"("medicine_id");

-- CreateIndex
CREATE INDEX "lab_patient_idx" ON "lab"("patient");

-- CreateIndex
CREATE INDEX "lab_status_idx" ON "lab"("status");

-- CreateIndex
CREATE INDEX "lab_test_lab_id_idx" ON "lab_test"("lab_id");

-- CreateIndex
CREATE UNIQUE INDEX "radiology_exam_code_key" ON "radiology_exam"("code");

-- CreateIndex
CREATE UNIQUE INDEX "radiology_order_order_number_key" ON "radiology_order"("order_number");

-- CreateIndex
CREATE INDEX "radiology_order_patient_id_idx" ON "radiology_order"("patient_id");

-- CreateIndex
CREATE INDEX "radiology_order_status_idx" ON "radiology_order"("status");

-- CreateIndex
CREATE INDEX "medicine_category_idx" ON "medicine"("category");

-- CreateIndex
CREATE INDEX "pharmacy_payment_shift_close_id_idx" ON "pharmacy_payment"("shift_close_id");

-- CreateIndex
CREATE INDEX "pharmacy_sale_item_pharmacy_payment_id_idx" ON "pharmacy_sale_item"("pharmacy_payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_price_payment_category_id_patient_type_id_key" ON "service_price"("payment_category_id", "patient_type_id");

-- CreateIndex
CREATE INDEX "payment_patient_idx" ON "payment"("patient");

-- CreateIndex
CREATE INDEX "payment_status_idx" ON "payment"("status");

-- CreateIndex
CREATE INDEX "payment_shift_close_id_idx" ON "payment"("shift_close_id");

-- CreateIndex
CREATE INDEX "invoice_item_payment_id_idx" ON "invoice_item"("payment_id");

-- CreateIndex
CREATE INDEX "invoice_payment_payment_id_idx" ON "invoice_payment"("payment_id");

-- CreateIndex
CREATE INDEX "invoice_payment_shift_close_id_idx" ON "invoice_payment"("shift_close_id");

-- CreateIndex
CREATE INDEX "shift_close_user_id_idx" ON "shift_close"("user_id");

-- CreateIndex
CREATE INDEX "doctor_share_doctor_id_idx" ON "doctor_share"("doctor_id");

-- CreateIndex
CREATE INDEX "doctor_share_status_idx" ON "doctor_share"("status");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "hospital_branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient" ADD CONSTRAINT "patient_patient_type_id_fkey" FOREIGN KEY ("patient_type_id") REFERENCES "patient_type"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient" ADD CONSTRAINT "patient_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "hospital_branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bed" ADD CONSTRAINT "bed_category_fkey" FOREIGN KEY ("category") REFERENCES "bed_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bed" ADD CONSTRAINT "bed_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "hospital_branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alloted_bed" ADD CONSTRAINT "alloted_bed_patient_fkey" FOREIGN KEY ("patient") REFERENCES "patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alloted_bed" ADD CONSTRAINT "alloted_bed_bed_id_fkey" FOREIGN KEY ("bed_id") REFERENCES "bed"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_history" ADD CONSTRAINT "medical_history_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_deposit" ADD CONSTRAINT "patient_deposit_patient_fkey" FOREIGN KEY ("patient") REFERENCES "patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor" ADD CONSTRAINT "doctor_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "hospital_branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_patient_fkey" FOREIGN KEY ("patient") REFERENCES "patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_doctor_fkey" FOREIGN KEY ("doctor") REFERENCES "doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "hospital_branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_slot" ADD CONSTRAINT "doctor_slot_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slot_block" ADD CONSTRAINT "slot_block_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_fee" ADD CONSTRAINT "visit_fee_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_fee" ADD CONSTRAINT "visit_fee_patient_type_id_fkey" FOREIGN KEY ("patient_type_id") REFERENCES "patient_type"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation" ADD CONSTRAINT "consultation_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation" ADD CONSTRAINT "consultation_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation" ADD CONSTRAINT "consultation_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consult_template" ADD CONSTRAINT "consult_template_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription" ADD CONSTRAINT "prescription_patient_fkey" FOREIGN KEY ("patient") REFERENCES "patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription" ADD CONSTRAINT "prescription_doctor_fkey" FOREIGN KEY ("doctor") REFERENCES "doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_medicine" ADD CONSTRAINT "prescription_medicine_prescription_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "prescription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_medicine" ADD CONSTRAINT "prescription_medicine_medicine_id_fkey" FOREIGN KEY ("medicine_id") REFERENCES "medicine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab" ADD CONSTRAINT "lab_patient_fkey" FOREIGN KEY ("patient") REFERENCES "patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab" ADD CONSTRAINT "lab_doctor_fkey" FOREIGN KEY ("doctor") REFERENCES "doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_test" ADD CONSTRAINT "lab_test_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "lab"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_test" ADD CONSTRAINT "lab_test_lab_category_id_fkey" FOREIGN KEY ("lab_category_id") REFERENCES "lab_category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radiology_exam" ADD CONSTRAINT "radiology_exam_payment_category_id_fkey" FOREIGN KEY ("payment_category_id") REFERENCES "payment_category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radiology_order" ADD CONSTRAINT "radiology_order_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radiology_order" ADD CONSTRAINT "radiology_order_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radiology_order" ADD CONSTRAINT "radiology_order_radiology_exam_id_fkey" FOREIGN KEY ("radiology_exam_id") REFERENCES "radiology_exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radiology_order" ADD CONSTRAINT "radiology_order_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radiology_order" ADD CONSTRAINT "radiology_order_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicine" ADD CONSTRAINT "medicine_category_fkey" FOREIGN KEY ("category") REFERENCES "medicine_category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_payment" ADD CONSTRAINT "pharmacy_payment_shift_close_id_fkey" FOREIGN KEY ("shift_close_id") REFERENCES "shift_close"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_sale_item" ADD CONSTRAINT "pharmacy_sale_item_pharmacy_payment_id_fkey" FOREIGN KEY ("pharmacy_payment_id") REFERENCES "pharmacy_payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_sale_item" ADD CONSTRAINT "pharmacy_sale_item_medicine_id_fkey" FOREIGN KEY ("medicine_id") REFERENCES "medicine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_price" ADD CONSTRAINT "service_price_payment_category_id_fkey" FOREIGN KEY ("payment_category_id") REFERENCES "payment_category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_price" ADD CONSTRAINT "service_price_patient_type_id_fkey" FOREIGN KEY ("patient_type_id") REFERENCES "patient_type"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_patient_fkey" FOREIGN KEY ("patient") REFERENCES "patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_patient_type_id_fkey" FOREIGN KEY ("patient_type_id") REFERENCES "patient_type"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "hospital_branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_shift_close_id_fkey" FOREIGN KEY ("shift_close_id") REFERENCES "shift_close"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_item" ADD CONSTRAINT "invoice_item_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_item" ADD CONSTRAINT "invoice_item_payment_category_id_fkey" FOREIGN KEY ("payment_category_id") REFERENCES "payment_category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_item" ADD CONSTRAINT "invoice_item_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_payment" ADD CONSTRAINT "invoice_payment_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_payment" ADD CONSTRAINT "invoice_payment_shift_close_id_fkey" FOREIGN KEY ("shift_close_id") REFERENCES "shift_close"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_close" ADD CONSTRAINT "shift_close_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_share" ADD CONSTRAINT "doctor_share_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_share" ADD CONSTRAINT "doctor_share_invoice_item_id_fkey" FOREIGN KEY ("invoice_item_id") REFERENCES "invoice_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_share" ADD CONSTRAINT "doctor_share_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
