-- CreateTable
CREATE TABLE "employee_topics" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_topics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employee_topics_employee_id_idx" ON "employee_topics"("employee_id");

-- AddForeignKey
ALTER TABLE "employee_topics" ADD CONSTRAINT "employee_topics_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
