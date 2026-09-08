-- Bolaning qisqa, og'zaki ishlatiladigan raqami ("id12345").
-- UUID ichki identifikator bo'lib qolaveradi; bu raqam xodimlar va ota-onalar
-- telefonda aytadigan qiymat, shuning uchun tashkilot ichida unikal.
ALTER TABLE "children" ADD COLUMN "public_id" INTEGER;

-- Mavjud yozuvlarga raqam beriladi: har tashkilot ichida 10000 dan boshlab,
-- kimga qaysi raqam tushishi tasodifiy (yaratilish tartibi bilinmasligi uchun).
WITH numbered AS (
  SELECT id,
         10000 + (ROW_NUMBER() OVER (PARTITION BY organization_id ORDER BY random()) - 1)::int AS assigned
  FROM "children"
)
UPDATE "children" c
SET "public_id" = n.assigned
FROM numbered n
WHERE c.id = n.id;

ALTER TABLE "children" ALTER COLUMN "public_id" SET NOT NULL;

CREATE UNIQUE INDEX "children_organization_id_public_id_key"
  ON "children"("organization_id", "public_id");
