-- Dars jadvali belgilanganda/o'zgarganda tegishli o'qituvchiga ko'rinadigan
-- bildirishnoma jadvali ("Sizga dushanba, chorshanba 9:00-9:45 da dars bor").
CREATE TABLE "employee_notifications" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "employee_notifications_employee_id_is_read_idx" ON "employee_notifications"("employee_id", "is_read");
CREATE INDEX "employee_notifications_branch_id_idx" ON "employee_notifications"("branch_id");

ALTER TABLE "employee_notifications" ADD CONSTRAINT "employee_notifications_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_notifications" ADD CONSTRAINT "employee_notifications_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
