-- CreateEnum
CREATE TYPE "CoinTransactionSource" AS ENUM ('ATTENDANCE', 'WEEKLY_ASSESSMENT', 'MANUAL');

-- AlterTable
ALTER TABLE "coin_transactions" ADD COLUMN "source" "CoinTransactionSource" NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "attendances" ADD COLUMN "coin_transaction_id" TEXT;

-- CreateTable
CREATE TABLE "weekly_coin_assessments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "week_start" DATE NOT NULL,
    "poem_recited" BOOLEAN NOT NULL DEFAULT false,
    "coins_awarded" INTEGER NOT NULL,
    "coin_transaction_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weekly_coin_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_coin_assessment_answers" (
    "id" TEXT NOT NULL,
    "assessment_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "correct" BOOLEAN NOT NULL,

    CONSTRAINT "weekly_coin_assessment_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attendances_coin_transaction_id_key" ON "attendances"("coin_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_coin_assessments_coin_transaction_id_key" ON "weekly_coin_assessments"("coin_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_coin_assessments_child_id_week_start_key" ON "weekly_coin_assessments"("child_id", "week_start");

-- CreateIndex
CREATE INDEX "weekly_coin_assessments_organization_id_branch_id_idx" ON "weekly_coin_assessments"("organization_id", "branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_coin_assessment_answers_assessment_id_question_id_key" ON "weekly_coin_assessment_answers"("assessment_id", "question_id");

-- CreateIndex
CREATE INDEX "weekly_coin_assessment_answers_assessment_id_idx" ON "weekly_coin_assessment_answers"("assessment_id");

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_coin_transaction_id_fkey" FOREIGN KEY ("coin_transaction_id") REFERENCES "coin_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_coin_assessments" ADD CONSTRAINT "weekly_coin_assessments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_coin_assessments" ADD CONSTRAINT "weekly_coin_assessments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_coin_assessments" ADD CONSTRAINT "weekly_coin_assessments_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_coin_assessments" ADD CONSTRAINT "weekly_coin_assessments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_coin_assessments" ADD CONSTRAINT "weekly_coin_assessments_coin_transaction_id_fkey" FOREIGN KEY ("coin_transaction_id") REFERENCES "coin_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_coin_assessment_answers" ADD CONSTRAINT "weekly_coin_assessment_answers_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "weekly_coin_assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_coin_assessment_answers" ADD CONSTRAINT "weekly_coin_assessment_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "topic_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
