-- Guruh kartochkasidagi rasm (photo_path) va guruh sahifasidagi bosh (hero)
-- rasm endi alohida: ikkinchisi uchun yangi ustun qo'shiladi.

ALTER TABLE "landing_groups" ADD COLUMN "cover_photo_path" TEXT;
