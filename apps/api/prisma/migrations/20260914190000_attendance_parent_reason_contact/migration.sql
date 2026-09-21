-- Ota-ona kelmagan kun uchun sabab yozadi, tarbiyachi esa sabab bo'lmasa
-- "Aloqaga chiqish" deb belgilaydi (davomat sahifasidagi "Kelmaganlar" tabi).
ALTER TABLE "attendances" ADD COLUMN "parent_reason" TEXT;
ALTER TABLE "attendances" ADD COLUMN "contact_requested_at" TIMESTAMP(3);
