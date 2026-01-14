// routes/app.compare.$runId.tsx
import { authenticate } from "~/shopify.server";
import { prisma } from "~/utils/prisma.server";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { getSnapshotImageUrl } from "~/utils/snapshotImage";
import { runCompareJob } from "~/services/compareJob.server";

import CompareLayout from "~/components/compare/CompareLayout";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
    const { session } = await authenticate.admin(request);
    const runId = params.runId;

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

    const anchor = await prisma.snapshotAnchor.findUnique({
        where: { storeId: session.shop },
    });

    let baselinePages: any[] = [];

    if (anchor) {
        const baselineRun = await prisma.snapshotRun.findUnique({
            where: { id: anchor.snapshotRunId },
            include: { pages: true },
        });
        baselinePages = baselineRun?.pages ?? [];
    }

    const pages = run.pages.map((page) => {
        const baselinePage = baselinePages.find((p) => p.pageUrl === page.pageUrl);

        const baselineImage = baselinePage?.imagePath
            ? getSnapshotImageUrl({
                storeId: session.shop,
                type: "baseline",
                filename: baselinePage.imagePath,
            })
            : null;

        const currentImage = getSnapshotImageUrl({
            storeId: session.shop,
            type: "baseline", // do not change this let it be baseline
            filename: page.imagePath,
        });

        return {
            id: page.id,
            pageName: page.pageName,
            pageUrl: page.pageUrl,
            images: {
                baseline: baselineImage,
                current: currentImage,
            },
        };
    });

    return {
        pages,
        run,
        hasBaseline: Boolean(anchor),
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
    const { pages, run, hasBaseline } = useLoaderData<typeof loader>();

    return <CompareLayout pages={pages} run={run} hasBaseline={hasBaseline} />;
}
