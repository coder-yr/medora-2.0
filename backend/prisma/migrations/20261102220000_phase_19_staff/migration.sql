-- CreateTable
CREATE TABLE "staff_designation" (
    "id" BIGSERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "description" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "staff_designation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_profile" (
    "id" BIGSERIAL NOT NULL,
    "employee_number" VARCHAR(50) NOT NULL,
    "user_id" BIGINT,
    "first_name" VARCHAR(50) NOT NULL,
    "last_name" VARCHAR(50) NOT NULL,
    "display_name" VARCHAR(100) NOT NULL,
    "gender" VARCHAR(20),
    "date_of_birth" DATE,
    "national_id" VARCHAR(50),
    "email" VARCHAR(100),
    "phone" VARCHAR(50),
    "alternate_phone" VARCHAR(50),
    "address" VARCHAR(255),
    "emergency_contact_name" VARCHAR(100),
    "emergency_contact_phone" VARCHAR(50),
    "joining_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "employment_type" VARCHAR(50) NOT NULL DEFAULT 'FULL_TIME',
    "employment_status" VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    "department_id" BIGINT,
    "designation_id" BIGINT,
    "branch_id" BIGINT,
    "reporting_manager_id" BIGINT,
    "profile_image" VARCHAR(255),
    "qualifications" TEXT,
    "offboarded_at" TIMESTAMPTZ,
    "offboarding_reason" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "staff_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_department_assignment" (
    "id" BIGSERIAL NOT NULL,
    "staff_profile_id" BIGINT NOT NULL,
    "department_id" BIGINT NOT NULL,
    "branch_id" BIGINT,
    "is_primary" BOOLEAN NOT NULL DEFAULT true,
    "effective_start" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_end" DATE,
    "reason" VARCHAR(255),
    "assigned_by" BIGINT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ,

    CONSTRAINT "staff_department_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_employment_history" (
    "id" BIGSERIAL NOT NULL,
    "staff_profile_id" BIGINT NOT NULL,
    "event_type" VARCHAR(50) NOT NULL,
    "previous_value" TEXT,
    "new_value" TEXT,
    "effective_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comments" TEXT,
    "recorded_by" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_employment_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nurse" (
    "id" BIGSERIAL NOT NULL,
    "img_url" VARCHAR(100) NOT NULL DEFAULT '',
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(100) NOT NULL DEFAULT '',
    "address" VARCHAR(100) NOT NULL DEFAULT '',
    "phone" VARCHAR(100) NOT NULL DEFAULT '',
    "x" VARCHAR(100) NOT NULL DEFAULT '',
    "y" VARCHAR(100) NOT NULL DEFAULT '',
    "z" VARCHAR(100) NOT NULL DEFAULT '',
    "ion_user_id" VARCHAR(100) NOT NULL DEFAULT '',

    CONSTRAINT "nurse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmacist" (
    "id" BIGSERIAL NOT NULL,
    "img_url" VARCHAR(100) NOT NULL DEFAULT '',
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(100) NOT NULL DEFAULT '',
    "address" VARCHAR(100) NOT NULL DEFAULT '',
    "phone" VARCHAR(100) NOT NULL DEFAULT '',
    "x" VARCHAR(100) NOT NULL DEFAULT '',
    "y" VARCHAR(100) NOT NULL DEFAULT '',
    "z" VARCHAR(100) NOT NULL DEFAULT '',
    "ion_user_id" VARCHAR(100) NOT NULL DEFAULT '',

    CONSTRAINT "pharmacist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "laboratorist" (
    "id" BIGSERIAL NOT NULL,
    "img_url" VARCHAR(100) NOT NULL DEFAULT '',
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(100) NOT NULL DEFAULT '',
    "address" VARCHAR(100) NOT NULL DEFAULT '',
    "phone" VARCHAR(100) NOT NULL DEFAULT '',
    "x" VARCHAR(100) NOT NULL DEFAULT '',
    "y" VARCHAR(100) NOT NULL DEFAULT '',
    "z" VARCHAR(100) NOT NULL DEFAULT '',
    "ion_user_id" VARCHAR(100) NOT NULL DEFAULT '',

    CONSTRAINT "laboratorist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receptionist" (
    "id" BIGSERIAL NOT NULL,
    "img_url" VARCHAR(100) NOT NULL DEFAULT '',
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(100) NOT NULL DEFAULT '',
    "address" VARCHAR(100) NOT NULL DEFAULT '',
    "phone" VARCHAR(100) NOT NULL DEFAULT '',
    "x" VARCHAR(100) NOT NULL DEFAULT '',
    "y" VARCHAR(100) NOT NULL DEFAULT '',
    "z" VARCHAR(100) NOT NULL DEFAULT '',
    "ion_user_id" VARCHAR(100) NOT NULL DEFAULT '',

    CONSTRAINT "receptionist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accountant" (
    "id" BIGSERIAL NOT NULL,
    "img_url" VARCHAR(100) NOT NULL DEFAULT '',
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(100) NOT NULL DEFAULT '',
    "address" VARCHAR(100) NOT NULL DEFAULT '',
    "phone" VARCHAR(100) NOT NULL DEFAULT '',
    "x" VARCHAR(100) NOT NULL DEFAULT '',
    "y" VARCHAR(100) NOT NULL DEFAULT '',
    "z" VARCHAR(100) NOT NULL DEFAULT '',
    "ion_user_id" VARCHAR(100) NOT NULL DEFAULT '',

    CONSTRAINT "accountant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_designation_code_key" ON "staff_designation"("code");

-- CreateIndex
CREATE INDEX "staff_designation_category_idx" ON "staff_designation"("category");

-- CreateIndex
CREATE INDEX "staff_designation_is_active_idx" ON "staff_designation"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "staff_profile_employee_number_key" ON "staff_profile"("employee_number");

-- CreateIndex
CREATE UNIQUE INDEX "staff_profile_user_id_key" ON "staff_profile"("user_id");

-- CreateIndex
CREATE INDEX "staff_profile_employee_number_idx" ON "staff_profile"("employee_number");

-- CreateIndex
CREATE INDEX "staff_profile_department_id_idx" ON "staff_profile"("department_id");

-- CreateIndex
CREATE INDEX "staff_profile_designation_id_idx" ON "staff_profile"("designation_id");

-- CreateIndex
CREATE INDEX "staff_profile_branch_id_idx" ON "staff_profile"("branch_id");

-- CreateIndex
CREATE INDEX "staff_profile_employment_status_idx" ON "staff_profile"("employment_status");

-- CreateIndex
CREATE INDEX "staff_profile_email_idx" ON "staff_profile"("email");

-- CreateIndex
CREATE INDEX "staff_profile_phone_idx" ON "staff_profile"("phone");

-- CreateIndex
CREATE INDEX "staff_department_assignment_staff_profile_id_idx" ON "staff_department_assignment"("staff_profile_id");

-- CreateIndex
CREATE INDEX "staff_department_assignment_department_id_idx" ON "staff_department_assignment"("department_id");

-- CreateIndex
CREATE INDEX "staff_department_assignment_is_primary_idx" ON "staff_department_assignment"("is_primary");

-- CreateIndex
CREATE INDEX "staff_employment_history_staff_profile_id_idx" ON "staff_employment_history"("staff_profile_id");

-- CreateIndex
CREATE INDEX "staff_employment_history_event_type_idx" ON "staff_employment_history"("event_type");

-- CreateIndex
CREATE INDEX "staff_employment_history_effective_date_idx" ON "staff_employment_history"("effective_date");

-- AddForeignKey
ALTER TABLE "staff_profile" ADD CONSTRAINT "staff_profile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_profile" ADD CONSTRAINT "staff_profile_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_profile" ADD CONSTRAINT "staff_profile_designation_id_fkey" FOREIGN KEY ("designation_id") REFERENCES "staff_designation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_profile" ADD CONSTRAINT "staff_profile_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "hospital_branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_profile" ADD CONSTRAINT "staff_profile_reporting_manager_id_fkey" FOREIGN KEY ("reporting_manager_id") REFERENCES "staff_profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_department_assignment" ADD CONSTRAINT "staff_department_assignment_staff_profile_id_fkey" FOREIGN KEY ("staff_profile_id") REFERENCES "staff_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_department_assignment" ADD CONSTRAINT "staff_department_assignment_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_department_assignment" ADD CONSTRAINT "staff_department_assignment_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "hospital_branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_department_assignment" ADD CONSTRAINT "staff_department_assignment_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_employment_history" ADD CONSTRAINT "staff_employment_history_staff_profile_id_fkey" FOREIGN KEY ("staff_profile_id") REFERENCES "staff_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_employment_history" ADD CONSTRAINT "staff_employment_history_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
