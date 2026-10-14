-- Funksiyalarni alohida panel (rol) uchun cheklash: {"TEACHER": {"crm": false}}.
-- Mavjud bog'chalar uchun bo'sh obyekt — hech narsa o'zgarmaydi.
ALTER TABLE "organizations" ADD COLUMN "panel_feature_overrides" JSONB NOT NULL DEFAULT '{}';
