-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- AlterTable: bolaning ismi va familiyasi alohida yoziladi
ALTER TABLE "children" ADD COLUMN "first_name" TEXT;
ALTER TABLE "children" ADD COLUMN "last_name" TEXT;

-- Jins eski yozuvlar uchun noma'lum bo'lib qoladi (NULL), yangi bola
-- qo'shilganda esa majburiy — buni DTO tekshiradi.
ALTER TABLE "children" ADD COLUMN "gender" "Gender";

-- Eski yozuvlarni to'ldirish. full_name qanday tartibda kiritilgani
-- ma'lum emas, shuning uchun birinchi so'z familiya deb olinadi (yangi
-- konvensiya "Familiya Ism") va full_name o'zgarishsiz qoldiriladi —
-- shu tufayli mavjud bolalarning ekrandagi nomi o'zgarmaydi.
UPDATE "children" SET
  "last_name" = split_part(trim("full_name"), ' ', 1),
  "first_name" = NULLIF(trim(substr(trim("full_name"), length(split_part(trim("full_name"), ' ', 1)) + 1)), '')
WHERE "first_name" IS NULL;

-- Familiyasiz yozuv bo'lmasligi kerak, ismi esa bo'sh qolishi mumkin edi
UPDATE "children" SET "first_name" = '' WHERE "first_name" IS NULL;

ALTER TABLE "children" ALTER COLUMN "first_name" SET NOT NULL;
ALTER TABLE "children" ALTER COLUMN "last_name" SET NOT NULL;
