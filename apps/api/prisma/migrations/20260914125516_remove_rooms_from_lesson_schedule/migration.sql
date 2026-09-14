-- Dars jadvali endi xonaga emas, faqat guruhga bog'lanadi ("xona = guruh"),
-- shuning uchun alohida Xona (Room) tushunchasi butunlay olib tashlanadi.

-- Avval lesson_schedules dagi room_id bog'lanishini uzamiz
ALTER TABLE "lesson_schedules" DROP CONSTRAINT "lesson_schedules_room_id_fkey";
DROP INDEX "lesson_schedules_room_id_weekday_idx";
ALTER TABLE "lesson_schedules" DROP COLUMN "room_id";

-- Bir guruhda bir vaqtda ikkita dars bo'lmasin (avvalgi xona bo'yicha
-- tekshiruv endi guruh bo'yicha tekshiruvga almashadi)
DROP INDEX "lesson_schedules_group_id_idx";
CREATE INDEX "lesson_schedules_group_id_weekday_idx" ON "lesson_schedules"("group_id", "weekday");

-- rooms jadvali endi hech kim tomonidan ishlatilmaydi
DROP TABLE "rooms";
