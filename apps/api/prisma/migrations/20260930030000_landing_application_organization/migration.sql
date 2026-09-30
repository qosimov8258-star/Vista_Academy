-- Lending arizasi qaysi bog'chaniki ekani saqlanadi (call operatorga shu tashkilotga tushadi)
ALTER TABLE "landing_applications" ADD COLUMN "organization_id" TEXT;

CREATE INDEX "landing_applications_organization_id_created_at_idx" ON "landing_applications"("organization_id", "created_at");

ALTER TABLE "landing_applications" ADD CONSTRAINT "landing_applications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
