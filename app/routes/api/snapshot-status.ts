import type { LoaderFunctionArgs } from "react-router";
import { prisma } from "~/utils/prisma.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const url = new URL(request.url);
    const runId = url.searchParams.get("runId");

    if (!runId) {
        return { status: null };
    }

    const run = await prisma.snapshotRun.findUnique({
        where: { id: runId },
        select: { status: true, errorMessage: true },
    });

    return {
        status: run?.status ? String(run.status) : null,
        errorMessage: run?.errorMessage,
    };
};
