-- Xodim kelmagan kun(lar) uchun hujjat (kasallik varaqasi, ariza): bitta hujjat bir necha kunni qoplaydi.
-- Faqat yangi tur va jadval — mavjud jadvallarga tegilmaydi.
-- CreateEnum
CREATE TYPE "StaffDocumentKind" AS ENUM ('SICK_NOTE', 'LEAVE_REQUEST', 'OTHER');

-- CreateTable
CREATE TABLE "staff_absence_documents" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "kind" "StaffDocumentKind" NOT NULL DEFAULT 'SICK_NOTE',
    "dates" DATE[],
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "file_key" TEXT,
    "file_bytes" BYTEA,
    "note" TEXT,
    "uploaded_by_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_absence_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "staff_absence_documents_employee_id_idx" ON "staff_absence_documents"("employee_id");

-- CreateIndex
CREATE INDEX "staff_absence_documents_branch_id_idx" ON "staff_absence_documents"("branch_id");

-- AddForeignKey
ALTER TABLE "staff_absence_documents" ADD CONSTRAINT "staff_absence_documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_absence_documents" ADD CONSTRAINT "staff_absence_documents_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_absence_documents" ADD CONSTRAINT "staff_absence_documents_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

