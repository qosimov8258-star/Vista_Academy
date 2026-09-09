-- AlterTable: filial belgisi (logotip). tenant_users dagi avatar bilan bir xil
-- yondashuv — fayl xotirasi sozlanmagani uchun kichik rasm bevosita bazada
-- saqlanadi; avatar_updated_at brauzer keshini yangilash uchun ishlatiladi.
ALTER TABLE "branches" ADD COLUMN "avatar" BYTEA;
ALTER TABLE "branches" ADD COLUMN "avatar_mime_type" TEXT;
ALTER TABLE "branches" ADD COLUMN "avatar_updated_at" TIMESTAMP(3);
