-- «Xabar yuborish»: xabarga ixtiyoriy bitta rasm (matn tepasida ko'rinadi).
-- R2 yoqilgan bo'lsa — image_key, aks holda baytlar image ustunida.
-- Faqat bo'sh (NULL) ustunlar qo'shiladi — mavjud xabarlarga tegmaydi.

-- AlterTable
ALTER TABLE "broadcasts" ADD COLUMN "image" BYTEA,
ADD COLUMN "image_key" TEXT,
ADD COLUMN "image_mime_type" TEXT;
