-- CreateEnum
CREATE TYPE "EatingQuality" AS ENUM ('GOOD', 'AVERAGE', 'POOR');

-- CreateEnum
CREATE TYPE "MoodStatus" AS ENUM ('HAPPY', 'NEUTRAL', 'UPSET');

-- CreateEnum
CREATE TYPE "DevelopmentRating" AS ENUM ('BELOW_EXPECTED', 'ON_TRACK', 'ABOVE_EXPECTED');

-- CreateTable
CREATE TABLE "daily_reports" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "eating_quality" "EatingQuality",
    "sleep_minutes" INTEGER,
    "mood" "MoodStatus",
    "toilet_notes" TEXT,
    "activity_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "development_assessments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "speech_rating" "DevelopmentRating",
    "motor_rating" "DevelopmentRating",
    "social_rating" "DevelopmentRating",
    "cognitive_rating" "DevelopmentRating",
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "development_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_reports_branch_id_date_idx" ON "daily_reports"("branch_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_reports_child_id_date_key" ON "daily_reports"("child_id", "date");

-- CreateIndex
CREATE INDEX "development_assessments_branch_id_period_idx" ON "development_assessments"("branch_id", "period");

-- CreateIndex
CREATE UNIQUE INDEX "development_assessments_child_id_period_key" ON "development_assessments"("child_id", "period");

-- AddForeignKey
ALTER TABLE "daily_reports" ADD CONSTRAINT "daily_reports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_reports" ADD CONSTRAINT "daily_reports_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_reports" ADD CONSTRAINT "daily_reports_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "development_assessments" ADD CONSTRAINT "development_assessments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "development_assessments" ADD CONSTRAINT "development_assessments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "development_assessments" ADD CONSTRAINT "development_assessments_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;
