-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "logo" BYTEA,
ADD COLUMN     "logo_key" TEXT,
ADD COLUMN     "logo_mime_type" TEXT,
ADD COLUMN     "logo_updated_at" TIMESTAMP(3);

