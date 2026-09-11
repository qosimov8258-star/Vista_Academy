-- CreateEnum
CREATE TYPE "Weekday" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateTable
CREATE TABLE "rooms" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_schedules" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "subject" TEXT,
    "weekday" "Weekday" NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lesson_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_topics" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "subject" TEXT,
    "title" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lesson_topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topic_questions" (
    "id" TEXT NOT NULL,
    "topic_id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "answer" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "topic_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_grades" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "topic_id" TEXT,
    "date" DATE NOT NULL,
    "score" INTEGER NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lesson_grades_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rooms_branch_id_idx" ON "rooms"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_branch_id_name_key" ON "rooms"("branch_id", "name");

-- CreateIndex
CREATE INDEX "lesson_schedules_branch_id_idx" ON "lesson_schedules"("branch_id");

-- CreateIndex
CREATE INDEX "lesson_schedules_group_id_idx" ON "lesson_schedules"("group_id");

-- CreateIndex
CREATE INDEX "lesson_schedules_employee_id_idx" ON "lesson_schedules"("employee_id");

-- CreateIndex
CREATE INDEX "lesson_schedules_room_id_weekday_idx" ON "lesson_schedules"("room_id", "weekday");

-- CreateIndex
CREATE INDEX "lesson_topics_branch_id_idx" ON "lesson_topics"("branch_id");

-- CreateIndex
CREATE INDEX "lesson_topics_group_id_date_idx" ON "lesson_topics"("group_id", "date");

-- CreateIndex
CREATE INDEX "topic_questions_topic_id_idx" ON "topic_questions"("topic_id");

-- CreateIndex
CREATE INDEX "lesson_grades_branch_id_date_idx" ON "lesson_grades"("branch_id", "date");

-- CreateIndex
CREATE INDEX "lesson_grades_group_id_idx" ON "lesson_grades"("group_id");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_grades_child_id_date_key" ON "lesson_grades"("child_id", "date");

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_schedules" ADD CONSTRAINT "lesson_schedules_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_schedules" ADD CONSTRAINT "lesson_schedules_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_schedules" ADD CONSTRAINT "lesson_schedules_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_schedules" ADD CONSTRAINT "lesson_schedules_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_topics" ADD CONSTRAINT "lesson_topics_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_topics" ADD CONSTRAINT "lesson_topics_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_topics" ADD CONSTRAINT "lesson_topics_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_questions" ADD CONSTRAINT "topic_questions_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "lesson_topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_grades" ADD CONSTRAINT "lesson_grades_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_grades" ADD CONSTRAINT "lesson_grades_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_grades" ADD CONSTRAINT "lesson_grades_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_grades" ADD CONSTRAINT "lesson_grades_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_grades" ADD CONSTRAINT "lesson_grades_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "lesson_topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

