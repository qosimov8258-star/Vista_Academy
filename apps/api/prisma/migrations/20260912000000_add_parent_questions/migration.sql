-- CreateTable
CREATE TABLE "parent_questions" (
    "id" TEXT NOT NULL,
    "topic_id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parent_questions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "parent_questions_topic_id_idx" ON "parent_questions"("topic_id");

-- AddForeignKey
ALTER TABLE "parent_questions" ADD CONSTRAINT "parent_questions_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "lesson_topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
