-- Guruh rasmi (profil belgisi): bola suratidek R2 kaliti yoki bazadagi blob.
-- Faqat yangi bo'sh ustunlar — mavjud ma'lumotga tegmaydi.
ALTER TABLE "groups" ADD COLUMN     "avatar" BYTEA,
ADD COLUMN     "avatar_key" TEXT,
ADD COLUMN     "avatar_mime_type" TEXT,
ADD COLUMN     "avatar_updated_at" TIMESTAMP(3);
