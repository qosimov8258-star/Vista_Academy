-- CreateEnum
CREATE TYPE "BroadcastAudience" AS ENUM ('GUARDIANS', 'EMPLOYEES');

-- CreateTable
CREATE TABLE "broadcasts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "audience" "BroadcastAudience" NOT NULL,
    "scope_label" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "is_mandatory" BOOLEAN NOT NULL DEFAULT false,
    "recipient_count" INTEGER NOT NULL DEFAULT 0,
    "sent_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "broadcasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broadcast_recipients" (
    "id" TEXT NOT NULL,
    "broadcast_id" TEXT NOT NULL,
    "guardian_id" TEXT,
    "employee_id" TEXT,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "broadcast_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "broadcasts_branch_id_created_at_idx" ON "broadcasts"("branch_id", "created_at");

-- CreateIndex
CREATE INDEX "broadcasts_organization_id_idx" ON "broadcasts"("organization_id");

-- CreateIndex
CREATE INDEX "broadcast_recipients_guardian_id_read_at_idx" ON "broadcast_recipients"("guardian_id", "read_at");

-- CreateIndex
CREATE INDEX "broadcast_recipients_employee_id_read_at_idx" ON "broadcast_recipients"("employee_id", "read_at");

-- CreateIndex
CREATE UNIQUE INDEX "broadcast_recipients_broadcast_id_guardian_id_key" ON "broadcast_recipients"("broadcast_id", "guardian_id");

-- CreateIndex
CREATE UNIQUE INDEX "broadcast_recipients_broadcast_id_employee_id_key" ON "broadcast_recipients"("broadcast_id", "employee_id");

-- AddForeignKey
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_sent_by_user_id_fkey" FOREIGN KEY ("sent_by_user_id") REFERENCES "tenant_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcast_recipients" ADD CONSTRAINT "broadcast_recipients_broadcast_id_fkey" FOREIGN KEY ("broadcast_id") REFERENCES "broadcasts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcast_recipients" ADD CONSTRAINT "broadcast_recipients_guardian_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "guardians"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcast_recipients" ADD CONSTRAINT "broadcast_recipients_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

