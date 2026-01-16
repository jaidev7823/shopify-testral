import path from "path";
import { prisma } from "~/utils/prisma.server";
import { compareImages } from "~/services/compareImages.server";
import fs from "fs/promises";
const DIFF_THRESHOLD = 0.01;

export async function runCompareJob(
    storeId: string,
    baseRunId: string,
    targetRunId: string
) {
    console.log(baseRunId, "vs", targetRunId);

    let baseRun = null;
    if (baseRunId !== "legacy-placeholder") {
        baseRun = await prisma.snapshotRun.findUnique({
            where: { id: baseRunId },
            include: { pages: true },
        });
    }

    const targetRun = await prisma.snapshotRun.findUnique({
        where: { id: targetRunId },
        include: { pages: true },
    });

    if (!targetRun || (baseRunId !== "legacy-placeholder" && !baseRun)) {
        throw new Error("Run not found");
    }

    // Create folder name with timestamps
    const baseTimestamp = baseRun ? baseRun.createdAt.getTime() : "gold_master";
    const targetTimestamp = targetRun.createdAt.getTime();
    const folderName = `${baseTimestamp}_vs_${targetTimestamp}`;
    console.log("folderName", folderName)

    // Fetch active baselines for this store
    console.log(`Fetching baselines for store: ${storeId}`);
    const pageBaselines = await prisma.pageBaseline.findMany({
        where: { storeId }
    });
    console.log(`Found ${pageBaselines.length} baselines`);

    for (const targetPage of targetRun.pages) {
        // 1. Try to find a "Gold Master" baseline
        const baseline = pageBaselines.find(b => b.pageName === targetPage.pageName);
        console.log(`Processing page: ${targetPage.pageName}. Baseline found: ${!!baseline}`);

        let baselineFsPath: string;
        let basePageId: string;
        let effectiveBaseRunId: string;

        if (baseline) {
            baselineFsPath = path.join(process.cwd(), "public", baseline.imagePath);
            basePageId = baseline.snapshotPageId;
            effectiveBaseRunId = baseRunId; // Keep legacy run ID for reference, or could be empty
        } else {
            // No baseline found for this page.
            // In strict Gold Master mode, we skip comparison or mark it as "No Baseline"
            console.log(`No baseline found for ${targetPage.pageName}. Skipping comparison.`);
            continue;
        }

        // Filesystem path (where to write the file)
        const diffFsPath = path.join(
            process.cwd(),
            "public",
            "diff",
            storeId,
            folderName,
            `${targetPage.pageName}.png`
        );

        // Web-accessible path (for database and URLs)
        const diffWebPath = `/diff/${storeId}/${folderName}/${targetPage.pageName}.png`;

        const currentFsPath = path.join(
            process.cwd(),
            "public",
            targetPage.imagePath
        );

        console.log("Comparing:", targetPage.pageName);
        console.log("Baseline:", baselineFsPath);
        console.log("Current:", currentFsPath);

        try {
            await fs.mkdir(path.dirname(diffFsPath), { recursive: true });

            const result = await compareImages(
                baselineFsPath,
                currentFsPath,
                diffFsPath
            );

            const isDifferent = result.mismatch > DIFF_THRESHOLD;
            const approvalStatus = isDifferent ? "PENDING" : "AUTO_APPROVED";

            await prisma.snapshotComparison.create({
                data: {
                    storeId,
                    baseRunId: effectiveBaseRunId,
                    basePageId,
                    targetRunId,
                    targetPageId: targetPage.id,
                    isDifferent,
                    diffScore: result.mismatch,
                    diffImagePath:
                        isDifferent ? diffWebPath : null,
                    approvalStatus: approvalStatus as any,
                },
            });
        } catch (err) {
            console.error(`Error comparing page ${targetPage.pageName}:`, err);
        }
    }

    await prisma.snapshotRun.update({
        where: { id: targetRunId },
        data: { compareStatus: "COMPLETED" },
    });
}

export async function compareSinglePage({
    storeId,
    baseRunId,
    targetRunId,
    pageId,
    pageName,
    baselineImage,
    currentImage,
}: {
    storeId: string;
    baseRunId: string;
    targetRunId: string;
    pageId: string;
    pageName: string;
    baselineImage: string;
    currentImage: string;
}) {
    // Get run timestamps
    let baseRun = null;
    if (baseRunId !== "legacy-placeholder" && baseRunId !== "gold-master") {
        baseRun = await prisma.snapshotRun.findUnique({
            where: { id: baseRunId },
        });
    }

    const targetRun = await prisma.snapshotRun.findUnique({
        where: { id: targetRunId },
    });

    if (!targetRun) {
        throw new Error("Run not found");
    }

    // Create folder name with timestamps
    const baseTimestamp = baseRun ? baseRun.createdAt.getTime() : "gold_master";
    const targetTimestamp = targetRun.createdAt.getTime();
    const folderName = `${baseTimestamp}_vs_${targetTimestamp}`;

    // Extract the actual file paths from the URLs
    // URLs are like: /snapshots/store-id/baseline/filename.png
    const extractPath = (url: string) => {
        const urlObj = new URL(url, "http://localhost");
        return urlObj.pathname.replace(/^\//, ""); // Remove leading slash
    };

    const baselinePath = extractPath(baselineImage);
    const currentPath = extractPath(currentImage);

    const baselineFsPath = path.join(process.cwd(), "public", baselinePath);
    const currentFsPath = path.join(process.cwd(), "public", currentPath);

    // Filesystem path (where to write the file)
    const diffFsPath = path.join(
        process.cwd(),
        "public",
        "diff",
        storeId,
        folderName,
        `${pageName}.png`
    );

    // Web-accessible path (for database and URLs)
    const diffWebPath = `/diff/${storeId}/${folderName}/${pageName}.png`;

    // Create directory if it doesn't exist
    await fs.mkdir(path.dirname(diffFsPath), { recursive: true });

    const result = await compareImages(
        baselineFsPath,
        currentFsPath,
        diffFsPath
    );

    // Save comparison result to database
    const page = await prisma.snapshotPage.findUnique({
        where: { id: pageId },
    });

    if (!page) {
        throw new Error("Page not found");
    }

    // Find the Gold Master baseline
    const pageBaseline = await prisma.pageBaseline.findUnique({
        where: {
            storeId_pageName: {
                storeId,
                pageName: page.pageName
            }
        }
    });

    if (!pageBaseline) {
        throw new Error("Baseline (Gold Master) not found for this page");
    }

    const basePageId = pageBaseline.snapshotPageId;
    const effectiveBaseRunId = "gold-master"; // Or null, as schema allows optional

    // Check if comparison already exists
    const existingComparison = await prisma.snapshotComparison.findFirst({
        where: {
            basePageId: basePageId,
            targetPageId: pageId,
        },
    });

    const isDifferent = result.mismatch > DIFF_THRESHOLD;
    const approvalStatus = isDifferent ? "PENDING" : "AUTO_APPROVED";

    if (existingComparison) {
        // Update existing comparison
        await prisma.snapshotComparison.update({
            where: { id: existingComparison.id },
            data: {
                isDifferent,
                diffScore: result.mismatch,
                diffImagePath: isDifferent ? diffWebPath : null,
                approvalStatus: approvalStatus as any,
            },
        });
    } else {
        // Create new comparison
        await prisma.snapshotComparison.create({
            data: {
                storeId,
                baseRunId: effectiveBaseRunId,
                basePageId: basePageId,
                targetRunId,
                targetPageId: pageId,
                isDifferent,
                diffScore: result.mismatch,
                diffImagePath: isDifferent ? diffWebPath : null,
                approvalStatus: approvalStatus as any,
            },
        });
    }

    return {
        mismatch: result.mismatch,
        isDifferent: result.mismatch > DIFF_THRESHOLD,
        diffPath: result.mismatch > DIFF_THRESHOLD ? diffWebPath : null,
    };
}