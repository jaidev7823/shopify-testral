/*
  Warnings:

  - You are about to drop the `SnapshotAnchor` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SnapshotPage` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SnapshotRun` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "SnapshotAnchor";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "SnapshotPage";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "SnapshotRun";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "MonitoredPage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "currentBaselinePath" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Build" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Snapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "buildId" TEXT NOT NULL,
    "monitoredPageId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "currentPath" TEXT NOT NULL,
    "baselinePath" TEXT,
    "diffPath" TEXT,
    "mismatchScore" REAL,
    CONSTRAINT "Snapshot_buildId_fkey" FOREIGN KEY ("buildId") REFERENCES "Build" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Snapshot_monitoredPageId_fkey" FOREIGN KEY ("monitoredPageId") REFERENCES "MonitoredPage" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "MonitoredPage_storeId_url_key" ON "MonitoredPage"("storeId", "url");
