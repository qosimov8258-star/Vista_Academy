-- Oshpaz yuklaydigan taom suratlari (ota-ona kabinetida menyu ostida ko'rinadi)

-- CreateEnum
CREATE TYPE "MenuMeal" AS ENUM ('BREAKFAST', 'LUNCH', 'SNACK');

-- CreateTable
CREATE TABLE "menu_photos" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "meal" "MenuMeal" NOT NULL,
    "image" BYTEA NOT NULL,
    "mime_type" TEXT NOT NULL,
    "uploaded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "menu_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "menu_photos_branch_id_date_idx" ON "menu_photos"("branch_id", "date");

-- AddForeignKey
ALTER TABLE "menu_photos" ADD CONSTRAINT "menu_photos_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
