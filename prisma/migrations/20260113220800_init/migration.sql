/*
  Warnings:

  - You are about to drop the `Build` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MonitoredPage` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Snapshot` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Build";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "MonitoredPage";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Snapshot";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "SnapshotRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "snapshotKey" TEXT NOT NULL,
    "errorMessage" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SnapshotPage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "snapshotRunId" TEXT NOT NULL,
    "pageName" TEXT NOT NULL,
    "pageUrl" TEXT NOT NULL,
    "imagePath" TEXT NOT NULL,
    CONSTRAINT "SnapshotPage_snapshotRunId_fkey" FOREIGN KEY ("snapshotRunId") REFERENCES "SnapshotRun" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SnapshotAnchor" (
    "storeId" TEXT NOT NULL PRIMARY KEY,
    "snapshotRunId" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
