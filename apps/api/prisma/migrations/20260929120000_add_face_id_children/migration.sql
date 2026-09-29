-- Face ID bolalar uchun: terminal voqeasi va buyrug'i bolaga bog'lanadi,
-- bolalar davomatiga terminal yozgan kelish/ketish vaqti qo'shiladi.

-- AlterTable
ALTER TABLE "attendances" ADD COLUMN     "check_in_time" TEXT,
ADD COLUMN     "check_out_time" TEXT;

-- AlterTable
ALTER TABLE "face_id_commands" ADD COLUMN     "child_id" TEXT;

-- AlterTable
ALTER TABLE "face_id_events" ADD COLUMN     "child_id" TEXT;

-- CreateIndex
CREATE INDEX "face_id_events_child_id_event_time_idx" ON "face_id_events"("child_id", "event_time");

-- AddForeignKey
ALTER TABLE "face_id_events" ADD CONSTRAINT "face_id_events_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "face_id_commands" ADD CONSTRAINT "face_id_commands_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE SET NULL ON UPDATE CASCADE;

