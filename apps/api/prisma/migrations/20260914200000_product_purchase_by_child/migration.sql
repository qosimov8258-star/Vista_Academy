-- Ota-ona kabinetidan sotib olish: coin manbasiga yangi tur va sotuvni
-- muayyan bolaga bog'lash uchun.
-- AlterEnum
ALTER TYPE "CoinTransactionSource" ADD VALUE 'PRODUCT_PURCHASE';

-- AlterTable
ALTER TABLE "product_sales" ADD COLUMN "child_id" TEXT;

-- CreateIndex
CREATE INDEX "product_sales_child_id_idx" ON "product_sales"("child_id");

-- AddForeignKey
ALTER TABLE "product_sales" ADD CONSTRAINT "product_sales_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE SET NULL ON UPDATE CASCADE;
