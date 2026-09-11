-- AlterTable: xodimning ismi va familiyasi alohida yoziladi, aloqa uchun telefon qo'shiladi
ALTER TABLE "employees" ADD COLUMN     "first_name" TEXT;
ALTER TABLE "employees" ADD COLUMN     "last_name" TEXT;
ALTER TABLE "employees" ADD COLUMN     "phone" TEXT;

-- Eski yozuvlarni to'ldirish. full_name qanday tartibda kiritilgani ma'lum
-- emas, shuning uchun birinchi so'z familiya deb olinadi (bolalardagi kabi
-- "Familiya Ism" konvensiyasi), full_name o'zgarishsiz qoladi.
UPDATE "employees" SET
  "last_name" = split_part(trim("full_name"), ' ', 1),
  "first_name" = NULLIF(trim(substr(trim("full_name"), length(split_part(trim("full_name"), ' ', 1)) + 1)), '')
WHERE "first_name" IS NULL;

-- Familiyasiz yozuv bo'lmasligi kerak, ismi esa bo'sh qolishi mumkin edi
UPDATE "employees" SET "first_name" = '' WHERE "first_name" IS NULL;

ALTER TABLE "employees" ALTER COLUMN "first_name" SET NOT NULL;
ALTER TABLE "employees" ALTER COLUMN "last_name" SET NOT NULL;

-- CreateTable
CREATE TABLE "positions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "positions_organization_id_idx" ON "positions"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "positions_organization_id_name_key" ON "positions"("organization_id", "name");

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Mavjud har bir tashkilotga odatiy lavozimlar to'plami beriladi. Yangi
-- tashkilot ochilganda ham xuddi shu ro'yxat OrganizationsService orqali
-- yaratiladi (bir joyda saqlanadigan ro'yxat: default-positions.ts).
INSERT INTO "positions" ("id", "organization_id", "name")
SELECT gen_random_uuid()::text, o."id", p."name"
FROM "organizations" o
CROSS JOIN (VALUES
  ('Fan o''qituvchisi'),
  ('Tarbiyachi'),
  ('Tarbiyachi yordamchisi'),
  ('Kassir'),
  ('Administrator'),
  ('Bosh oshpaz'),
  ('Oshpaz yordamchisi'),
  ('Idish yuvuchi')
) AS p("name")
ON CONFLICT ("organization_id", "name") DO NOTHING;
