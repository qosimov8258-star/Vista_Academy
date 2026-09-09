-- AlterTable: bola surati. branches va tenant_users dagi avatar bilan bir xil
-- yondashuv — kichraytirilgan rasm bevosita bazada saqlanadi;
-- avatar_updated_at brauzer keshini yangilash uchun ishlatiladi.
ALTER TABLE "children" ADD COLUMN "avatar" BYTEA;
ALTER TABLE "children" ADD COLUMN "avatar_mime_type" TEXT;
ALTER TABLE "children" ADD COLUMN "avatar_updated_at" TIMESTAMP(3);
