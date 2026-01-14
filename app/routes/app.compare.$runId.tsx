// routes/app.compare.$runId.tsx
import { authenticate } from "~/shopify.server";
import { prisma } from "~/utils/prisma.server";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { getSnapshotImageUrl } from "~/utils/snapshotImage";

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

export default function CompareRunPage() {
    const { pages, run, hasBaseline } = useLoaderData<typeof loader>();

    return <CompareLayout pages={pages} run={run} hasBaseline={hasBaseline} />;
}
