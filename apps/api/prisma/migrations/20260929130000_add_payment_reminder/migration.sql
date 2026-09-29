-- CreateTable
CREATE TABLE "payment_reminder_settings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "days_before_due" INTEGER NOT NULL DEFAULT 5,
    "days_after_due" INTEGER NOT NULL DEFAULT 5,
    "send_times" TEXT[] DEFAULT ARRAY['09:00']::TEXT[],
    "message_template" TEXT NOT NULL DEFAULT 'Hurmatli ota-ona! {childName} uchun to''lov muddati {dueDate}. Iltimos, to''lovni amalga oshiring.',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_reminder_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_reminder_dispatches" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "send_time" TEXT NOT NULL,
    "dispatch_date" DATE NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_reminder_dispatches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_reminder_settings_branch_id_key" ON "payment_reminder_settings"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_reminder_dispatches_invoice_id_send_time_dispatch_key" ON "payment_reminder_dispatches"("invoice_id", "send_time", "dispatch_date");

-- CreateIndex
CREATE INDEX "payment_reminder_dispatches_branch_id_dispatch_date_idx" ON "payment_reminder_dispatches"("branch_id", "dispatch_date");

-- AddForeignKey
ALTER TABLE "payment_reminder_settings" ADD CONSTRAINT "payment_reminder_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_reminder_settings" ADD CONSTRAINT "payment_reminder_settings_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_reminder_dispatches" ADD CONSTRAINT "payment_reminder_dispatches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_reminder_dispatches" ADD CONSTRAINT "payment_reminder_dispatches_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_reminder_dispatches" ADD CONSTRAINT "payment_reminder_dispatches_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_reminder_dispatches" ADD CONSTRAINT "payment_reminder_dispatches_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
