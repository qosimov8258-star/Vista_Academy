-- Galereya: bitta ishga 5 tagacha rasm va matn.
-- Tarbiyachi guruhni bo'lib suratga oladi (har rasmda bir necha bola) —
-- ota-ona ularni varaqlab ko'radi. 1-rasm avvalgidek "gallery_items"da,
-- 2–5-rasmlar yangi "gallery_images"da. Mavjud ishlarga tegilmaydi.

ALTER TABLE "gallery_items" ADD COLUMN IF NOT EXISTS "description" TEXT;

CREATE TABLE IF NOT EXISTS "gallery_images" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "image" BYTEA,
    "image_key" TEXT,
    "mime_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gallery_images_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "gallery_images_item_id_position_key" ON "gallery_images"("item_id", "position");

DO $$ BEGIN
    ALTER TABLE "gallery_images" ADD CONSTRAINT "gallery_images_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "gallery_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
