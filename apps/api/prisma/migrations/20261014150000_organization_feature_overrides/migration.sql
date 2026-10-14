-- Bog'cha uchun funksiyalarni qo'lda yoqish/o'chirish (tarifdagi qiymatni bekor qiladi).
-- Mavjud bog'chalar uchun bo'sh obyekt — ya'ni ular tarifga ko'ra ishlashda davom etadi.
ALTER TABLE "organizations" ADD COLUMN "feature_overrides" JSONB NOT NULL DEFAULT '{}';
