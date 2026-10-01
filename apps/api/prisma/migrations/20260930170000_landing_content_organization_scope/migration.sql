-- Lending kontenti (jadval, taomlar, o'qituvchilar, matnli bloklar, guruhlar)
-- endi har bir tashkilotga tegishli — ilgari bitta umumiy to'plam edi.
-- Mavjud qatorlar productionda "vista-academy"ga tegishli — shunga backfill
-- qilinadi. Agar shu muhitda "vista-academy" topilmasa (masalan boshqa slug
-- bilan sinalgan lokal baza), eng eski tashkilotga backfill qilinadi — bo'sh
-- organization_id bilan keyingi NOT NULL bosqichida bazani buzmaslik uchun.

-- ========== landing_schedule_items ==========
ALTER TABLE "landing_schedule_items" ADD COLUMN "organization_id" TEXT;

UPDATE "landing_schedule_items" SET "organization_id" = COALESCE(
  (SELECT id FROM "organizations" WHERE "slug" = 'vista-academy' LIMIT 1),
  (SELECT id FROM "organizations" ORDER BY "created_at" ASC LIMIT 1)
) WHERE "organization_id" IS NULL;

ALTER TABLE "landing_schedule_items" ALTER COLUMN "organization_id" SET NOT NULL;

CREATE INDEX "landing_schedule_items_organization_id_idx" ON "landing_schedule_items"("organization_id");

ALTER TABLE "landing_schedule_items" ADD CONSTRAINT "landing_schedule_items_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ========== landing_meals ==========
ALTER TABLE "landing_meals" ADD COLUMN "organization_id" TEXT;

UPDATE "landing_meals" SET "organization_id" = COALESCE(
  (SELECT id FROM "organizations" WHERE "slug" = 'vista-academy' LIMIT 1),
  (SELECT id FROM "organizations" ORDER BY "created_at" ASC LIMIT 1)
) WHERE "organization_id" IS NULL;

ALTER TABLE "landing_meals" ALTER COLUMN "organization_id" SET NOT NULL;

CREATE INDEX "landing_meals_organization_id_idx" ON "landing_meals"("organization_id");

ALTER TABLE "landing_meals" ADD CONSTRAINT "landing_meals_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ========== landing_teachers ==========
ALTER TABLE "landing_teachers" ADD COLUMN "organization_id" TEXT;

UPDATE "landing_teachers" SET "organization_id" = COALESCE(
  (SELECT id FROM "organizations" WHERE "slug" = 'vista-academy' LIMIT 1),
  (SELECT id FROM "organizations" ORDER BY "created_at" ASC LIMIT 1)
) WHERE "organization_id" IS NULL;

ALTER TABLE "landing_teachers" ALTER COLUMN "organization_id" SET NOT NULL;

CREATE INDEX "landing_teachers_organization_id_idx" ON "landing_teachers"("organization_id");

ALTER TABLE "landing_teachers" ADD CONSTRAINT "landing_teachers_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ========== landing_content_blocks (key: global unique -> composite unique) ==========
ALTER TABLE "landing_content_blocks" ADD COLUMN "organization_id" TEXT;

UPDATE "landing_content_blocks" SET "organization_id" = COALESCE(
  (SELECT id FROM "organizations" WHERE "slug" = 'vista-academy' LIMIT 1),
  (SELECT id FROM "organizations" ORDER BY "created_at" ASC LIMIT 1)
) WHERE "organization_id" IS NULL;

ALTER TABLE "landing_content_blocks" ALTER COLUMN "organization_id" SET NOT NULL;

DROP INDEX "landing_content_blocks_key_key";

CREATE UNIQUE INDEX "landing_content_blocks_organization_id_key_key" ON "landing_content_blocks"("organization_id", "key");

CREATE INDEX "landing_content_blocks_organization_id_idx" ON "landing_content_blocks"("organization_id");

ALTER TABLE "landing_content_blocks" ADD CONSTRAINT "landing_content_blocks_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ========== landing_groups (slug: global unique -> composite unique) ==========
ALTER TABLE "landing_groups" ADD COLUMN "organization_id" TEXT;

UPDATE "landing_groups" SET "organization_id" = COALESCE(
  (SELECT id FROM "organizations" WHERE "slug" = 'vista-academy' LIMIT 1),
  (SELECT id FROM "organizations" ORDER BY "created_at" ASC LIMIT 1)
) WHERE "organization_id" IS NULL;

ALTER TABLE "landing_groups" ALTER COLUMN "organization_id" SET NOT NULL;

DROP INDEX "landing_groups_slug_key";

CREATE UNIQUE INDEX "landing_groups_organization_id_slug_key" ON "landing_groups"("organization_id", "slug");

CREATE INDEX "landing_groups_organization_id_idx" ON "landing_groups"("organization_id");

ALTER TABLE "landing_groups" ADD CONSTRAINT "landing_groups_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
