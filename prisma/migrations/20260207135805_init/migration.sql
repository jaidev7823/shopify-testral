-- CreateEnum
CREATE TYPE "SnapshotStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'APPROVED', 'REGRESSION');

-- CreateEnum
CREATE TYPE "CompareStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'AUTO_APPROVED');

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    "refreshToken" TEXT,
    "refreshTokenExpires" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SnapshotRun" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "snapshotKey" TEXT NOT NULL,
    "errorMessage" TEXT,
    "status" "SnapshotStatus" NOT NULL DEFAULT 'PENDING',
    "compareStatus" "CompareStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SnapshotRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SnapshotPage" (
    "id" TEXT NOT NULL,
    "snapshotRunId" TEXT NOT NULL,
    "pageName" TEXT NOT NULL,
    "pageUrl" TEXT NOT NULL,
    "imagePath" TEXT NOT NULL,

    CONSTRAINT "SnapshotPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SnapshotComparison" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "baseRunId" TEXT,
    "basePageId" TEXT,
    "targetRunId" TEXT NOT NULL,
    "targetPageId" TEXT NOT NULL,
    "isDifferent" BOOLEAN NOT NULL,
    "diffScore" DOUBLE PRECISION,
    "diffImagePath" TEXT,
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SnapshotComparison_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageBaseline" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "pageName" TEXT NOT NULL,
    "pageUrl" TEXT NOT NULL,
    "snapshotPageId" TEXT NOT NULL,
    "imagePath" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PageBaseline_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PageBaseline_storeId_pageName_key" ON "PageBaseline"("storeId", "pageName");

-- AddForeignKey
ALTER TABLE "SnapshotPage" ADD CONSTRAINT "SnapshotPage_snapshotRunId_fkey" FOREIGN KEY ("snapshotRunId") REFERENCES "SnapshotRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
