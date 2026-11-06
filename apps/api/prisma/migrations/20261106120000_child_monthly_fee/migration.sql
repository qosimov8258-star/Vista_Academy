-- Bolaning o'z oylik narxi: bo'sh bo'lsa guruh (u ham bo'lmasa filial) narxi olinadi.
ALTER TABLE "children" ADD COLUMN "monthly_fee" DECIMAL(12,2);
