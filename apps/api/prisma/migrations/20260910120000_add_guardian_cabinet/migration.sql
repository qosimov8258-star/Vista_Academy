-- Ota-ona kabineti: vasiyga login (telefon raqami) va parol qo'shiladi.
-- Parol NULL bo'lsa — kabinet hali ochilmagan.
ALTER TABLE "guardians" ADD COLUMN "password_hash" TEXT;
ALTER TABLE "guardians" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "guardians" ADD COLUMN "last_login_at" TIMESTAMP(3);

-- Telefon raqami login bo'lgani uchun tashkilot ichida unikal bo'lishi shart
CREATE UNIQUE INDEX "guardians_organization_id_phone_key" ON "guardians"("organization_id", "phone");

-- Ota-ona seanslari xodimlar seanslaridan alohida saqlanadi
CREATE TABLE "guardian_refresh_tokens" (
    "id" TEXT NOT NULL,
    "guardian_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "replaced_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "guardian_refresh_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "guardian_refresh_tokens_token_hash_key" ON "guardian_refresh_tokens"("token_hash");
CREATE INDEX "guardian_refresh_tokens_guardian_id_idx" ON "guardian_refresh_tokens"("guardian_id");
ALTER TABLE "guardian_refresh_tokens" ADD CONSTRAINT "guardian_refresh_tokens_guardian_id_fkey"
    FOREIGN KEY ("guardian_id") REFERENCES "guardians"("id") ON DELETE CASCADE ON UPDATE CASCADE;
