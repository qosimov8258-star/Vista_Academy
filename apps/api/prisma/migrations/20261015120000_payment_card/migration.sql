-- Bog'cha to'lov kartasi (moliyachi kiritadi, ota-onalarga ko'rinadi) va chekka ota-ona izohi.
ALTER TABLE "payment_receipts" ADD COLUMN "note" TEXT;

CREATE TABLE "payment_cards" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "card_number" TEXT NOT NULL,
    "holder_name" TEXT NOT NULL,
    "bank_name" TEXT,
    "note" TEXT,
    "updated_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_cards_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_cards_organization_id_key" ON "payment_cards"("organization_id");

ALTER TABLE "payment_cards" ADD CONSTRAINT "payment_cards_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_cards" ADD CONSTRAINT "payment_cards_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "tenant_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
