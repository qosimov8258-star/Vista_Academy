-- To'lovni bekor qilish sababi va kim bekor qilgani — to'lovning o'zida saqlanadi.
ALTER TABLE "payments" ADD COLUMN "refund_reason" TEXT;
ALTER TABLE "payments" ADD COLUMN "refunded_by_name" TEXT;
