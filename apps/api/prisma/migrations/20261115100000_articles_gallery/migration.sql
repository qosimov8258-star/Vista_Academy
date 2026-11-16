-- Ota-onalar uchun maqolalar («Ota-onalarga eslatma») va bolalar ishlari galereyasi.
-- Maqolani admin/tarbiyachi yozadi; galereyani filialdagi hamma ota-onalar ko'radi va «Yoqdi» bosadi.
-- Faqat yangi jadvallar — mavjud ma'lumotga tegmaydi.

-- CreateEnum
CREATE TYPE "ArticleCategory" AS ENUM ('PSYCHOLOGY', 'DEVELOPMENT', 'HEALTH', 'NUTRITION', 'FAMILY', 'ADAPTATION', 'HOME_GAMES');

-- CreateTable
CREATE TABLE "articles" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "group_id" TEXT,
    "category" "ArticleCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "tips" JSONB NOT NULL DEFAULT '[]',
    "memo" TEXT,
    "cover" BYTEA,
    "cover_key" TEXT,
    "cover_mime_type" TEXT,
    "status" "UsefulStatus" NOT NULL DEFAULT 'PUBLISHED',
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gallery_items" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "title" TEXT,
    "image" BYTEA,
    "image_key" TEXT,
    "image_mime_type" TEXT NOT NULL,
    "likes_count" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "gallery_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gallery_likes" (
    "item_id" TEXT NOT NULL,
    "guardian_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gallery_likes_pkey" PRIMARY KEY ("item_id","guardian_id")
);

-- CreateIndex
CREATE INDEX "articles_branch_id_status_idx" ON "articles"("branch_id", "status");

-- CreateIndex
CREATE INDEX "gallery_items_branch_id_created_at_idx" ON "gallery_items"("branch_id", "created_at");

-- CreateIndex
CREATE INDEX "gallery_likes_guardian_id_idx" ON "gallery_likes"("guardian_id");

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "tenant_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gallery_items" ADD CONSTRAINT "gallery_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gallery_items" ADD CONSTRAINT "gallery_items_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gallery_items" ADD CONSTRAINT "gallery_items_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gallery_items" ADD CONSTRAINT "gallery_items_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "tenant_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gallery_likes" ADD CONSTRAINT "gallery_likes_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "gallery_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gallery_likes" ADD CONSTRAINT "gallery_likes_guardian_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "guardians"("id") ON DELETE CASCADE ON UPDATE CASCADE;

