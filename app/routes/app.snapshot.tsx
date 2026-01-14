import { useState, useCallback, useEffect } from "react";
import { useFetcher, useLoaderData, useNavigate } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { redirect } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import { Page, Card, Button, Modal, BlockStack, Checkbox, Text, Badge, IndexTable, InlineStack } from "@shopify/polaris";
import { prisma } from "~/utils/prisma.server";
import { createSnapshotDir } from "~/utils/snapshot-paths.server";
import { getStorePages } from "~/services/snapshot-logic.server";
import { takeSnapshots } from "~/services/snapshot.server";
import { runCompareJob } from "~/services/compareJob.server";

import path from "path";


/* ---------------- LOADER & ACTION ---------------- */

export const loader = async ({ request }: LoaderFunctionArgs) => {
  console.log("yeah loader");

  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const runId = url.searchParams.get("runId");

  let status: string | null = null;

  if (runId) {
    const run = await prisma.snapshotRun.findUnique({
      where: { id: runId },
      select: { status: true, errorMessage: true },
    });
    // Fix: Explicitly cast or assign as string
    status = run?.status ? String(run.status) : null;
  }

  const runs = await prisma.snapshotRun.findMany({
    where: { storeId: session.shop },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { pages: true },
  });

  return {
    runs: JSON.parse(JSON.stringify(runs)),
    status,
  };
};
export const action = async ({ request }: ActionFunctionArgs) => {
  console.log("yeah");
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("actionType");
  console.log(actionType);
  if (actionType === "run-comparison") {
    const runId = formData.get("runId") as string;
    console.log("running comparison", runId);

    const anchor = await prisma.snapshotAnchor.findUnique({
      where: { storeId: session.shop },
    });
    // console.log(anchor);
    if (!anchor) {
      // Handle case where there's no baseline
      // Perhaps redirect with an error message, or handle on the compare page
      return redirect(`/app/compare/${runId}`);
    }

    await prisma.snapshotRun.update({
      where: { id: runId },
      data: {
        compareStatus: "IN_PROGRESS",
        comparedWithId: anchor.snapshotRunId,
      },
    });

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
  const publicPath = path
    .relative(path.join(process.cwd(), "public"), outputDir)
    .replace(/\\/g, "/");

  console.log("publicPath", publicPath);
  await prisma.snapshotPage.createMany({

    data: pages.map(p => ({
      snapshotRunId: run.id,
      pageName: p.name,
      pageUrl: p.url,
      imagePath: `${publicPath}/${p.name}.png`,
    })),
  });

  // Background trigger (non-blocking)
  backgroundProcess(run.id, pages, outputDir, session.shop).catch(console.error);

  return { ok: true, count: pages.length, runId: run.id };
};

/* ---------------- UI COMPONENTS ---------------- */

const StatusBadge = ({ status }: { status: string }) => {
  const config: Record<string, { tone: any; label: string }> = {
    APPROVED: { tone: "success", label: "Approved" },
    COMPLETED: { tone: "warning", label: "Completed" },
    PROCESSING: { tone: "info", label: "Processing..." },
    FAILED: { tone: "critical", label: "Failed" },
  };
  const { tone, label } = config[status] || { tone: "warning", label: "Pending" };
  return <Badge tone={tone}>{label}</Badge>;
};

export default function SnapshotPage() {
  const navigate = useNavigate();
  const { runs } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const compareFetcher = useFetcher();
  const statusFetcher = useFetcher();
  const [localTimes, setLocalTimes] = useState<Record<string, string>>({});
  useEffect(() => {
    const map: Record<string, string> = {};
    for (const run of runs) {
      map[run.id] = new Date(run.createdAt).toLocaleString();
    }
    setLocalTimes(map);
  }, [runs]);

  const [modalOpen, setModalOpen] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [pollingId, setPollingId] = useState<string | null>(null);

  // Polling Logic
  useEffect(() => {
    if (!pollingId) return;
    const interval = setInterval(() => statusFetcher.load(`?runId=${pollingId}`), 3000);
    return () => clearInterval(interval);
  }, [pollingId]);

  useEffect(() => {
    const data = statusFetcher.data as any;
    if (!data) return;

    if (data.status === "FAILED") {
      setPollingId(null);
      alert(`Snapshot failed:\n${data.errorMessage || "Unknown error"}`);
    }

    if (["COMPLETED", "APPROVED"].includes(data.status)) {
      setPollingId(null);
      window.location.reload();
    }
  }, [statusFetcher.data]);

  const handleStartCapture = () => {
    fetcher.submit({ categories: JSON.stringify(categories) }, { method: "POST" });
    setModalOpen(false);
  };
  const handleCompare = (runId: string) => {
    compareFetcher.submit(
      { actionType: "run-comparison", runId },
      { method: "post" }
    );
    navigate(`/app/compare/${runId}`);
  };
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data && fetcher.data.ok && fetcher.data.runId) {
      setPollingId(fetcher.data.runId);
    }
  }, [fetcher.state, fetcher.data]);

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
                  {localTimes[run.id] ??
                    `${run.createdAt.replace("T", " ").slice(0, 16)} UTC`}
                </Text>
              </IndexTable.Cell>
              <IndexTable.Cell><StatusBadge status={run.status} /></IndexTable.Cell>
              <IndexTable.Cell>{run.pages.length} Pages</IndexTable.Cell>
              <IndexTable.Cell>
                <compareFetcher.Form method="post">
                  <input type="hidden" name="actionType" value="run-comparison" />
                  <input type="hidden" name="runId" value={run.id} />
                  <Button submit size="slim">
                    Compared
                  </Button>
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

/* ---------------- HELPERS ---------------- */

async function backgroundProcess(runId: string, pages: any[], outputDir: string, shop: string) {
  await prisma.snapshotRun.update({ where: { id: runId }, data: { status: "PROCESSING" as any } });
  try {
    await takeSnapshots({ pages, outputDir, password: "123" });
    await prisma.snapshotRun.update({ where: { id: runId }, data: { status: "COMPLETED" as any } });

    // Auto-approve first run logic...
    const anchor = await prisma.snapshotAnchor.findUnique({ where: { storeId: shop } });
    if (!anchor) {
      await prisma.snapshotAnchor.create({ data: { storeId: shop, snapshotRunId: runId } });
      await prisma.snapshotRun.update({ where: { id: runId }, data: { status: "APPROVED" as any } });
    }
  } catch (e: any) {
    await prisma.snapshotRun.update({
      where: { id: runId }, data: {
        status: "FAILED" as any,
        errorMessage: e?.message || String(e),
      },
    });

    console.error("Snapshot failed:", e);
  }
}