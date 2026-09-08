-- AlterEnum
-- O'qituvchi: faqat o'ziga biriktirilgan guruhlarga davomat qo'yadi va
-- kundalik hisobot to'ldiradi.
ALTER TYPE "TenantUserRole" ADD VALUE 'TEACHER';

-- AlterTable: xodimning kabineti (login). Ixtiyoriy — hamma xodim ham
-- tizimga kirmaydi.
ALTER TABLE "employees" ADD COLUMN "tenant_user_id" TEXT;

CREATE UNIQUE INDEX "employees_tenant_user_id_key" ON "employees"("tenant_user_id");

ALTER TABLE "employees" ADD CONSTRAINT "employees_tenant_user_id_fkey"
  FOREIGN KEY ("tenant_user_id") REFERENCES "tenant_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: guruh va tarbiyachi bog'lanishi (ko'p-ko'pga)
CREATE TABLE "group_teachers" (
    "group_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_teachers_pkey" PRIMARY KEY ("group_id","employee_id")
);

CREATE INDEX "group_teachers_employee_id_idx" ON "group_teachers"("employee_id");

ALTER TABLE "group_teachers" ADD CONSTRAINT "group_teachers_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "group_teachers" ADD CONSTRAINT "group_teachers_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
