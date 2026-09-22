-- AlterTable
ALTER TABLE "landing_meals" ADD COLUMN     "weekday" "Weekday",
ADD COLUMN     "time" TEXT;

-- CreateIndex
CREATE INDEX "landing_meals_weekday_idx" ON "landing_meals"("weekday");
