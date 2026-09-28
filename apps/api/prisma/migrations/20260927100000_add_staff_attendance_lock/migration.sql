-- CreateTable
CREATE TABLE "staff_attendance_locks" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "locked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_by_name" TEXT NOT NULL,

    CONSTRAINT "staff_attendance_locks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_attendance_locks_branch_id_date_key" ON "staff_attendance_locks"("branch_id", "date");

-- AddForeignKey
ALTER TABLE "staff_attendance_locks" ADD CONSTRAINT "staff_attendance_locks_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
