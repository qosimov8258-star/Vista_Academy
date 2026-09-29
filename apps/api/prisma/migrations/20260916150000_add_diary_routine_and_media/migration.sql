-- Kundalik: guruhning kun tartibi shabloni, kunlik belgilar va lahzalar
-- (rasm/video). Faqat yangi jadvallar — mavjudlariga tegilmaydi.

-- CreateEnum
CREATE TYPE "DiaryActivityKind" AS ENUM ('ARRIVAL', 'LESSON', 'EXERCISE', 'MEAL', 'SLEEP', 'WALK', 'SWIM', 'PLAY', 'CREATIVE', 'DEPARTURE', 'OTHER');

-- CreateEnum
CREATE TYPE "DiaryMediaKind" AS ENUM ('PHOTO', 'VIDEO');

-- CreateTable
CREATE TABLE "diary_routine_items" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT,
    "title" TEXT NOT NULL,
    "kind" "DiaryActivityKind" NOT NULL DEFAULT 'OTHER',
    "weekdays" "Weekday"[],
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diary_routine_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diary_entries" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "routine_item_id" TEXT,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT,
    "title" TEXT NOT NULL,
    "kind" "DiaryActivityKind" NOT NULL DEFAULT 'OTHER',
    "note" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_by_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diary_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diary_media" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "entry_id" TEXT,
    "kind" "DiaryMediaKind" NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "poster_data" BYTEA,
    "poster_mime_type" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "duration_seconds" INTEGER,
    "caption" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_by_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diary_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "diary_routine_items_group_id_idx" ON "diary_routine_items"("group_id");

-- CreateIndex
CREATE INDEX "diary_entries_group_id_date_idx" ON "diary_entries"("group_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "diary_entries_routine_item_id_date_key" ON "diary_entries"("routine_item_id", "date");

-- CreateIndex
CREATE INDEX "diary_media_group_id_date_idx" ON "diary_media"("group_id", "date");

-- CreateIndex
CREATE INDEX "diary_media_entry_id_idx" ON "diary_media"("entry_id");

-- AddForeignKey
ALTER TABLE "diary_routine_items" ADD CONSTRAINT "diary_routine_items_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary_entries" ADD CONSTRAINT "diary_entries_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary_entries" ADD CONSTRAINT "diary_entries_routine_item_id_fkey" FOREIGN KEY ("routine_item_id") REFERENCES "diary_routine_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary_media" ADD CONSTRAINT "diary_media_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary_media" ADD CONSTRAINT "diary_media_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "diary_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

