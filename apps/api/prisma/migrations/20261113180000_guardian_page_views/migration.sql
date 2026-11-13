-- CreateTable
CREATE TABLE "guardian_page_views" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "guardian_id" TEXT NOT NULL,
    "child_id" TEXT,
    "page" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration_sec" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "guardian_page_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "guardian_page_views_organization_id_started_at_idx" ON "guardian_page_views"("organization_id", "started_at");

-- CreateIndex
CREATE INDEX "guardian_page_views_guardian_id_started_at_idx" ON "guardian_page_views"("guardian_id", "started_at");

-- AddForeignKey
ALTER TABLE "guardian_page_views" ADD CONSTRAINT "guardian_page_views_guardian_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "guardians"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_page_views" ADD CONSTRAINT "guardian_page_views_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE SET NULL ON UPDATE CASCADE;

