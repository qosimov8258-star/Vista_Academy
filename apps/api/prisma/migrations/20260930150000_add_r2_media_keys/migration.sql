-- R2 migratsiyasi: eski Bytes ustunlari yonida "*_key" ustunlari qo'shiladi.
-- Yangi yuklamalar Cloudflare R2'da saqlanadi, bazada faqat obyekt kaliti
-- turadi. Eski qatorlar o'zgarishsiz qoladi — orqaga ko'chirish (backfill)
-- shu migratsiya doirasiga kirmaydi. Uchta ustun (menu_photos.image,
-- payment_receipts.image, diary_media.data) ilgari har doim to'ldirilgani
-- uchun NOT NULL edi; yangi R2'ga yozilgan qatorlarda bo'sh qolishi mumkin
-- bo'lgani uchun endi ixtiyoriy qilinadi.

-- AlterTable
ALTER TABLE "tenant_users" ADD COLUMN "avatar_key" TEXT;

-- AlterTable
ALTER TABLE "branches" ADD COLUMN "avatar_key" TEXT;

-- AlterTable
ALTER TABLE "children" ADD COLUMN "avatar_key" TEXT;

-- AlterTable
ALTER TABLE "employees" ADD COLUMN "avatar_key" TEXT;

-- AlterTable
ALTER TABLE "menu_photos" ADD COLUMN "image_key" TEXT,
ALTER COLUMN "image" DROP NOT NULL;

-- AlterTable
ALTER TABLE "products" ADD COLUMN "image1_key" TEXT,
ADD COLUMN "image2_key" TEXT,
ADD COLUMN "image3_key" TEXT;

-- AlterTable
ALTER TABLE "payment_receipts" ADD COLUMN "image_key" TEXT,
ALTER COLUMN "image" DROP NOT NULL;

-- AlterTable
ALTER TABLE "diary_media" ADD COLUMN "data_key" TEXT,
ADD COLUMN "poster_key" TEXT,
ALTER COLUMN "data" DROP NOT NULL;
