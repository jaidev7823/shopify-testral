-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SnapshotRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "snapshotKey" TEXT NOT NULL,
    "errorMessage" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "compareStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "comparedWithId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_SnapshotRun" ("createdAt", "errorMessage", "id", "snapshotKey", "status", "storeId") SELECT "createdAt", "errorMessage", "id", "snapshotKey", "status", "storeId" FROM "SnapshotRun";
DROP TABLE "SnapshotRun";
ALTER TABLE "new_SnapshotRun" RENAME TO "SnapshotRun";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
