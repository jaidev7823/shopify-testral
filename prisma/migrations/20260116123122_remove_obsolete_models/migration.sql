/*
  Warnings:

  - You are about to drop the `SnapshotAnchor` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SnapshotBaseline` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `comparedWithId` on the `SnapshotRun` table. All the data in the column will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "SnapshotAnchor";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "SnapshotBaseline";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SnapshotComparison" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "baseRunId" TEXT,
    "basePageId" TEXT,
    "targetRunId" TEXT NOT NULL,
    "targetPageId" TEXT NOT NULL,
    "isDifferent" BOOLEAN NOT NULL,
    "diffScore" REAL,
    "diffImagePath" TEXT,
    "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "approvedAt" DATETIME,
    "rejectionReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_SnapshotComparison" ("approvalStatus", "approvedAt", "approvedBy", "basePageId", "baseRunId", "createdAt", "diffImagePath", "diffScore", "id", "isDifferent", "rejectionReason", "storeId", "targetPageId", "targetRunId") SELECT "approvalStatus", "approvedAt", "approvedBy", "basePageId", "baseRunId", "createdAt", "diffImagePath", "diffScore", "id", "isDifferent", "rejectionReason", "storeId", "targetPageId", "targetRunId" FROM "SnapshotComparison";
DROP TABLE "SnapshotComparison";
ALTER TABLE "new_SnapshotComparison" RENAME TO "SnapshotComparison";
CREATE TABLE "new_SnapshotRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "snapshotKey" TEXT NOT NULL,
    "errorMessage" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "compareStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_SnapshotRun" ("compareStatus", "createdAt", "errorMessage", "id", "snapshotKey", "status", "storeId") SELECT "compareStatus", "createdAt", "errorMessage", "id", "snapshotKey", "status", "storeId" FROM "SnapshotRun";
DROP TABLE "SnapshotRun";
ALTER TABLE "new_SnapshotRun" RENAME TO "SnapshotRun";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
