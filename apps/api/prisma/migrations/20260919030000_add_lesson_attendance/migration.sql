-- Fan o'qituvchisining o'z darsi bo'yicha davomati (keldi/kelmadi).
-- Kunlik `attendances` jadvalidan alohida: tarbiyachi va fan o'qituvchisi
-- bir-birining yozuvini ustidan yozib yubormasligi uchun.
CREATE TABLE "lesson_attendances" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "schedule_id" TEXT NOT NULL,
    "subject" TEXT,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lesson_attendances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lesson_attendances_schedule_id_child_id_date_key" ON "lesson_attendances"("schedule_id", "child_id", "date");
CREATE INDEX "lesson_attendances_group_id_date_idx" ON "lesson_attendances"("group_id", "date");
CREATE INDEX "lesson_attendances_employee_id_date_idx" ON "lesson_attendances"("employee_id", "date");

ALTER TABLE "lesson_attendances" ADD CONSTRAINT "lesson_attendances_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lesson_attendances" ADD CONSTRAINT "lesson_attendances_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lesson_attendances" ADD CONSTRAINT "lesson_attendances_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lesson_attendances" ADD CONSTRAINT "lesson_attendances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
