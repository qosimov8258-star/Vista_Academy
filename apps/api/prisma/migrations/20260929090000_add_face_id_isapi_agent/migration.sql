-- CreateEnum
CREATE TYPE "FaceIdCommandType" AS ENUM ('ADD_OR_UPDATE_USER', 'SET_FACE', 'DELETE_USER');

-- CreateEnum
CREATE TYPE "FaceIdCommandStatus" AS ENUM ('PENDING', 'SENT', 'DONE', 'FAILED');

-- Xodimning qurilmadagi raqami (Hikvision employeeNo). Mavjud xodimlar
-- yaratilish tartibida 1001, 1002, … oladi; keyingilar ketma-ketlikdan.
CREATE SEQUENCE "employee_no_seq" START WITH 1001;

ALTER TABLE "employees" ADD COLUMN "employee_no" TEXT;

WITH numbered AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "created_at", "id") AS rn FROM "employees"
)
UPDATE "employees" e SET "employee_no" = (1000 + numbered.rn)::text
FROM numbered WHERE e."id" = numbered."id";

-- Ketma-ketlik to'ldirilgan raqamlardan keyin davom etadi (bo'sh jadvalda — 1001 dan)
SELECT setval('employee_no_seq', (SELECT COALESCE(MAX("employee_no"::int), 1000) FROM "employees"));

ALTER TABLE "employees"
  ALTER COLUMN "employee_no" SET DEFAULT (nextval('employee_no_seq'::regclass))::text,
  ALTER COLUMN "employee_no" SET NOT NULL;

ALTER SEQUENCE "employee_no_seq" OWNED BY "employees"."employee_no";

-- AlterTable
ALTER TABLE "face_id_devices" ADD COLUMN     "agent_token_hash" TEXT,
ADD COLUMN     "last_seen_at" TIMESTAMP(3),
ADD COLUMN     "password_encrypted" BYTEA,
ADD COLUMN     "port" INTEGER NOT NULL DEFAULT 80,
ADD COLUMN     "username" TEXT;

-- CreateTable
CREATE TABLE "face_id_events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "serial_no" INTEGER NOT NULL,
    "employee_no" TEXT,
    "employee_id" TEXT,
    "event_time" TIMESTAMP(3) NOT NULL,
    "major" INTEGER NOT NULL,
    "minor" INTEGER NOT NULL,
    "verify_mode" TEXT,
    "picture_url" TEXT,
    "raw" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "face_id_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "face_id_commands" (
    "id" TEXT NOT NULL,
    "seq" SERIAL NOT NULL,
    "organization_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "employee_id" TEXT,
    "employee_no" TEXT NOT NULL,
    "type" "FaceIdCommandType" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "FaceIdCommandStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "sent_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "face_id_commands_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "face_id_events_employee_id_event_time_idx" ON "face_id_events"("employee_id", "event_time");

-- CreateIndex
CREATE INDEX "face_id_events_branch_id_event_time_idx" ON "face_id_events"("branch_id", "event_time");

-- CreateIndex
CREATE UNIQUE INDEX "face_id_events_device_id_serial_no_event_time_key" ON "face_id_events"("device_id", "serial_no", "event_time");

-- CreateIndex
CREATE INDEX "face_id_commands_device_id_status_seq_idx" ON "face_id_commands"("device_id", "status", "seq");

-- CreateIndex
CREATE INDEX "face_id_commands_employee_no_idx" ON "face_id_commands"("employee_no");

-- CreateIndex
CREATE UNIQUE INDEX "face_id_commands_seq_key" ON "face_id_commands"("seq");

-- CreateIndex
CREATE UNIQUE INDEX "employees_employee_no_key" ON "employees"("employee_no");

-- CreateIndex
CREATE UNIQUE INDEX "face_id_devices_serial_number_key" ON "face_id_devices"("serial_number");

-- CreateIndex
CREATE UNIQUE INDEX "face_id_devices_agent_token_hash_key" ON "face_id_devices"("agent_token_hash");

-- AddForeignKey
ALTER TABLE "face_id_events" ADD CONSTRAINT "face_id_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "face_id_events" ADD CONSTRAINT "face_id_events_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "face_id_events" ADD CONSTRAINT "face_id_events_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "face_id_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "face_id_events" ADD CONSTRAINT "face_id_events_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "face_id_commands" ADD CONSTRAINT "face_id_commands_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "face_id_commands" ADD CONSTRAINT "face_id_commands_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "face_id_commands" ADD CONSTRAINT "face_id_commands_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "face_id_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "face_id_commands" ADD CONSTRAINT "face_id_commands_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

