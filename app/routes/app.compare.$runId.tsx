import fs from "fs/promises";
import path from "path";
// routes/app.compare.$runId.tsx
import { authenticate } from "~/shopify.server";
import { prisma } from "~/utils/prisma.server";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useFetcher } from "react-router";
import { getSnapshotImageUrl } from "~/utils/snapshotImage";
import { runCompareJob } from "~/services/compareJob.server";
import path from "path";

import CompareLayout from "~/components/compare/CompareLayout";
import { useEffect } from "react";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {

    const { session } = await authenticate.admin(request);
    const runId = params.runId;
    const comparisons = await prisma.snapshotComparison.findMany({
        where: {
            targetRunId: runId,
        },
    });
    const comparisonByTargetPageId = new Map(
        comparisons.map(c => [c.targetPageId, c])
    );

    if (!runId) {
        throw new Response("Run not found", { status: 404 });
    }

    const run = await prisma.snapshotRun.findUnique({
        where: { id: runId },
        include: {
            pages: {
                orderBy: { pageName: "asc" },
            },
        },
    });

    if (!run || run.storeId !== session.shop) {
        throw new Response("Not found", { status: 404 });
    }

    // Fetch active baselines for this store
    const pageBaselines = await prisma.pageBaseline.findMany({
        where: { storeId: session.shop }
    });

    const baselinePages: any[] = []; // Legacy fallback disabled/removed

    // Fetch all comparisons for this run
    const comparisons = await prisma.snapshotComparison.findMany({
        where: {
            targetRunId: runId,
        },
    });

    const pages = run.pages.map((page) => {
        const pageBaseline = pageBaselines.find(b => b.pageName === page.pageName);
        const legacyBaselinePage = baselinePages.find((p) => p.pageUrl === page.pageUrl);

        let baselineImage = null;

        if (pageBaseline) {
            // Use the Gold Master image path directly
            baselineImage = pageBaseline.imagePath;
        } else if (legacyBaselinePage?.imagePath) {
            baselineImage = getSnapshotImageUrl({
                storeId: session.shop,
                type: "baseline",
                filename: legacyBaselinePage.imagePath,
            });
        }

        const currentImage = getSnapshotImageUrl({
            storeId: session.shop,
            type: "baseline", // do not change this let it be baseline
            filename: page.imagePath,
        });

        // Find comparison data for this page
        const comparison = comparisons.find((c) => c.targetPageId === page.id);

        return {
            id: page.id,
            pageName: page.pageName,
            pageUrl: page.pageUrl,
            comparison: comparison
                ? {
                    isDifferent: comparison.isDifferent,
                    diffScore: comparison.diffScore,
                }
                : null,
            images: {
                baseline: baselineImage,
                current: currentImage,
            },
            comparison: comparison ? {
                id: comparison.id,
                isDifferent: comparison.isDifferent,
                diffScore: comparison.diffScore,
                diffImagePath: comparison.diffImagePath,
                approvalStatus: comparison.approvalStatus,
                approvedBy: comparison.approvedBy,
                approvedAt: comparison.approvedAt,
            } : null,
        };
    });
    const hasBaseline = pageBaselines.length > 0;

    // Auto-retry comparison if failed but baselines exist
    if (
        hasBaseline &&
        run.compareStatus === "FAILED" &&
        (run.status === "COMPLETED" || run.status === "APPROVED")
    ) {
        await prisma.snapshotRun.update({
            where: { id: runId },
            data: {
                compareStatus: "IN_PROGRESS",
            },
        });

        runCompareJob(
            session.shop,
            "legacy-placeholder",
            runId
        ).catch(async (e) => {
            console.error("Compare failed", e);
            await prisma.snapshotRun.update({
                where: { id: runId },
                data: { compareStatus: "FAILED" },
            });
        });
    }

    return {
        pages,
        run,
        hasBaseline,
    };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
    const { session } = await authenticate.admin(request);
    const runId = params.runId;

    if (!runId) {
        throw new Response("Run not found", { status: 404 });
    }

    const run = await prisma.snapshotRun.findUnique({
        where: { id: runId },
    });

    if (!run || run.storeId !== session.shop) {
        throw new Response("Not found", { status: 404 });
    }

    const formData = await request.formData();
    const actionType = formData.get("action");

    // Handle page approval
    if (actionType === "approve") {
        const comparisonId = formData.get("comparisonId") as string;
        console.log("Approve action triggered for comparison:", comparisonId);

        // 1. Get the comparison and the target page (the new approved image)
        const comparison = await prisma.snapshotComparison.findUnique({
            where: { id: comparisonId }
        });

        if (!comparison) {
            console.error("Comparison not found:", comparisonId);
            return { ok: false, error: "Comparison not found" };
        }

        const targetPage = await prisma.snapshotPage.findUnique({
            where: { id: comparison.targetPageId }
        });

        if (!targetPage) {
            console.error("Target page not found:", comparison.targetPageId);
            return { ok: false, error: "Target page not found" };
        }

        // 2. Define baseline paths
        // Source: public/snapshots/.../page.png (stored in targetPage.imagePath)
        const sourcePath = path.join(process.cwd(), "public", targetPage.imagePath);

        // Destination: public/baselines/{storeId}/{pageName}.png
        const baselineDir = path.join(process.cwd(), "public", "baselines", session.shop);
        const baselineFilename = `${targetPage.pageName}.png`;
        const baselinePath = path.join(baselineDir, baselineFilename);
        const baselineWebPath = `/baselines/${session.shop}/${baselineFilename}`;

        console.log("Source path:", sourcePath);
        console.log("Baseline path:", baselinePath);

        // 3. Copy file (Create "Gold Master")
        try {
            await fs.mkdir(baselineDir, { recursive: true });
            await fs.copyFile(sourcePath, baselinePath);
            console.log("File copied successfully");
        } catch (error) {
            console.error("Failed to copy baseline image:", error);
            return { ok: false, error: "Failed to save baseline image" };
        }

        // 4. Update/Create PageBaseline record
        try {
            console.log("Upserting PageBaseline for:", session.shop, targetPage.pageName);
            const baseline = await prisma.pageBaseline.upsert({
                where: {
                    storeId_pageName: {
                        storeId: session.shop,
                        pageName: targetPage.pageName
                    }
                },
                update: {
                    snapshotPageId: targetPage.id,
                    imagePath: baselineWebPath,
                    pageUrl: targetPage.pageUrl // Ensure URL is current
                },
                create: {
                    storeId: session.shop,
                    pageName: targetPage.pageName,
                    pageUrl: targetPage.pageUrl,
                    snapshotPageId: targetPage.id,
                    imagePath: baselineWebPath
                }
            });
            console.log("PageBaseline upserted:", baseline.id);
        } catch (error) {
            console.error("Failed to upsert PageBaseline:", error);
            // Don't fail the whole request, but log it
        }

        // 5. Revoke previous approvals for this page
        // Find all pages with this name in this store's runs to identify relevant comparisons.
        const samePageNamePages = await prisma.snapshotPage.findMany({
            where: {
                pageName: targetPage.pageName,
                snapshotRun: {
                    storeId: session.shop
                }
            },
            select: { id: true }
        });

        const samePageIds = samePageNamePages.map(p => p.id);

        if (samePageIds.length > 0) {
            await prisma.snapshotComparison.updateMany({
                where: {
                    targetPageId: { in: samePageIds },
                    approvalStatus: "APPROVED",
                    NOT: { id: comparisonId }
                },
                data: {
                    approvalStatus: "PENDING"
                }
            });
        }

        // 6. Mark comparison as approved
        await prisma.snapshotComparison.update({
            where: { id: comparisonId },
            data: {
                approvalStatus: "APPROVED",
                approvedBy: session.shop,
                approvedAt: new Date(),
            },
        });

        return { ok: true, action: "approved" };
    }

    // Handle page rejection
    if (actionType === "reject") {
        const comparisonId = formData.get("comparisonId") as string;
        const rejectionReason = formData.get("rejectionReason") as string | null;

        await prisma.snapshotComparison.update({
            where: { id: comparisonId },
            data: {
                approvalStatus: "REJECTED",
                approvedBy: session.shop,
                approvedAt: new Date(),
                rejectionReason: rejectionReason || undefined,
            },
        });

        return { ok: true, action: "rejected" };
    }

    // Handle individual page comparison
    if (actionType === "compare") {
        const pageId = formData.get("pageId") as string;
        const pageName = formData.get("pageName") as string;
        const baselineImage = formData.get("baselineImage") as string;
        const currentImage = formData.get("currentImage") as string;

        const anchor = await prisma.snapshotAnchor.findUnique({
            where: { storeId: session.shop },
        });

        if (!anchor) {
            return { ok: false, error: "No baseline set" };
        }

        // Import the comparison service
        const { compareSinglePage } = await import("~/services/compareJob.server");

        try {
            const result = await compareSinglePage({
                storeId: session.shop,
                baseRunId: anchor.snapshotRunId,
                targetRunId: runId,
                pageId,
                pageName,
                baselineImage,
                currentImage,
            });

            return { ok: true, result };
        } catch (error) {
            console.error("Comparison error:", error);
            return { ok: false, error: "Comparison failed" };
        }
    }

    // Handle full run comparison (existing logic)
    const anchor = await prisma.snapshotAnchor.findUnique({
        where: { storeId: session.shop },
    });

    if (!anchor) {
        return { ok: false, error: "No baseline set" };
    }

    // 1️⃣ mark run as in progress
    await prisma.snapshotRun.update({
        where: { id: runId },
        data: {
            compareStatus: "IN_PROGRESS",
            comparedWithId: anchor.snapshotRunId,
        },
    });

    // 2️⃣ fire background compare job (THIS PART)
    runCompareJob(
        session.shop,
        anchor.snapshotRunId,
        runId
    ).catch(async () => {
        await prisma.snapshotRun.update({
            where: { id: runId },
            data: { compareStatus: "FAILED" },
        });
    });

    // 3️⃣ return immediately
    return { ok: true };
};

export default function CompareRunPage() {
    const initialLoaderData = useLoaderData<typeof loader>();
    const fetcher = useFetcher<typeof loader>();

    const { pages, run, hasBaseline } = fetcher.data || initialLoaderData;

    const isComparing = run.compareStatus === "IN_PROGRESS";

    useEffect(() => {
        if (!isComparing) return;

        const interval = setInterval(() => {
            fetcher.load(window.location.pathname);
        }, 3000); // Poll every 3 seconds

        return () => clearInterval(interval);
    }, [isComparing, fetcher]);


    return <CompareLayout pages={pages} run={run} hasBaseline={hasBaseline} />;
}
