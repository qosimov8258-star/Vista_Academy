-- Avvalgi migratsiya (20260912010000_kundalik_hisobotni_ochirish) "daily_reports"
-- jadvalini o'chirgan edi, lekin main'da ota-ona kabineti va admin bosh
-- sahifasi hali shu jadvalga tayanadi — shuning uchun uni qaytarib
-- tiklaymiz (asl 20260906063000_daily_reports_development migratsiyasidagi
-- ta'rif bilan bir xil).

-- CreateEnum
CREATE TYPE "EatingQuality" AS ENUM ('GOOD', 'AVERAGE', 'POOR');

-- CreateEnum
CREATE TYPE "MoodStatus" AS ENUM ('HAPPY', 'NEUTRAL', 'UPSET');

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

-- CreateIndex
CREATE INDEX "daily_reports_branch_id_date_idx" ON "daily_reports"("branch_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_reports_child_id_date_key" ON "daily_reports"("child_id", "date");

-- AddForeignKey
ALTER TABLE "daily_reports" ADD CONSTRAINT "daily_reports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_reports" ADD CONSTRAINT "daily_reports_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_reports" ADD CONSTRAINT "daily_reports_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;
