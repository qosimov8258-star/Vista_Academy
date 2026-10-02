-- Lending sahifa kontentiga rus/ingliz tarjima ustunlari qo'shiladi.
-- Hammasi NULL bo'lishi mumkin: bo'sh bo'lsa, API mavjud (uz) ustunga qaytadi.

-- AlterTable: landing_schedule_items
ALTER TABLE "landing_schedule_items"
  ADD COLUMN "title_ru" TEXT,
  ADD COLUMN "title_en" TEXT;

-- AlterTable: landing_meals
ALTER TABLE "landing_meals"
  ADD COLUMN "title_ru" TEXT,
  ADD COLUMN "title_en" TEXT,
  ADD COLUMN "description_ru" TEXT,
  ADD COLUMN "description_en" TEXT;

-- AlterTable: landing_teachers
ALTER TABLE "landing_teachers"
  ADD COLUMN "role_ru" TEXT,
  ADD COLUMN "role_en" TEXT,
  ADD COLUMN "bio_ru" TEXT,
  ADD COLUMN "bio_en" TEXT,
  ADD COLUMN "experience_ru" TEXT,
  ADD COLUMN "experience_en" TEXT;

-- AlterTable: landing_content_blocks
ALTER TABLE "landing_content_blocks"
  ADD COLUMN "title_ru" TEXT,
  ADD COLUMN "title_en" TEXT,
  ADD COLUMN "body_ru" TEXT,
  ADD COLUMN "body_en" TEXT;

-- AlterTable: landing_group_students
ALTER TABLE "landing_group_students"
  ADD COLUMN "bio_ru" TEXT,
  ADD COLUMN "bio_en" TEXT;
