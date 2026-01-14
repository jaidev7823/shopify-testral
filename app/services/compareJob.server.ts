import path from "path";
import { prisma } from "~/utils/prisma.server";
import { compareImages } from "~/services/compareImages.server";

const DIFF_THRESHOLD = 0.3;

export async function runCompareJob(
    storeId: string,
    baseRunId: string,
    targetRunId: string
) {
    const baseRun = await prisma.snapshotRun.findUnique({
        where: { id: baseRunId },
        include: { pages: true },
    });

    const targetRun = await prisma.snapshotRun.findUnique({
        where: { id: targetRunId },
        include: { pages: true },
    });

    if (!baseRun || !targetRun) {
        throw new Error("Run not found");
    }

    for (const targetPage of targetRun.pages) {
        const basePage = baseRun.pages.find(
            (p) => p.pageUrl === targetPage.pageUrl
        );

        if (!basePage) continue;

        const diffPath = path.join(
            process.cwd(),
            "diffs",
            storeId,
            `${baseRunId}_vs_${targetRunId}`,
            `${targetPage.pageName}.png`
        );

        const baselineFsPath = path.join(
            process.cwd(),
            "public",
            basePage.imagePath
        );

        const currentFsPath = path.join(
            process.cwd(),
            "public",
            targetPage.imagePath
        );

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
