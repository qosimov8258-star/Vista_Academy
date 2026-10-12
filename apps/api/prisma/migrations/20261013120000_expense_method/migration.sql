-- Xarajatga to'lov usuli, kim yozgani va o'zgartirilgan vaqti.
-- Eski yozuvlar naqd (CASH) bo'lib qoladi — avval hammasi naqd hisoblanardi.
ALTER TABLE "expenses" ADD COLUMN "method" "PaymentMethod" NOT NULL DEFAULT 'CASH';
ALTER TABLE "expenses" ADD COLUMN "created_by_user_id" TEXT;
ALTER TABLE "expenses" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
