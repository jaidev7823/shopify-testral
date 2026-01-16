import { useState, useCallback, useEffect } from "react";
import { json, redirect } from "@remix-run/node";
import { useFetcher, useLoaderData, useNavigate, useRevalidator } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { authenticate } from "~/shopify.server";
import { Page, Card, Button, Modal, BlockStack, Checkbox, Text, Badge, IndexTable, InlineStack } from "@shopify/polaris";
import { prisma } from "~/utils/prisma.server";
import { createSnapshotDir } from "~/utils/snapshot-paths.server";
import { getStorePages } from "~/services/snapshot-logic.server";
import { takeSnapshots } from "~/services/snapshot.server";
import { runCompareJob } from "~/services/compareJob.server";
import path from "path";

/* ---------------- LOADER & ACTION (Omitted for brevity, keep yours as is) ---------------- */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const url = new URL(request.url);
  const runId = url.searchParams.get("runId");

  if (runId) {
    const run = await prisma.snapshotRun.findUnique({
      where: { id: runId },
      select: { status: true, errorMessage: true },
    });
    return json({ status: run?.status || null, errorMessage: run?.errorMessage || null });
  }

  const runs = await prisma.snapshotRun.findMany({
    where: { storeId: shop },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { pages: { select: { id: true } } },
  });

  return json({ runs: JSON.parse(JSON.stringify(runs)), status: null, errorMessage: null });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  if (actionType === "run-comparison") {
    const runId = formData.get("runId") as string;

    // With Gold Master architecture, we don't need a specific "Anchor".
    // We just trigger the comparison against available baselines.

    await prisma.snapshotRun.update({
      where: { id: runId },
      data: { compareStatus: "IN_PROGRESS" },
    });

    runCompareJob(session.shop, "legacy-placeholder", runId).catch(async () => {
      await prisma.snapshotRun.update({ where: { id: runId }, data: { compareStatus: "FAILED" } });
    });

    return redirect(`/app/compare/${runId}`);
  }

  const categories = JSON.parse(String(formData.get("categories") || "[]"));
  if (!categories.length) return { ok: false, error: "Select at least one category" };

  const pages = await getStorePages(admin, categories, `https://${session.shop}`);
  if (!pages.length) return { ok: false, error: "No pages found" };

  const outputDir = createSnapshotDir(session.shop);
  const run = await prisma.snapshotRun.create({
    data: { storeId: session.shop, snapshotKey: path.basename(outputDir), status: "PENDING" as any },
  });

  const publicPath = path.relative(path.join(process.cwd(), "public"), outputDir).replace(/\\/g, "/");

  await prisma.snapshotPage.createMany({
    data: pages.map(p => ({
      snapshotRunId: run.id,
      pageName: p.name,
      pageUrl: p.url,
      imagePath: `${publicPath}/${p.name}.png`,
    })),
  });

  backgroundProcess(run.id, pages, outputDir, session.shop).catch(console.error);
  return { ok: true, count: pages.length, runId: run.id };
};

/* ---------------- UI COMPONENTS ---------------- */

const StatusBadge = ({ status }: { status: string }) => {
  const config: Record<string, { tone: any; label: string }> = {
    APPROVED: { tone: "success", label: "Approved" },
    COMPLETED: { tone: "info", label: "Completed" },
    PROCESSING: { tone: "warning", label: "You can refresh the page to see the status" },
    FAILED: { tone: "critical", label: "Failed" },
  };
  const { tone, label } = config[status] || { tone: "warning", label: "You can refresh the page to see the status" };
  return <Badge tone={tone}>{label}</Badge>;
};

export default function SnapshotPage() {
  const navigate = useNavigate();
  const { runs: initialRuns = [] } = useLoaderData<typeof loader>() as { runs: any[] };
  const revalidator = useRevalidator(); // Initialize revalidator
  const [runs, setRuns] = useState(initialRuns);
  const [localTimes, setLocalTimes] = useState<Record<string, string>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [pollingId, setPollingId] = useState<string | null>(null);

  const fetcher = useFetcher<typeof action>();
  const compareFetcher = useFetcher();
  const statusFetcher = useFetcher();

  // 1. Sync local state with loader data (Remix Revalidation)
  useEffect(() => {
    setRuns(initialRuns);
  }, [initialRuns]);

  // 2. Format times
  useEffect(() => {
    const map: Record<string, string> = {};
    for (const run of runs) {
      map[run.id] = new Date(run.createdAt).toLocaleString();
    }
    setLocalTimes(map);
  }, [runs]);

  // 3. Start polling when a new run is created
  useEffect(() => {
    const data = fetcher.data as any;
    // When action succeeds, set the polling ID
    if (fetcher.state === "idle" && data?.ok && data?.runId) {
      setPollingId(data.runId);

      // OPTIONAL: Manually trigger a re-fetch of the main list 
      // to ensure the new "Pending" run appears in the table immediately
      statusFetcher.load("?");
    }
  }, [fetcher.state, fetcher.data]);

  // 4. Handle Polling Interval
  useEffect(() => {
    if (!pollingId) return;

    const interval = setInterval(() => {
      const params = new URLSearchParams(window.location.search);
      const shop = params.get("shop");
      // Use index 0 to target the loader
      statusFetcher.load(`?runId=${pollingId}&shop=${shop}`);
    }, 3000);

    return () => clearInterval(interval);
  }, [pollingId]);

  // 5. THE FIX: Consolidated Status Update Logic
  useEffect(() => {
    const data = statusFetcher.data as any;
    if (!data || !pollingId) return;

    if (data.status) {
      setRuns((prev) =>
        prev.map((r) => (r.id === pollingId ? { ...r, status: data.status } : r))
      );

      if (data.status === "FAILED") {
        setPollingId(null);
        alert(`Snapshot failed: ${data.errorMessage || "Unknown error"}`);
      }

      // Stop polling when finished
      if (["COMPLETED", "APPROVED"].includes(data.status)) {
        console.log("revalidating");
        setPollingId(null);

        revalidator.revalidate();
      }
    }
  }, [statusFetcher.data, pollingId, revalidator]);

  const handleStartCapture = () => {
    fetcher.submit({ categories: JSON.stringify(categories) }, { method: "POST" });
    setModalOpen(false);
  };

  return (
    <Page title="Visual Snapshots" primaryAction={{ content: "Take Snapshots", onAction: () => setModalOpen(true) }}>
      <Card>
        <IndexTable
          resourceName={{ singular: "run", plural: "runs" }}
          itemCount={runs.length}
          selectable={false}
          headings={[{ title: "Date" }, { title: "Status" }, { title: "Pages" }, { title: "Actions" }]}
        >
          {runs.map((run: any, i: number) => (
            <IndexTable.Row id={run.id} key={run.id} position={i}>
              <IndexTable.Cell>
                <Text as="span" variant="bodyMd" fontWeight="bold">
                  {localTimes[run.id] ?? `${run.createdAt.replace("T", " ").slice(0, 16)} UTC`}
                </Text>
              </IndexTable.Cell>
              <IndexTable.Cell>
                <StatusBadge status={run.status} />
              </IndexTable.Cell>
              <IndexTable.Cell>{run.pages?.length || 0} Pages</IndexTable.Cell>
              <IndexTable.Cell>
                <compareFetcher.Form method="post">
                  <input type="hidden" name="actionType" value="run-comparison" />
                  <input type="hidden" name="runId" value={run.id} />
                  <Button submit size="slim">Compare</Button>
                </compareFetcher.Form>
              </IndexTable.Cell>
            </IndexTable.Row>
          ))}
        </IndexTable>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Select Categories"
        primaryAction={{ content: "Start", onAction: handleStartCapture, loading: fetcher.state === "submitting" }}
      >
        <Modal.Section>
          <BlockStack gap="200">
            {["homepage", "products", "collections", "pages"].map((cat) => (
              <Checkbox
                key={cat}
                label={cat.charAt(0).toUpperCase() + cat.slice(1)}
                checked={categories.includes(cat)}
                onChange={() => setCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])}
              />
            ))}
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}

/* ---------------- BACKGROUND PROCESS ---------------- */
async function backgroundProcess(runId: string, pages: any[], outputDir: string, shop: string) {
  try {
    await prisma.snapshotRun.update({
      where: { id: runId },
      data: { status: "PROCESSING" }
    });

    await takeSnapshots({ pages, outputDir, password: "123" });

    // Check if we have ANY baselines for this store.
    // If count is 0, this is effectively the "First Run" (or a clean start).
    const baselineCount = await prisma.pageBaseline.count({
      where: { storeId: shop }
    });

    if (baselineCount === 0) {
      console.log("No baselines found. Initializing Gold Masters from this run...");

      const fs = (await import("fs/promises")).default; // Dynamic import if needed, or rely on top level

      // Get all pages for this run
      const runPages = await prisma.snapshotPage.findMany({
        where: { snapshotRunId: runId }
      });

      for (const page of runPages) {
        const baselineDir = path.join(process.cwd(), "public", "baselines", shop);
        const baselineFilename = `${page.pageName}.png`;
        const baselinePath = path.join(baselineDir, baselineFilename);
        const baselineWebPath = `/baselines/${shop}/${baselineFilename}`;
        const sourcePath = path.join(process.cwd(), "public", page.imagePath);

        try {
          await fs.mkdir(baselineDir, { recursive: true });
          await fs.copyFile(sourcePath, baselinePath);

          await prisma.pageBaseline.create({
            data: {
              storeId: shop,
              pageName: page.pageName,
              pageUrl: page.pageUrl,
              snapshotPageId: page.id,
              imagePath: baselineWebPath
            }
          });
        } catch (err) {
          console.error(`Failed to create baseline for ${page.pageName}:`, err);
        }
      }

      await prisma.snapshotRun.update({
        where: { id: runId },
        data: { status: "APPROVED" }
      });
    } else {
      await prisma.snapshotRun.update({
        where: { id: runId },
        data: { status: "COMPLETED" }
      });
    }
  } catch (e) {
    console.error(`[Background] Run ${runId} failed:`, e);
    const errorMsg = e instanceof Error ? e.message : String(e);
    await prisma.snapshotRun.update({
      where: { id: runId },
      data: { status: "FAILED", errorMessage: errorMsg }
    }).catch(console.error);
  }
}