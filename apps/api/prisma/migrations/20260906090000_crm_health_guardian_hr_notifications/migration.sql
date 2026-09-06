-- AlterEnum: children can now be QUARANTINED
ALTER TYPE "ChildStatus" ADD VALUE 'QUARANTINED';

-- AlterTable: children quarantine fields
ALTER TABLE "children" ADD COLUMN "quarantine_until" DATE;
ALTER TABLE "children" ADD COLUMN "quarantine_reason" TEXT;

-- ===================== CRM / Navbat =====================

CREATE TYPE "LeadStage" AS ENUM ('NEW', 'TRIAL_DAY_SCHEDULED', 'CONTRACT', 'WON', 'LOST');
CREATE TYPE "LeadSource" AS ENUM ('WEBSITE', 'REFERRAL', 'SOCIAL_MEDIA', 'WALK_IN', 'OTHER');
CREATE TYPE "AgeGroup" AS ENUM ('AGE_1_2', 'AGE_2_3', 'AGE_3_4', 'AGE_4_5', 'AGE_5_6', 'AGE_6_7');
CREATE TYPE "LeadActivityType" AS ENUM ('CALL', 'MESSAGE', 'MEETING', 'TRIAL_DAY', 'STAGE_CHANGE', 'NOTE');

CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "child_full_name" TEXT NOT NULL,
    "child_birth_date" TIMESTAMP(3),
    "age_group" "AgeGroup",
    "parent_name" TEXT NOT NULL,
    "parent_phone" TEXT NOT NULL,
    "source" "LeadSource" NOT NULL DEFAULT 'OTHER',
    "stage" "LeadStage" NOT NULL DEFAULT 'NEW',
    "lost_reason" TEXT,
    "assigned_to_user_id" TEXT,
    "converted_child_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "leads_converted_child_id_key" ON "leads"("converted_child_id");
CREATE INDEX "leads_organization_id_branch_id_stage_idx" ON "leads"("organization_id", "branch_id", "stage");

CREATE TABLE "lead_activities" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "type" "LeadActivityType" NOT NULL,
    "note" TEXT,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_activities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lead_activities_lead_id_created_at_idx" ON "lead_activities"("lead_id", "created_at");

ALTER TABLE "leads" ADD CONSTRAINT "leads_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leads" ADD CONSTRAINT "leads_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leads" ADD CONSTRAINT "leads_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "tenant_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "leads" ADD CONSTRAINT "leads_converted_child_id_fkey" FOREIGN KEY ("converted_child_id") REFERENCES "children"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "tenant_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ===================== Sog'liq / Tibbiyot =====================

CREATE TYPE "BloodType" AS ENUM ('A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE', 'UNKNOWN');
CREATE TYPE "VaccinationStatus" AS ENUM ('SCHEDULED', 'DONE', 'MISSED');

CREATE TABLE "health_profiles" (
    "id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "blood_type" "BloodType",
    "chronic_conditions" TEXT,
    "allergies" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "health_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "health_profiles_child_id_key" ON "health_profiles"("child_id");

CREATE TABLE "vaccinations" (
    "id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scheduled_date" DATE NOT NULL,
    "done_date" DATE,
    "status" "VaccinationStatus" NOT NULL DEFAULT 'SCHEDULED',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vaccinations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "vaccinations_branch_id_scheduled_date_idx" ON "vaccinations"("branch_id", "scheduled_date");

CREATE TABLE "medication_logs" (
    "id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "medication_name" TEXT NOT NULL,
    "dose" TEXT NOT NULL,
    "given_at" TIMESTAMP(3) NOT NULL,
    "given_by_user_id" TEXT,
    "parent_authorized" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medication_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "medication_logs_child_id_given_at_idx" ON "medication_logs"("child_id", "given_at");

ALTER TABLE "health_profiles" ADD CONSTRAINT "health_profiles_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "health_profiles" ADD CONSTRAINT "health_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "health_profiles" ADD CONSTRAINT "health_profiles_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "vaccinations" ADD CONSTRAINT "vaccinations_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vaccinations" ADD CONSTRAINT "vaccinations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vaccinations" ADD CONSTRAINT "vaccinations_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "medication_logs" ADD CONSTRAINT "medication_logs_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "medication_logs" ADD CONSTRAINT "medication_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "medication_logs" ADD CONSTRAINT "medication_logs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "medication_logs" ADD CONSTRAINT "medication_logs_given_by_user_id_fkey" FOREIGN KEY ("given_by_user_id") REFERENCES "tenant_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ===================== Guardian =====================

CREATE TYPE "GuardianRelation" AS ENUM ('FATHER', 'MOTHER', 'GRANDPARENT', 'OTHER');

CREATE TABLE "guardians" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guardians_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "guardians_organization_id_idx" ON "guardians"("organization_id");

CREATE TABLE "child_guardians" (
    "id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "guardian_id" TEXT NOT NULL,
    "relation" "GuardianRelation" NOT NULL DEFAULT 'OTHER',
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "can_pickup" BOOLEAN NOT NULL DEFAULT true,
    "can_view_finance" BOOLEAN NOT NULL DEFAULT false,
    "can_receive_notifications" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "child_guardians_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "child_guardians_child_id_guardian_id_key" ON "child_guardians"("child_id", "guardian_id");
CREATE INDEX "child_guardians_guardian_id_idx" ON "child_guardians"("guardian_id");

ALTER TABLE "guardians" ADD CONSTRAINT "guardians_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "child_guardians" ADD CONSTRAINT "child_guardians_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "child_guardians" ADD CONSTRAINT "child_guardians_guardian_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "guardians"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ===================== HR / Payroll =====================

CREATE TYPE "SalaryRuleType" AS ENUM ('FIXED', 'PER_HOUR', 'PER_CHILD');
CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'PAID');

CREATE TABLE "salary_schemes" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "rule_type" "SalaryRuleType" NOT NULL DEFAULT 'FIXED',
    "fixed_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "rate" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_schemes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "salary_schemes_employee_id_key" ON "salary_schemes"("employee_id");

CREATE TABLE "shifts" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "hours" DECIMAL(5,2) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "shifts_employee_id_date_key" ON "shifts"("employee_id", "date");
CREATE INDEX "shifts_branch_id_date_idx" ON "shifts"("branch_id", "date");

CREATE TABLE "payroll_entries" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "base_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "bonus_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "penalty_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
    "paid_at" TIMESTAMP(3),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payroll_entries_employee_id_period_key" ON "payroll_entries"("employee_id", "period");
CREATE INDEX "payroll_entries_branch_id_period_idx" ON "payroll_entries"("branch_id", "period");

ALTER TABLE "salary_schemes" ADD CONSTRAINT "salary_schemes_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ===================== Bildirishnomalar =====================

CREATE TYPE "NotificationEventType" AS ENUM ('CHILD_ABSENT', 'DAILY_REPORT_READY', 'PAYMENT_DUE', 'PAYMENT_OVERDUE', 'VACCINATION_DUE', 'QUARANTINE_ALERT', 'LEAD_FOLLOW_UP', 'CUSTOM');
CREATE TYPE "NotificationChannel" AS ENUM ('SMS', 'TELEGRAM', 'EMAIL', 'PHONE_CALL', 'IN_APP');
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT');

CREATE TABLE "notification_logs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "child_id" TEXT,
    "event_type" "NotificationEventType" NOT NULL,
    "channel" "NotificationChannel",
    "recipient_name" TEXT NOT NULL,
    "recipient_contact" TEXT,
    "message" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "sent_by_user_id" TEXT,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notification_logs_branch_id_status_created_at_idx" ON "notification_logs"("branch_id", "status", "created_at");

ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_sent_by_user_id_fkey" FOREIGN KEY ("sent_by_user_id") REFERENCES "tenant_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
