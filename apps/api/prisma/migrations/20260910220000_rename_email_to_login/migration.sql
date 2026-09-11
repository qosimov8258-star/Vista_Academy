-- Kirish endi email o'rniga login bilan bo'ladi (email format talab qilinmaydi).
-- Ustun nomi o'zgaradi, qiymatlar saqlanib qoladi — hech kim hisobidan chiqib qolmaydi
-- (eski email qiymati keyingi kirishda login sifatida ishlatiladi).

ALTER TABLE "platform_users" RENAME COLUMN "email" TO "login";
ALTER INDEX "platform_users_email_key" RENAME TO "platform_users_login_key";

ALTER TABLE "tenant_users" RENAME COLUMN "email" TO "login";
ALTER INDEX "tenant_users_organization_id_email_key" RENAME TO "tenant_users_organization_id_login_key";
