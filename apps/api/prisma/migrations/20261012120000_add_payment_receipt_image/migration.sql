-- Kassir to'lovni qabul qilgach rasmga olib joylagan chek surati.

ALTER TABLE "payments" ADD COLUMN "receipt_image" BYTEA;
ALTER TABLE "payments" ADD COLUMN "receipt_image_key" TEXT;
ALTER TABLE "payments" ADD COLUMN "receipt_mime_type" TEXT;
