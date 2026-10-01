-- Face ID: obyekt agentini filialga bir martalik kod bilan ulash. Ulangan agent
-- filialdagi barcha qurilmalarga o'zi xizmat qiladi (har qurilma tokenini .env ga
-- qo'lda yozish shart emas). Kod va kalitning faqat sha256 si saqlanadi.
CREATE TABLE "face_id_agents" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "last_seen_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "face_id_agents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "face_id_agent_pairing_codes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "face_id_agent_pairing_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "face_id_agents_key_hash_key" ON "face_id_agents"("key_hash");
CREATE INDEX "face_id_agents_organization_id_branch_id_idx" ON "face_id_agents"("organization_id", "branch_id");
CREATE UNIQUE INDEX "face_id_agent_pairing_codes_code_hash_key" ON "face_id_agent_pairing_codes"("code_hash");
CREATE INDEX "face_id_agent_pairing_codes_branch_id_idx" ON "face_id_agent_pairing_codes"("branch_id");

ALTER TABLE "face_id_agents" ADD CONSTRAINT "face_id_agents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "face_id_agents" ADD CONSTRAINT "face_id_agents_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "face_id_agent_pairing_codes" ADD CONSTRAINT "face_id_agent_pairing_codes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "face_id_agent_pairing_codes" ADD CONSTRAINT "face_id_agent_pairing_codes_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
