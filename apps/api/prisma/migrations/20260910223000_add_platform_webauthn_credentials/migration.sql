-- Platforma admini uchun alohida WebAuthn jadvali (tenant_users uchun
-- bo'lgan webauthn_credentials'ga tegilmaydi) — tashkilot Super Admin
-- kabineti parolini "ko'rsatish" shu orqali tasdiqlanadi.

CREATE TABLE "platform_webauthn_credentials" (
    "id" TEXT NOT NULL,
    "platform_user_id" TEXT NOT NULL,
    "credential_id" TEXT NOT NULL,
    "public_key" BYTEA NOT NULL,
    "counter" BIGINT NOT NULL DEFAULT 0,
    "transports" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "device_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3),

    CONSTRAINT "platform_webauthn_credentials_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_webauthn_credentials_credential_id_key" ON "platform_webauthn_credentials"("credential_id");

CREATE INDEX "platform_webauthn_credentials_platform_user_id_idx" ON "platform_webauthn_credentials"("platform_user_id");

ALTER TABLE "platform_webauthn_credentials" ADD CONSTRAINT "platform_webauthn_credentials_platform_user_id_fkey" FOREIGN KEY ("platform_user_id") REFERENCES "platform_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
