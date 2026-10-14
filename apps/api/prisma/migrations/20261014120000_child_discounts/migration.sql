-- Chegirma qoidalari (bola uchun oylik to'lovga): foiz, summa yoki yakuniy narx;
-- bir oylik yoki doimiy. Mavjud jadvallarga tegilmaydi.

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT', 'FINAL_AMOUNT');

-- CreateEnum
CREATE TYPE "DiscountScope" AS ENUM ('ONE_MONTH', 'PERMANENT');

-- CreateTable
CREATE TABLE "child_discounts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "type" "DiscountType" NOT NULL,
    "scope" "DiscountScope" NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "start_period" TEXT NOT NULL,
    "end_period" TEXT,
    "reason" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_name" TEXT NOT NULL,
    "created_by_user_id" TEXT,
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "child_discounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "child_discounts_child_id_is_active_idx" ON "child_discounts"("child_id", "is_active");

-- CreateIndex
CREATE INDEX "child_discounts_branch_id_is_active_idx" ON "child_discounts"("branch_id", "is_active");

-- AddForeignKey
ALTER TABLE "child_discounts" ADD CONSTRAINT "child_discounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_discounts" ADD CONSTRAINT "child_discounts_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_discounts" ADD CONSTRAINT "child_discounts_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;
