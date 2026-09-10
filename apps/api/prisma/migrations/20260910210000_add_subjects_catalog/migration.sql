-- CreateTable
CREATE TABLE "subjects" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subjects_organization_id_idx" ON "subjects"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_organization_id_name_key" ON "subjects"("organization_id", "name");

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Mavjud har bir tashkilotga odatiy fanlar to'plami beriladi (avval frontendda
-- qattiq yozilgan ro'yxat). Yangi tashkilot ochilganda ham xuddi shu ro'yxat
-- OrganizationsService orqali yaratiladi (default-subjects.ts).
INSERT INTO "subjects" ("id", "organization_id", "name")
SELECT gen_random_uuid()::text, o."id", s."name"
FROM "organizations" o
CROSS JOIN (VALUES
  ('Ingliz tili'),
  ('Arab tili'),
  ('Rus tili'),
  ('Mental arifmetika'),
  ('Logopediya'),
  ('Gimnastika'),
  ('Karate'),
  ('Shaxmat'),
  ('Xoreografiya')
) AS s("name")
ON CONFLICT ("organization_id", "name") DO NOTHING;
