-- "Foydali" bo'limi: tarbiyachi yuklaydigan she'r/maqol/ertak, ota-ona
-- kabinetida o'qish/yodlash uchun ko'rinadi.

-- CreateEnum
CREATE TYPE "UsefulStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "poems" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "group_id" TEXT,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "age_from" INTEGER NOT NULL DEFAULT 3,
    "age_to" INTEGER NOT NULL DEFAULT 6,
    "stanzas" JSONB NOT NULL,
    "status" "UsefulStatus" NOT NULL DEFAULT 'PUBLISHED',
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "poems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proverbs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "group_id" TEXT,
    "text" TEXT NOT NULL,
    "meaning" TEXT NOT NULL,
    "status" "UsefulStatus" NOT NULL DEFAULT 'PUBLISHED',
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "proverbs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tales" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "group_id" TEXT,
    "title" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL,
    "paragraphs" JSONB NOT NULL,
    "moral" TEXT NOT NULL,
    "questions" JSONB NOT NULL,
    "cover" TEXT NOT NULL DEFAULT 'tun',
    "age_from" INTEGER NOT NULL DEFAULT 3,
    "age_to" INTEGER NOT NULL DEFAULT 7,
    "status" "UsefulStatus" NOT NULL DEFAULT 'PUBLISHED',
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "tales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "poems_branch_id_status_idx" ON "poems"("branch_id", "status");

-- CreateIndex
CREATE INDEX "proverbs_branch_id_status_idx" ON "proverbs"("branch_id", "status");

-- CreateIndex
CREATE INDEX "tales_branch_id_status_idx" ON "tales"("branch_id", "status");

-- AddForeignKey
ALTER TABLE "poems" ADD CONSTRAINT "poems_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poems" ADD CONSTRAINT "poems_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poems" ADD CONSTRAINT "poems_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poems" ADD CONSTRAINT "poems_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "tenant_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proverbs" ADD CONSTRAINT "proverbs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proverbs" ADD CONSTRAINT "proverbs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proverbs" ADD CONSTRAINT "proverbs_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proverbs" ADD CONSTRAINT "proverbs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "tenant_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tales" ADD CONSTRAINT "tales_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tales" ADD CONSTRAINT "tales_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tales" ADD CONSTRAINT "tales_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tales" ADD CONSTRAINT "tales_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "tenant_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
