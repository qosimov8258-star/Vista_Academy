-- CreateEnum
CREATE TYPE "LandingScheduleType" AS ENUM ('LESSON', 'SLEEP', 'MEAL', 'OTHER');

-- CreateEnum
CREATE TYPE "LandingMealType" AS ENUM ('BREAKFAST', 'LUNCH', 'SNACK', 'DINNER', 'OTHER');

-- CreateTable
CREATE TABLE "landing_schedule_items" (
    "id" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "LandingScheduleType" NOT NULL DEFAULT 'OTHER',
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "landing_schedule_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "landing_meals" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "meal_type" "LandingMealType" NOT NULL DEFAULT 'OTHER',
    "photo_path" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "landing_meals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "landing_teachers" (
    "id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "bio" TEXT,
    "photo_path" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "landing_teachers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "landing_content_blocks" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "photo_path" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "landing_content_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "landing_content_blocks_key_key" ON "landing_content_blocks"("key");
