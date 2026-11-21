-- Til hisobga bog'lanadi: avval faqat brauzer cookie'sida turardi, shuning
-- uchun bitta brauzerdagi hamma hisob bir xil tilda ochilardi.
-- Null — hali tanlanmagan; mavjud ma'lumotga tegilmaydi.
ALTER TABLE "tenant_users" ADD COLUMN IF NOT EXISTS "locale" TEXT;
ALTER TABLE "guardians" ADD COLUMN IF NOT EXISTS "locale" TEXT;
