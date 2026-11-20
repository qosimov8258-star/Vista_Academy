-- Face ID: Hik Device Gateway (ISUP 5.0) orqali ulanish — agentsiz.
-- Faqat ixtiyoriy ustunlar qo'shiladi; qayta ishga tushirilsa yiqilmaydi.
ALTER TABLE "face_id_devices" ADD COLUMN IF NOT EXISTS "gateway_index" TEXT;
ALTER TABLE "face_id_devices" ADD COLUMN IF NOT EXISTS "isup_device_id" TEXT;
ALTER TABLE "face_id_devices" ADD COLUMN IF NOT EXISTS "isup_key_encrypted" BYTEA;
ALTER TABLE "face_id_devices" ADD COLUMN IF NOT EXISTS "gateway_events_since" TIMESTAMP(3);
CREATE UNIQUE INDEX IF NOT EXISTS "face_id_devices_isup_device_id_key" ON "face_id_devices"("isup_device_id");
