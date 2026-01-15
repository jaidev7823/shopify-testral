import { useState, useCallback, useEffect, useMemo } from "react";
import { useFetcher, useLoaderData, useNavigate } from "@remix-run/react";
import { json, redirect, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import {
  Page, Card, Button, Modal, BlockStack, Checkbox,
  Text, Badge, IndexTable, InlineStack, Box
} from "@shopify/polaris";
import { prisma } from "~/utils/prisma.server";
import { createSnapshotDir } from "~/utils/snapshot-paths.server";
import { getStorePages } from "~/services/snapshot-logic.server";
import { takeSnapshots } from "~/services/snapshot.server";
import { runCompareJob } from "~/services/compareJob.server";
import path from "path";

/* ---------------- TYPES ---------------- */

type RunStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "APPROVED";

interface SnapshotRun {
  id: string;
  status: RunStatus;
  createdAt: string;
  errorMessage?: string;
  pages: { id: string }[];
}

/* ---------------- LOADER ---------------- */

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const runId = url.searchParams.get("runId");

  // If polling for a specific run status
  if (runId) {
    const run = await prisma.snapshotRun.findUnique({
      where: { id: runId },
      select: { status: true, errorMessage: true },
    });
    return json({ status: run?.status, errorMessage: run?.errorMessage });
  }

  // Default: Get list of runs
  const runs = await prisma.snapshotRun.findMany({
    where: { storeId: session.shop },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { pages: { select: { id: true } } },
  });

  return json({ runs: JSON.parse(JSON.stringify(runs)) });
};

/* ---------------- ACTION ---------------- */

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  /** Handle Comparison Trigger **/
  if (actionType === "run-comparison") {
    const runId = String(formData.get("runId"));
    const anchor = await prisma.snapshotAnchor.findUnique({ where: { storeId: session.shop } });

    if (!anchor) return redirect(`/app/compare/${runId}`);

    await prisma.snapshotRun.update({
      where: { id: runId },
      data: { compareStatus: "IN_PROGRESS", comparedWithId: anchor.snapshotRunId },
    });

    // Fire and forget comparison job
    runCompareJob(session.shop, anchor.snapshotRunId, runId).catch(async () => {
      await prisma.snapshotRun.update({ where: { id: runId }, data: { compareStatus: "FAILED" } });
    });

    return redirect(`/app/compare/${runId}`);
  }

  /** Handle New Snapshot Creation **/
  const categories = JSON.parse(String(formData.get("categories") || "[]"));
  if (!categories.length) return json({ error: "Select at least one category" }, { status: 400 });

  const pages = await getStorePages(admin, categories, `https://${session.shop}`);
  if (!pages.length) return json({ error: "No pages found" }, { status: 400 });

  const outputDir = createSnapshotDir(session.shop);
  const run = await prisma.snapshotRun.create({
    data: {
      storeId: session.shop,
      snapshotKey: path.basename(outputDir),
      status: "PENDING"
    },
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

  // Background trigger
  backgroundProcess(run.id, pages, outputDir, session.shop).catch(console.error);

  return json({ ok: true, runId: run.id });
};

/* ---------------- COMPONENTS ---------------- */

const StatusBadge = ({ status }: { status: RunStatus }) => {
  const config: Record<RunStatus, { tone: "success" | "warning" | "info" | "critical"; label: string }> = {
    APPROVED: { tone: "success", label: "Approved" },
    COMPLETED: { tone: "success", label: "Completed" },
    PROCESSING: { tone: "info", label: "Processing" },
    FAILED: { tone: "critical", label: "Failed" },
    PENDING: { tone: "warning", label: "Pending" },
  };
  const { tone, label } = config[status] || config.PENDING;
  return <Badge tone={tone}>{label}</Badge>;
};

export default function SnapshotPage() {
  const { runs } = useLoaderData<{ runs: SnapshotRun[] }>();
  const navigate = useNavigate();

  const snapshotFetcher = useFetcher<any>();
  const compareFetcher = useFetcher();
  const pollFetcher = useFetcher<any>();

  const [modalOpen, setModalOpen] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [pollingId, setPollingId] = useState<string | null>(null);

  // Poll for status updates
  useEffect(() => {
    if (!pollingId) return;
    const interval = setInterval(() => {
      pollFetcher.load(`?runId=${pollingId}`);
    }, 3000);
    return () => clearInterval(interval);
  }, [pollingId]);

  // Handle polling results
  useEffect(() => {
    const data = pollFetcher.data;
    if (!data) return;

    if (data.status === "FAILED") {
      setPollingId(null);
      alert(`Error: ${data.errorMessage || "Unknown failure"}`);
    } else if (["COMPLETED", "APPROVED"].includes(data.status)) {
      setPollingId(null);
      navigate(".", { replace: true }); // Refresh data
    }
  }, [pollFetcher.data]);

  // Handle snapshot submission success
  useEffect(() => {
    if (snapshotFetcher.data?.ok && snapshotFetcher.data?.runId) {
      setPollingId(snapshotFetcher.data.runId);
    }
  }, [snapshotFetcher.data]);

  const handleStartCapture = () => {
    snapshotFetcher.submit({ categories: JSON.stringify(categories) }, { method: "POST" });
    setModalOpen(false);
  };

  const rows = useMemo(() => runs.map((run, index) => (
    <IndexTable.Row id={run.id} key={run.id} position={index}>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd" fontWeight="bold">
          {new Date(run.createdAt).toLocaleString()}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <StatusBadge status={run.status} />
      </IndexTable.Cell>
      <IndexTable.Cell>{run.pages.length} Pages</IndexTable.Cell>
      <IndexTable.Cell>
        <InlineStack gap="200">
          <compareFetcher.Form method="post">
            <input type="hidden" name="actionType" value="run-comparison" />
            <input type="hidden" name="runId" value={run.id} />
            <Button submit variant="tertiary" size="slim" disabled={run.status === "PROCESSING"}>
              Compare
            </Button>
          </compareFetcher.Form>
          <Button variant="tertiary" size="slim" onClick={() => navigate(`/app/snapshot/${run.id}`)}>
            View
          </Button>
        </InlineStack>
      </IndexTable.Cell>
    </IndexTable.Row>
  )), [runs]);

  return (
    <Page
      title="Visual Snapshots"
      primaryAction={{
        content: "Take New Snapshots",
        onAction: () => setModalOpen(true),
        loading: snapshotFetcher.state !== "idle" || !!pollingId
      }}
    >
      <Card padding="0">
        <IndexTable
          resourceName={{ singular: "run", plural: "runs" }}
          itemCount={runs.length}
          selectable={false}
          headings={[
            { title: "Date" },
            { title: "Status" },
            { title: "Pages" },
            { title: "Actions" }
          ]}
        >
          {rows}
        </IndexTable>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="What should we snapshot?"
        primaryAction={{
          content: "Start Capture",
          onAction: handleStartCapture,
          disabled: categories.length === 0
        }}
      >
        <Modal.Section>
          <BlockStack gap="300">
            <Text as="p" tone="subdued">Select the page types you want to capture images for.</Text>
            {["homepage", "products", "collections", "pages"].map((cat) => (
              <Checkbox
                key={cat}
                label={cat.charAt(0).toUpperCase() + cat.slice(1)}
                checked={categories.includes(cat)}
                onChange={(val) => setCategories(prev => val ? [...prev, cat] : prev.filter(c => c !== cat))}
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
  // Update to processing
  await prisma.snapshotRun.update({ where: { id: runId }, data: { status: "PROCESSING" } });

  try {
    // Perform actual snapshot logic
    await takeSnapshots({ pages, outputDir, password: "123" });

    // Check if we should auto-approve (if it's the first run)
    const anchor = await prisma.snapshotAnchor.findUnique({ where: { storeId: shop } });

    if (!anchor) {
      await prisma.snapshotAnchor.create({ data: { storeId: shop, snapshotRunId: runId } });
      await prisma.snapshotRun.update({ where: { id: runId }, data: { status: "APPROVED" } });
    } else {
      await prisma.snapshotRun.update({ where: { id: runId }, data: { status: "COMPLETED" } });
    }
  } catch (e: any) {
    await prisma.snapshotRun.update({
      where: { id: runId },
      data: { status: "FAILED", errorMessage: e?.message || String(e) },
    });
  }
}