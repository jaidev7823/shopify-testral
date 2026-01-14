-- CreateTable
CREATE TABLE "SnapshotComparison" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "baseRunId" TEXT NOT NULL,
    "basePageId" TEXT NOT NULL,
    "targetRunId" TEXT NOT NULL,
    "targetPageId" TEXT NOT NULL,
    "isDifferent" BOOLEAN NOT NULL,
    "diffScore" REAL,
    "diffImagePath" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SnapshotBaseline" (
    "storeId" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true
);
