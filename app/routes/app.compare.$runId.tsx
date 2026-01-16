// routes/app.compare.$runId.tsx
import { authenticate } from "~/shopify.server";
import { prisma } from "~/utils/prisma.server";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useFetcher } from "react-router";
import { getSnapshotImageUrl } from "~/utils/snapshotImage";
import { runCompareJob } from "~/services/compareJob.server";
import fs from "fs/promises";
import path from "path"; // Combined imports here
import CompareLayout from "~/components/compare/CompareLayout";
import { useEffect } from "react";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
    const { session } = await authenticate.admin(request);
    const runId = params.runId;

    if (!runId) {
        throw new Response("Run not found", { status: 404 });
    }

    // 1. Fetch all comparisons for this run once
    const comparisons = await prisma.snapshotComparison.findMany({
        where: { targetRunId: runId },
    });

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

    const pages = run.pages.map((page) => {
        const pageBaseline = pageBaselines.find(b => b.pageName === page.pageName);

        let baselineImage = null;
        if (pageBaseline) {
            baselineImage = pageBaseline.imagePath;
        }

        const currentImage = getSnapshotImageUrl({
            storeId: session.shop,
            type: "baseline",
            filename: page.imagePath,
        });

        // Find comparison data for this page
        const comparison = comparisons.find((c) => c.targetPageId === page.id);

        return {
            id: page.id,
            pageName: page.pageName,
            pageUrl: page.pageUrl,
            images: {
                baseline: baselineImage,
                current: currentImage,
            },
            // MERGED: Only one comparison property allowed
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

    // Auto-retry comparison logic
    if (
        hasBaseline &&
        run.compareStatus === "FAILED" &&
        (run.status === "COMPLETED" || run.status === "APPROVED")
    ) {
        await prisma.snapshotRun.update({
            where: { id: runId },
            data: { compareStatus: "IN_PROGRESS" },
        });

        runCompareJob(session.shop, "legacy-placeholder", runId).catch(async (e) => {
            console.error("Compare failed", e);
            await prisma.snapshotRun.update({
                where: { id: runId },
                data: { compareStatus: "FAILED" },
            });
        });
    }

    return { pages, run, hasBaseline };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
    const { session } = await authenticate.admin(request);
    const runId = params.runId;

    if (!runId) throw new Response("Run not found", { status: 404 });

    const run = await prisma.snapshotRun.findUnique({ where: { id: runId } });
    if (!run || run.storeId !== session.shop) throw new Response("Not found", { status: 404 });

    const formData = await request.formData();
    const actionType = formData.get("action");

    if (actionType === "approve") {
        const comparisonId = formData.get("comparisonId") as string;
        const comparison = await prisma.snapshotComparison.findUnique({ where: { id: comparisonId } });
        if (!comparison) return { ok: false, error: "Comparison not found" };

        const targetPage = await prisma.snapshotPage.findUnique({ where: { id: comparison.targetPageId } });
        if (!targetPage) return { ok: false, error: "Target page not found" };

        const sourcePath = path.join(process.cwd(), "public", targetPage.imagePath);
        const baselineDir = path.join(process.cwd(), "public", "baselines", session.shop);
        const baselineFilename = `${targetPage.pageName}.png`;
        const baselinePath = path.join(baselineDir, baselineFilename);
        const baselineWebPath = `/baselines/${session.shop}/${baselineFilename}`;

        try {
            await fs.mkdir(baselineDir, { recursive: true });
            await fs.copyFile(sourcePath, baselinePath);

            await prisma.pageBaseline.upsert({
                where: { storeId_pageName: { storeId: session.shop, pageName: targetPage.pageName } },
                update: { snapshotPageId: targetPage.id, imagePath: baselineWebPath, pageUrl: targetPage.pageUrl },
                create: { storeId: session.shop, pageName: targetPage.pageName, pageUrl: targetPage.pageUrl, snapshotPageId: targetPage.id, imagePath: baselineWebPath }
            });

            // Mark as approved
            await prisma.snapshotComparison.update({
                where: { id: comparisonId },
                data: { approvalStatus: "APPROVED", approvedBy: session.shop, approvedAt: new Date() },
            });

            return { ok: true, action: "approved" };
        } catch (error) {
            console.error("Approval error:", error);
            return { ok: false, error: "Failed to approve" };
        }
    }

    if (actionType === "reject") {
        const comparisonId = formData.get("comparisonId") as string;
        await prisma.snapshotComparison.update({
            where: { id: comparisonId },
            data: {
                approvalStatus: "REJECTED",
                approvedBy: session.shop,
                approvedAt: new Date(),
                rejectionReason: (formData.get("rejectionReason") as string) || undefined
            },
        });
        return { ok: true, action: "rejected" };
    }

    // --- CRITICAL: THE SECTION BELOW REQUIRES SCHEMA UPDATES ---
    // If 'snapshotAnchor' doesn't exist in your Prisma schema, these lines will fail.
    // I am using 'pageBaseline' as a fallback check or you need to add SnapshotAnchor model.

    /* 
    const anchor = await prisma.snapshotAnchor.findUnique({ where: { storeId: session.shop } }); 
    */
    const hasAnyBaseline = await prisma.pageBaseline.findFirst({ where: { storeId: session.shop } });

    if (actionType === "compare") {
        const { compareSinglePage } = await import("~/services/compareJob.server");
        try {
            const result = await compareSinglePage({
                storeId: session.shop,
                baseRunId: "manual", // Replace with actual baseline run ID if available
                targetRunId: runId,
                pageId: formData.get("pageId") as string,
                pageName: formData.get("pageName") as string,
                baselineImage: formData.get("baselineImage") as string,
                currentImage: formData.get("currentImage") as string,
            });
            return { ok: true, result };
        } catch (error) {
            return { ok: false, error: "Comparison failed" };
        }
    }

    // Default: Trigger full run comparison
    if (!hasAnyBaseline) return { ok: false, error: "No baseline set" };

    await prisma.snapshotRun.update({
        where: { id: runId },
        data: {
            compareStatus: "IN_PROGRESS",
            // comparedWithId: anchor.snapshotRunId, // Ensure this field exists in Schema!
        },
    });

    runCompareJob(session.shop, "baseline", runId).catch(async () => {
        await prisma.snapshotRun.update({
            where: { id: runId },
            data: { compareStatus: "FAILED" },
        });
    });

    return { ok: true };
};

export default function CompareRunPage() {
    const initialLoaderData = useLoaderData<typeof loader>();
    const fetcher = useFetcher<typeof loader>();
    const data = fetcher.data || initialLoaderData;
    const { pages, run, hasBaseline } = data;

    const isComparing = run.compareStatus === "IN_PROGRESS";

    useEffect(() => {
        if (!isComparing) return;
        const interval = setInterval(() => {
            fetcher.load(window.location.pathname);
        }, 3000);
        return () => clearInterval(interval);
    }, [isComparing, fetcher]);

    return <CompareLayout pages={pages} run={run} hasBaseline={hasBaseline} />;
}