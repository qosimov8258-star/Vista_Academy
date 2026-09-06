-- CreateEnum
CREATE TYPE "EmployeeAttendanceStatus" AS ENUM ('PRESENT', 'ABSENT');

-- CreateTable
CREATE TABLE "employee_attendances" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "EmployeeAttendanceStatus" NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_attendances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_entries" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "breakfast" TEXT,
    "lunch" TEXT,
    "snack" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menu_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employee_attendances_branch_id_date_idx" ON "employee_attendances"("branch_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "employee_attendances_employee_id_date_key" ON "employee_attendances"("employee_id", "date");

-- CreateIndex
CREATE INDEX "menu_entries_branch_id_date_idx" ON "menu_entries"("branch_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "menu_entries_branch_id_date_key" ON "menu_entries"("branch_id", "date");

-- AddForeignKey
ALTER TABLE "employee_attendances" ADD CONSTRAINT "employee_attendances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_attendances" ADD CONSTRAINT "employee_attendances_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_entries" ADD CONSTRAINT "menu_entries_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
