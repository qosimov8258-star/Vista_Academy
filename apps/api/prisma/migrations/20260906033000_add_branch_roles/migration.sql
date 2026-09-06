-- AlterEnum
ALTER TYPE "TenantUserRole" ADD VALUE 'BRANCH_ADMIN';
ALTER TYPE "TenantUserRole" ADD VALUE 'MANAGER';

-- AlterTable: branches.slug (backfilled from name, then made required + unique)
ALTER TABLE "branches" ADD COLUMN "slug" TEXT;

UPDATE "branches" SET "slug" =
  trim(both '-' from regexp_replace(regexp_replace(lower("name"), '[^a-z0-9\s-]', '', 'g'), '\s+', '-', 'g'))
  || '-' || substr(replace("id", '-', ''), 1, 6);

ALTER TABLE "branches" ALTER COLUMN "slug" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "branches_organization_id_slug_key" ON "branches"("organization_id", "slug");

-- AlterTable: tenant_users.branch_id
ALTER TABLE "tenant_users" ADD COLUMN "branch_id" TEXT;

-- CreateIndex
CREATE INDEX "tenant_users_branch_id_idx" ON "tenant_users"("branch_id");

-- AddForeignKey
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
