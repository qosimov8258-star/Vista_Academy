-- "To'lov cheki" (payment receipt) tasdiqlash oqimi: ota-ona kabinetidan
-- yuklangan chek moliyachi tasdiqlamaguncha (APPROVED) haqiqiy to'lov
-- hisoblanmaydi. `PaymentMethod`ga raqamli to'lov usullari qo'shiladi —
-- ular faqat chek tasdiqlanganda tanlanadi, kassaning qo'lda to'lov
-- ekrani (CASH/CARD/BANK_TRANSFER) o'zgarmaydi.

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'CLICK';
ALTER TYPE "PaymentMethod" ADD VALUE 'PAYME';
ALTER TYPE "PaymentMethod" ADD VALUE 'UZUM';
ALTER TYPE "PaymentMethod" ADD VALUE 'MOBILE_APP';
ALTER TYPE "PaymentMethod" ADD VALUE 'BANKOMAT';

-- CreateEnum
CREATE TYPE "PaymentReceiptStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "payment_receipts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "guardian_id" TEXT NOT NULL,
    "claimed_amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'UZS',
    "image" BYTEA NOT NULL,
    "mime_type" TEXT NOT NULL,
    "status" "PaymentReceiptStatus" NOT NULL DEFAULT 'PENDING',
    "review_note" TEXT,
    "reviewed_by_user_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "payment_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_receipts_payment_id_key" ON "payment_receipts"("payment_id");

-- CreateIndex
CREATE INDEX "payment_receipts_organization_id_branch_id_idx" ON "payment_receipts"("organization_id", "branch_id");

-- CreateIndex
CREATE INDEX "payment_receipts_child_id_idx" ON "payment_receipts"("child_id");

-- CreateIndex
CREATE INDEX "payment_receipts_status_idx" ON "payment_receipts"("status");

-- CreateIndex
CREATE INDEX "payment_receipts_guardian_id_idx" ON "payment_receipts"("guardian_id");

-- AddForeignKey
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_guardian_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "guardians"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "tenant_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
