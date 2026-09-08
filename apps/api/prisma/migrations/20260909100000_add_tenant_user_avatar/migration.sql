-- AlterTable: profil rasmi. Fayl xotirasi sozlanmagani uchun kichik avatar
-- bevosita bazada saqlanadi; avatar_updated_at brauzer keshini yangilash
-- uchun ishlatiladi.
ALTER TABLE "tenant_users" ADD COLUMN "avatar" BYTEA;
ALTER TABLE "tenant_users" ADD COLUMN "avatar_mime_type" TEXT;
ALTER TABLE "tenant_users" ADD COLUMN "avatar_updated_at" TIMESTAMP(3);
