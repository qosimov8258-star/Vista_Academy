-- CreateTable
CREATE TABLE "landing_group_photos" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "landing_group_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "landing_group_photos_group_id_idx" ON "landing_group_photos"("group_id");

-- AddForeignKey
ALTER TABLE "landing_group_photos" ADD CONSTRAINT "landing_group_photos_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "landing_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
