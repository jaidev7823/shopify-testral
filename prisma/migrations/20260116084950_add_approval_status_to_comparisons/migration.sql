/*
  Warnings:

  - You are about to drop the column `isApproved` on the `SnapshotComparison` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SnapshotComparison" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "baseRunId" TEXT NOT NULL,
    "basePageId" TEXT NOT NULL,
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
INSERT INTO "new_SnapshotComparison" ("basePageId", "baseRunId", "createdAt", "diffImagePath", "diffScore", "id", "isDifferent", "storeId", "targetPageId", "targetRunId") SELECT "basePageId", "baseRunId", "createdAt", "diffImagePath", "diffScore", "id", "isDifferent", "storeId", "targetPageId", "targetRunId" FROM "SnapshotComparison";
DROP TABLE "SnapshotComparison";
ALTER TABLE "new_SnapshotComparison" RENAME TO "SnapshotComparison";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
