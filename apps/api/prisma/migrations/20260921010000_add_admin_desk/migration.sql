-- Administrator paneli: qo'ng'iroq belgilari va bolani olib ketish jurnali.
CREATE TABLE "call_logs" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "note" TEXT,
    "called_by_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pickup_logs" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "picked_by_name" TEXT NOT NULL,
    "relation" TEXT,
    "note" TEXT,
    "recorded_by_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pickup_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "call_logs_branch_id_date_idx" ON "call_logs"("branch_id", "date");
CREATE UNIQUE INDEX "pickup_logs_child_id_date_key" ON "pickup_logs"("child_id", "date");
CREATE INDEX "pickup_logs_branch_id_date_idx" ON "pickup_logs"("branch_id", "date");

ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pickup_logs" ADD CONSTRAINT "pickup_logs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pickup_logs" ADD CONSTRAINT "pickup_logs_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;
