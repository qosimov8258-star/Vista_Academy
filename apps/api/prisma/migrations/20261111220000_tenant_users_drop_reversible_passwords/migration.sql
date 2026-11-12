-- Xodim va bog'cha admini parollarining qaytarib ochiladigan (shifrlangan)
-- nusxalari o'chiriladi: tizimda parolni ko'rsatish funksiyasi olib
-- tashlandi, kirish uchun faqat password_hash ishlatiladi.
-- Ustun sxemada qoladi (bo'sh), shuning uchun eski kod ham yiqilmaydi.
-- Face ID qurilmalari paroli (face_id_devices) bunga kirmaydi — agent
-- terminalga ulanish uchun unga muhtoj.
UPDATE "tenant_users" SET "password_encrypted" = NULL WHERE "password_encrypted" IS NOT NULL;
