/*
  Warnings:

  - You are about to drop the `msg` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "msg";

-- CreateTable
CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),

    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);
