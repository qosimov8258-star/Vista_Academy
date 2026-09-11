-- Ariza (Lead): eslatma sanasi, sinov kuni sanasi, shartnoma ma'lumotlari
ALTER TABLE "leads" ADD COLUMN "follow_up_date" DATE;
ALTER TABLE "leads" ADD COLUMN "trial_date" DATE;
ALTER TABLE "leads" ADD COLUMN "contract_date" DATE;
ALTER TABLE "leads" ADD COLUMN "contract_note" TEXT;
