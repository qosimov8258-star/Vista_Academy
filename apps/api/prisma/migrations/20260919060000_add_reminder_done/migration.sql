-- Eslatma bajarilganini belgilash (masalan "dori berildi"): qachon va kim.
ALTER TABLE "child_reminders" ADD COLUMN "done_at" TIMESTAMP(3), ADD COLUMN "done_by_name" TEXT;
