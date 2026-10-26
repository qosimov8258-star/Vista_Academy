-- CreateEnum
CREATE TYPE "GroupMaterialKind" AS ENUM ('IMAGE', 'VIDEO', 'DOCUMENT');

-- CreateTable
CREATE TABLE "group_materials" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "kind" "GroupMaterialKind" NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "data" BYTEA,
    "data_key" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_by_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_materials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "group_materials_group_id_created_at_idx" ON "group_materials"("group_id", "created_at");

-- AddForeignKey
ALTER TABLE "group_materials" ADD CONSTRAINT "group_materials_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
