-- Face ID terminal seriya raqami butun platformada emas, tashkilot ichida noyob:
-- boshqa bog'cha birovning terminal raqamini oldindan qo'shib, uni band qilib
-- qo'ya olmasin (va "allaqachon qo'shilgan" xabari orqali bilib ham olmasin).
DROP INDEX "face_id_devices_serial_number_key";

CREATE UNIQUE INDEX "face_id_devices_organization_id_serial_number_key" ON "face_id_devices"("organization_id", "serial_number");
