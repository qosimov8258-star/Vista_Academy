-- AlterTable
ALTER TABLE "products" DROP COLUMN "size",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "price_coins" INTEGER NOT NULL DEFAULT 0;
