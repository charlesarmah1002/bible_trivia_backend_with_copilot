/*
  Warnings:

  - A unique constraint covering the columns `[gameId,gameQuestionId]` on the table `GameAnswer` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "GameAnswer_gameId_gameQuestionId_key" ON "GameAnswer"("gameId", "gameQuestionId");
