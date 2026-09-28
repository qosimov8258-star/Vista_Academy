-- Tarbiyachining bola uchun bir kunlik eslatmalari (masalan dori vaqti).
CREATE TABLE "child_reminders" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "time" TEXT,
    "text" TEXT NOT NULL,
    "author_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "child_reminders_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "child_reminders_branch_id_date_idx" ON "child_reminders"("branch_id", "date");
CREATE INDEX "child_reminders_child_id_date_idx" ON "child_reminders"("child_id", "date");

ALTER TABLE "child_reminders" ADD CONSTRAINT "child_reminders_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "child_reminders" ADD CONSTRAINT "child_reminders_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;
