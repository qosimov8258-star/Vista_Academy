-- Karta/o'tkazma/Click bilan to'langan xarajatning chek surati (to'lovlardagi kabi).
ALTER TABLE "expenses" ADD COLUMN "receipt_image" BYTEA;
ALTER TABLE "expenses" ADD COLUMN "receipt_image_key" TEXT;
ALTER TABLE "expenses" ADD COLUMN "receipt_mime_type" TEXT;
