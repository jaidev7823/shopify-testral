import { authenticate } from "~/shopify.server";
import { prisma } from "~/utils/prisma.server";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";

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

    return {
        run,
        hasBaseline: Boolean(anchor),
    };
};

export default function CompareRunPage() {
    const { run, hasBaseline } = useLoaderData<typeof loader>();

    return <CompareLayout run={run} hasBaseline={hasBaseline} />;
}
