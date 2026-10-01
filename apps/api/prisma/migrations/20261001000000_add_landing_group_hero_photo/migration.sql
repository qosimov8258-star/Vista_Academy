-- Guruhning o'z sahifasidagi katta (hero) rasmi uchun alohida ustun —
-- "photo_path" (bosh sahifa va ro'yxatdagi kartochka rasmi) dan mustaqil,
-- shu sabab ikkisi endi bir-biriga ta'sir qilmaydi.
ALTER TABLE "landing_groups" ADD COLUMN "hero_photo_path" TEXT;
