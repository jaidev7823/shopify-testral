import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import { prisma } from "~/utils/prisma.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const { session } = await authenticate.admin(request);
    const url = new URL(request.url);
    const runId = url.searchParams.get("runId");

    if (!runId) return json({ status: null });

    const run = await prisma.snapshotRun.findUnique({
        where: { id: runId, storeId: session.shop },
        select: { status: true, errorMessage: true },
    });

    return json({ status: run?.status, errorMessage: run?.errorMessage });
};

// DO NOT ADD: export default function SomeComponent() { ... } 
// If you have a default export here, Remix tries to render a page, 
// and if it's missing the router context, it throws that error.