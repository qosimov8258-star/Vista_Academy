-- Platforma billing: yangi bog'cha sinov muddati bilan ochilishi mumkin.
ALTER TABLE "subscriptions" ADD COLUMN "trial_ends_at" TIMESTAMP(3);
