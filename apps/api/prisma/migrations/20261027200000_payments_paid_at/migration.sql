-- To'lov sanasi: moliyachi o'tgan kunda olingan pulni keyin kiritsa, kassa va
-- hisobotlar kiritilgan vaqt emas, shu sana bo'yicha hisoblaydi.
ALTER TABLE "payments" ADD COLUMN "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Mavjud to'lovlar: to'lov sanasi = kiritilgan vaqt (hozirgi hisobotlar o'zgarmaydi)
UPDATE "payments" SET "paid_at" = "created_at";

CREATE INDEX "payments_branch_id_paid_at_idx" ON "payments"("branch_id", "paid_at");
