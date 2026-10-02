-- Platforma: bog'chani sabab bilan to'xtatish, arxivlash (qattiq o'chirish o'rniga)
-- va operatorning ichki izohi.
ALTER TYPE "OrganizationStatus" ADD VALUE 'ARCHIVED';

ALTER TABLE "organizations"
  ADD COLUMN "suspend_reason" TEXT,
  ADD COLUMN "suspended_at" TIMESTAMP(3),
  ADD COLUMN "archived_at" TIMESTAMP(3),
  ADD COLUMN "notes" TEXT;
