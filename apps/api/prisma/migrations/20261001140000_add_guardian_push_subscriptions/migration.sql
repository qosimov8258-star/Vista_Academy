-- CreateTable
CREATE TABLE "guardian_push_subscriptions" (
    "id" TEXT NOT NULL,
    "guardian_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guardian_push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guardian_push_subscriptions_endpoint_key" ON "guardian_push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "guardian_push_subscriptions_guardian_id_idx" ON "guardian_push_subscriptions"("guardian_id");

-- AddForeignKey
ALTER TABLE "guardian_push_subscriptions" ADD CONSTRAINT "guardian_push_subscriptions_guardian_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "guardians"("id") ON DELETE CASCADE ON UPDATE CASCADE;
