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

    const baseRun = await prisma.snapshotRun.findUnique({
        where: { id: baseRunId },
        include: { pages: true },
    });
    // console.log(baseRun);
    const targetRun = await prisma.snapshotRun.findUnique({
        where: { id: targetRunId },
        include: { pages: true },
    });
    // console.log(targetRun)
    if (!baseRun || !targetRun) {
        console.log("found")
        throw new Error("Run not found");
    }

    // Create folder name with timestamps
    const baseTimestamp = baseRun.createdAt.getTime();
    const targetTimestamp = targetRun.createdAt.getTime();
    const folderName = `${baseTimestamp}_vs_${targetTimestamp}`;
    console.log("folderName", folderName)
    for (const targetPage of targetRun.pages) {
        // console.log(targetPage)
        const basePage = baseRun.pages.find(
            (p) => p.pageUrl === targetPage.pageUrl
        );
        // console.log("basePage", basePage)
        if (!basePage) continue;

        const diffPath = path.join(
            process.cwd(),
            "public",
            "diff",
            storeId,
            folderName,
            `${targetPage.pageName}.png`
        );
        console.log("diffPath", diffPath)
        const baselineFsPath = path.join(
            process.cwd(),
            "public",
            basePage.imagePath
        );
        console.log("baselineFsPath", baselineFsPath)
        const currentFsPath = path.join(
            process.cwd(),
            "public",
            targetPage.imagePath
        );
        console.log("currentFsPath", currentFsPath)
        await fs.mkdir(path.dirname(diffPath), { recursive: true });
        const result = await compareImages(
            baselineFsPath,
            currentFsPath,
            diffPath
        );

        await prisma.snapshotComparison.create({
            data: {
                storeId,
                baseRunId,
                basePageId: basePage.id,
                targetRunId,
                targetPageId: targetPage.id,
                isDifferent: result.mismatch > DIFF_THRESHOLD,
                diffScore: result.mismatch,
                diffImagePath:
                    result.mismatch > DIFF_THRESHOLD ? diffPath : null,
            },
        });
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
    const baseRun = await prisma.snapshotRun.findUnique({
        where: { id: baseRunId },
    });

    const targetRun = await prisma.snapshotRun.findUnique({
        where: { id: targetRunId },
    });

    if (!baseRun || !targetRun) {
        throw new Error("Run not found");
    }

    // Create folder name with timestamps
    const baseTimestamp = baseRun.createdAt.getTime();
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

    const diffPath = path.join(
        process.cwd(),
        "public",
        "diff",
        storeId,
        folderName,
        `${pageName}.png`
    );

    const result = await compareImages(
        baselineFsPath,
        currentFsPath,
        diffPath
    );

    // Save comparison result to database
    const page = await prisma.snapshotPage.findUnique({
        where: { id: pageId },
    });

    if (!page) {
        throw new Error("Page not found");
    }

    // Find the baseline page
    const baselinePage = await prisma.snapshotPage.findFirst({
        where: {
            snapshotRunId: baseRunId,
            pageUrl: page.pageUrl,
        },
    });

    if (!baselinePage) {
        throw new Error("Baseline page not found");
    }

    // Check if comparison already exists
    const existingComparison = await prisma.snapshotComparison.findFirst({
        where: {
            basePageId: baselinePage.id,
            targetPageId: pageId,
        },
    });

    if (existingComparison) {
        // Update existing comparison
        await prisma.snapshotComparison.update({
            where: { id: existingComparison.id },
            data: {
                isDifferent: result.mismatch > DIFF_THRESHOLD,
                diffScore: result.mismatch,
                diffImagePath: result.mismatch > DIFF_THRESHOLD ? diffPath : null,
            },
        });
    } else {
        // Create new comparison
        await prisma.snapshotComparison.create({
            data: {
                storeId,
                baseRunId,
                basePageId: baselinePage.id,
                targetRunId,
                targetPageId: pageId,
                isDifferent: result.mismatch > DIFF_THRESHOLD,
                diffScore: result.mismatch,
                diffImagePath: result.mismatch > DIFF_THRESHOLD ? diffPath : null,
            },
        });
    }

    return {
        mismatch: result.mismatch,
        isDifferent: result.mismatch > DIFF_THRESHOLD,
        diffPath: result.mismatch > DIFF_THRESHOLD ? `/diff/${storeId}/${folderName}/${pageName}.png` : null,
    };
}
