-- CreateTable
CREATE TABLE "PageBaseline" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "pageName" TEXT NOT NULL,
    "pageUrl" TEXT NOT NULL,
    "snapshotPageId" TEXT NOT NULL,
    "imagePath" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "PageBaseline_storeId_pageName_key" ON "PageBaseline"("storeId", "pageName");
