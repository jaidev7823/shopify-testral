// app/routes/api.comparison.tsx
import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { prisma } from "~/utils/prisma.server";

export async function loader({ request }: LoaderFunctionArgs) {
    const url = new URL(request.url);
    const pageId = url.searchParams.get("pageId");

    if (!pageId) {
        return json({ error: "pageId is required" }, { status: 400 });
    }

    try {
        // Find the latest comparison for this page
        const comparison = await prisma.snapshotComparison.findFirst({
            where: {
                OR: [
                    { basePageId: pageId },
                    { targetPageId: pageId }
                ]
            },
            orderBy: {
                createdAt: "desc"
            }
        });

        if (!comparison) {
            return json({ comparison: null });
        }

        return json({
            comparison: {
                id: comparison.id,
                isDifferent: comparison.isDifferent,
                diffScore: comparison.diffScore,
                diffImagePath: comparison.diffImagePath,
                createdAt: comparison.createdAt
            }
        });
    } catch (error) {
        console.error("Error fetching comparison:", error);
        return json({ error: "Failed to fetch comparison" }, { status: 500 });
    }
}