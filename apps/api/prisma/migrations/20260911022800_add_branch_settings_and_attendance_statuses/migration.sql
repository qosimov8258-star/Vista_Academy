-- Filial sozlamalari: ish vaqti va standart to'lov summasi
ALTER TABLE "branches" ADD COLUMN "open_time" TEXT;
ALTER TABLE "branches" ADD COLUMN "close_time" TEXT;
ALTER TABLE "branches" ADD COLUMN "default_tuition_amount" DECIMAL(12,2);

-- Davomat holatlariga qo'shimcha variantlar
ALTER TYPE "EmployeeAttendanceStatus" ADD VALUE 'LATE';
ALTER TYPE "EmployeeAttendanceStatus" ADD VALUE 'SICK';
ALTER TYPE "EmployeeAttendanceStatus" ADD VALUE 'ON_LEAVE';

ALTER TYPE "AttendanceStatus" ADD VALUE 'LATE';
ALTER TYPE "AttendanceStatus" ADD VALUE 'SICK';
