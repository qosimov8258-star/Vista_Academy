-- Xonalar (kabinetlar) qaytadan: bir xonada bir nechta guruh navbat bilan dars
-- o'tadi, dars jadvali ixtiyoriy ravishda xonaga bog'lanadi. Xona o'chirilsa —
-- darslar xonasiz qoladi (SET NULL), o'chib ketmaydi.
CREATE TABLE "rooms" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rooms_branch_id_name_key" ON "rooms"("branch_id", "name");

ALTER TABLE "rooms" ADD CONSTRAINT "rooms_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lesson_schedules" ADD COLUMN "room_id" TEXT;

CREATE INDEX "lesson_schedules_room_id_weekday_idx" ON "lesson_schedules"("room_id", "weekday");

ALTER TABLE "lesson_schedules" ADD CONSTRAINT "lesson_schedules_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
