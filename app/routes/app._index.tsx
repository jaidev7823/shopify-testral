import { useState, useCallback, useEffect } from "react";
import { json, redirect } from "@remix-run/node";
import { useFetcher, useLoaderData, useNavigate, useRevalidator } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { authenticate } from "~/shopify.server";
import { Page, Card, Button, Modal, BlockStack, Checkbox, Text, Badge, IndexTable, InlineStack, Box } from "@shopify/polaris";
import { prisma } from "~/utils/prisma.server";
import { createSnapshotDir } from "~/utils/snapshot-paths.server";
import { getStorePages } from "~/services/snapshot-logic.server";
import { takeSnapshots } from "~/services/snapshot.server";
import { runCompareJob } from "~/services/compareJob.server";
import path from "path";

/* ---------------- LOADER & ACTION ---------------- */
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

  const baselines = await prisma.pageBaseline.findMany({
    where: { storeId: shop },
    orderBy: { pageName: "asc" },
  });

  return json({
    runs: JSON.parse(JSON.stringify(runs)),
    baselines: JSON.parse(JSON.stringify(baselines)),
    status: null,
    errorMessage: null
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  if (actionType === "run-comparison") {
    const runId = formData.get("runId") as string;
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
    PROCESSING: { tone: "warning", label: "Processing" },
    FAILED: { tone: "critical", label: "Failed" },
  };
  const { tone, label } = config[status] || { tone: "warning", label: "Processing" };
  return <Badge tone={tone}>{label}</Badge>;
};

export default function SnapshotPage() {
  const { runs: initialRuns = [], baselines = [] } = useLoaderData<typeof loader>() as { runs: any[], baselines: any[] };
  const revalidator = useRevalidator();
  const [runs, setRuns] = useState<any[]>(initialRuns);
  const [localTimes, setLocalTimes] = useState<Record<string, string>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [pollingId, setPollingId] = useState<string | null>(null);

  // Gallery state
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [selectedBaselineId, setSelectedBaselineId] = useState<string | null>(null);

  const fetcher = useFetcher<typeof action>();
  const compareFetcher = useFetcher();
  const statusFetcher = useFetcher();

  useEffect(() => { setRuns(initialRuns); }, [initialRuns]);

  useEffect(() => {
    const map: Record<string, string> = {};
    for (const run of runs) { map[run.id] = new Date(run.createdAt).toLocaleString(); }
    setLocalTimes(map);
  }, [runs]);

  useEffect(() => {
    const data = fetcher.data as any;
    if (fetcher.state === "idle" && data?.ok && data?.runId) {
      setPollingId(data.runId);
      statusFetcher.load("?");
    }
  }, [fetcher.state, fetcher.data]);

  useEffect(() => {
    if (!pollingId) return;
    const interval = setInterval(() => {
      const params = new URLSearchParams(window.location.search);
      statusFetcher.load(`?runId=${pollingId}&shop=${params.get("shop")}`);
    }, 3000);
    return () => clearInterval(interval);
  }, [pollingId]);

  useEffect(() => {
    const data = statusFetcher.data as any;
    if (!data || !pollingId) return;
    if (data.status) {
      setRuns((prev: any[]) =>
        prev.map((r: any) => (r.id === pollingId ? { ...r, status: data.status } : r))
      );
      if (data.status === "FAILED") { setPollingId(null); }
      if (["COMPLETED", "APPROVED"].includes(data.status)) {
        setPollingId(null);
        revalidator.revalidate();
      }
    }
  }, [statusFetcher.data, pollingId, revalidator]);

  const handleStartCapture = () => {
    fetcher.submit({ categories: JSON.stringify(categories) }, { method: "POST" });
    setModalOpen(false);
  };

  useEffect(() => {
    if (galleryOpen && baselines.length > 0 && !selectedBaselineId) {
      setSelectedBaselineId(baselines[0].id);
    }
  }, [galleryOpen, baselines]);

  const selectedBaseline = baselines.find(b => b.id === selectedBaselineId);

  return (
    <Page title="Visual Snapshots" primaryAction={{ content: "Take Snapshots", onAction: () => setModalOpen(true) }}>
      <div style={{ marginBottom: "20px" }}>
        <Card>
          <BlockStack gap="200">
            <Text as="h2" variant="headingMd">Approved Baselines (Gold Masters)</Text>
            <Text as="p" variant="bodyMd">
              {baselines.length} pages are currently approved as the Gold Master standard.
            </Text>
            <InlineStack>
              <Button onClick={() => setGalleryOpen(true)}>View Approved Images</Button>
            </InlineStack>
          </BlockStack>
        </Card>
      </div>

      <Card>
        <IndexTable
          resourceName={{ singular: "run", plural: "runs" }}
          itemCount={runs.length}
          selectable={false}
          headings={[{ title: "Date" }, { title: "Status" }, { title: "Pages" }, { title: "Actions" }]}
        >
          {runs.map((run: any, i: number) => (
            <IndexTable.Row id={run.id} key={run.id} position={i}>
              <IndexTable.Cell><Text as="span" variant="bodyMd" fontWeight="bold">{localTimes[run.id] ?? "Pending"}</Text></IndexTable.Cell>
              <IndexTable.Cell><StatusBadge status={run.status} /></IndexTable.Cell>
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
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        title="Approved Gold Masters"
        size="fullScreen"
      >
        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", height: "calc(100vh - 150px)", overflow: "hidden" }}>
          {/* Sidebar */}
          <div style={{ borderRight: "1px solid var(--p-color-border-secondary)", overflowY: "auto", background: "var(--p-color-bg-surface-secondary)" }}>
            <Box padding="200">
              <BlockStack gap="100">
                {baselines.map((base) => {
                  const isSelected = selectedBaselineId === base.id;
                  return (
                    <div key={base.id} onClick={() => setSelectedBaselineId(base.id)} style={{ cursor: "pointer" }}>
                      <div style={{ border: isSelected ? "2px solid var(--p-color-border-focus)" : "2px solid transparent", borderRadius: "8px" }}>
                        <Card>
                          <BlockStack gap="100">
                            <Text variant="headingSm" as="h6">{base.pageName}</Text>
                            <Text variant="bodySm" tone="subdued" as="p" truncate>{base.pageUrl}</Text>
                          </BlockStack>
                        </Card>
                      </div>
                    </div>
                  );
                })}
              </BlockStack>
            </Box>
          </div>

          {/* Main Workspace */}
          <div style={{ padding: "24px", overflowY: "auto", background: "#f1f1f1" }}>
            {selectedBaseline ? (
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between">
                    <Text variant="headingMd" as="h4">{selectedBaseline.pageName}</Text>
                    {/* FIXED: Added 'as="p"' here */}
                    <Text variant="bodySm" tone="subdued" as="p">Last Updated: {new Date(selectedBaseline.updatedAt).toLocaleDateString()}</Text>
                  </InlineStack>
                  <div style={{ border: "1px solid #dfe3e8", borderRadius: "8px", overflow: "hidden", background: "#fff" }}>
                    <img src={selectedBaseline.imagePath} alt={selectedBaseline.pageName} style={{ width: "100%", display: "block" }} />
                  </div>
                </BlockStack>
              </Card>
            ) : (
              <Box padding="1000"><Text as="p" alignment="center">Select a page from the list to view the approved Gold Master image.</Text></Box>
            )}
          </div>
        </div>
      </Modal>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Select Categories" primaryAction={{ content: "Start", onAction: handleStartCapture, loading: fetcher.state === "submitting" }}>
        <Modal.Section>
          <BlockStack gap="200">
            {["homepage", "products", "collections", "pages"].map((cat) => (
              <Checkbox key={cat} label={cat.charAt(0).toUpperCase() + cat.slice(1)} checked={categories.includes(cat)} onChange={() => setCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])} />
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
    await prisma.snapshotRun.update({ where: { id: runId }, data: { status: "PROCESSING" } });
    await takeSnapshots({ pages, outputDir, password: "123" });
    const baselineCount = await prisma.pageBaseline.count({ where: { storeId: shop } });

    if (baselineCount === 0) {
      const fs = (await import("fs/promises")).default;
      const runPages = await prisma.snapshotPage.findMany({ where: { snapshotRunId: runId } });
      for (const page of runPages) {
        const baselineDir = path.join(process.cwd(), "public", "baselines", shop);
        const baselineFilename = `${page.pageName}.png`;
        const baselinePath = path.join(baselineDir, baselineFilename);
        const sourcePath = path.join(process.cwd(), "public", page.imagePath);
        try {
          await fs.mkdir(baselineDir, { recursive: true });
          await fs.copyFile(sourcePath, baselinePath);
          await prisma.pageBaseline.create({
            data: { storeId: shop, pageName: page.pageName, pageUrl: page.pageUrl, snapshotPageId: page.id, imagePath: `/baselines/${shop}/${baselineFilename}` }
          });
        } catch (err) { console.error(err); }
      }
      await prisma.snapshotRun.update({ where: { id: runId }, data: { status: "APPROVED" } });
    } else {
      await prisma.snapshotRun.update({ where: { id: runId }, data: { status: "COMPLETED" } });
    }
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    await prisma.snapshotRun.update({ where: { id: runId }, data: { status: "FAILED", errorMessage: errorMsg } }).catch(console.error);
  }
}