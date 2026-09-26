-- CreateEnum
CREATE TYPE "FaceIdDeviceStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "FaceEnrollmentStatus" AS ENUM ('PENDING', 'REGISTERED', 'FAILED', 'REMOVED');

-- CreateEnum
CREATE TYPE "FacePersonType" AS ENUM ('EMPLOYEE', 'CHILD');

-- CreateTable
CREATE TABLE "face_id_devices" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'DS-K1T342MX',
    "serial_number" TEXT,
    "ip_address" TEXT,
    "location" TEXT,
    "status" "FaceIdDeviceStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "face_id_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "face_enrollments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "person_type" "FacePersonType" NOT NULL,
    "employee_id" TEXT,
    "child_id" TEXT,
    "status" "FaceEnrollmentStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "registered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "face_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "face_id_devices_organization_id_idx" ON "face_id_devices"("organization_id");

-- CreateIndex
CREATE INDEX "face_id_devices_branch_id_idx" ON "face_id_devices"("branch_id");

-- CreateIndex
CREATE INDEX "face_enrollments_organization_id_idx" ON "face_enrollments"("organization_id");

-- CreateIndex
CREATE INDEX "face_enrollments_branch_id_idx" ON "face_enrollments"("branch_id");

-- CreateIndex
CREATE INDEX "face_enrollments_device_id_idx" ON "face_enrollments"("device_id");

-- CreateIndex
CREATE INDEX "face_enrollments_employee_id_idx" ON "face_enrollments"("employee_id");

-- CreateIndex
CREATE INDEX "face_enrollments_child_id_idx" ON "face_enrollments"("child_id");

-- AddForeignKey
ALTER TABLE "face_id_devices" ADD CONSTRAINT "face_id_devices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "face_id_devices" ADD CONSTRAINT "face_id_devices_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "face_enrollments" ADD CONSTRAINT "face_enrollments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "face_enrollments" ADD CONSTRAINT "face_enrollments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "face_enrollments" ADD CONSTRAINT "face_enrollments_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "face_id_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "face_enrollments" ADD CONSTRAINT "face_enrollments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "face_enrollments" ADD CONSTRAINT "face_enrollments_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;
