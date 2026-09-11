-- Xodimlar davomati: kelish/ketish vaqti
ALTER TABLE "employee_attendances" ADD COLUMN "check_in_time" TEXT;
ALTER TABLE "employee_attendances" ADD COLUMN "check_out_time" TEXT;

-- Ish haqi: soliq/sug'urta kabi rasmiy ushlab qolish (jarimadan alohida)
ALTER TABLE "payroll_entries" ADD COLUMN "deduction_amount" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- Taomlar katalogi
CREATE TABLE "dishes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "calories" INTEGER,
    "allergens" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dishes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "dishes_organization_id_name_key" ON "dishes"("organization_id", "name");

ALTER TABLE "dishes" ADD CONSTRAINT "dishes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
