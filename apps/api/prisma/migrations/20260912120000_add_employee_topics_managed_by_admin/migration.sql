-- AlterTable
ALTER TABLE "employees" ADD COLUMN "topics_managed_by_admin" BOOLEAN NOT NULL DEFAULT false;

-- Oldingi (saqlanmaydigan) xatti-harakatni saqlab qolish uchun: allaqachon
-- mavzusi bor xodimlarda bu bo'lim ochiq turgan, shuning uchun ularda
-- yoqilgan holatga o'tkazamiz.
UPDATE "employees"
SET "topics_managed_by_admin" = true
WHERE "id" IN (SELECT DISTINCT "employee_id" FROM "employee_topics");
