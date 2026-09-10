-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "subjects" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
