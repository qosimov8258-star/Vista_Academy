-- Xodimni arxivlash: «Faol/Nofaol» o'rniga — ishdan ketgan xodimning tarixi saqlanadi
ALTER TABLE "employees" ADD COLUMN "archived_at" TIMESTAMP(3);

-- Avval «Nofaol» qilingan xodimlar endi «Arxiv» bo'limida ko'rinadi
UPDATE "employees" SET "archived_at" = "updated_at" WHERE "is_active" = false AND "archived_at" IS NULL;
