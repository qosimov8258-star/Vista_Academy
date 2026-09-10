-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "avatar" BYTEA,
ADD COLUMN     "avatar_mime_type" TEXT,
ADD COLUMN     "avatar_updated_at" TIMESTAMP(3);
