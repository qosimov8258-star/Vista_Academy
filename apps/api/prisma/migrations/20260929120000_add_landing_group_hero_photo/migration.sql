-- Guruhning o'z sahifasidagi (landing-web /guruhlar/[slug]) katta rasmi uchun
-- bosh sahifa kartochkasi rasmidan (photo_path) alohida ustun.
-- Bo'sh qoldirilsa, frontend photo_path'ga qaytadi — mavjud guruhlar uchun
-- ko'rinish darhol o'zgarmaydi, faqat admin panelda alohida rasm tanlanganda ajraladi.
ALTER TABLE "landing_groups" ADD COLUMN "hero_photo_path" TEXT;
