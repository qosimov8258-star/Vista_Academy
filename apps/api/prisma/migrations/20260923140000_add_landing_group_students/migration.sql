-- CreateTable
CREATE TABLE "landing_group_students" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bio" TEXT,
    "photo_path" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "landing_group_students_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "landing_group_students_group_id_idx" ON "landing_group_students"("group_id");

-- AddForeignKey
ALTER TABLE "landing_group_students" ADD CONSTRAINT "landing_group_students_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "landing_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
