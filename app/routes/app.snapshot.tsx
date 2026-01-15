import { useState, useCallback, useEffect, useMemo } from "react";
import { useFetcher, useLoaderData, useNavigate, useRevalidator } from "@remix-run/react";
import { json, redirect, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import {
  Page, Card, Button, Modal, BlockStack, Checkbox,
  Text, Badge, IndexTable, InlineStack
} from "@shopify/polaris";
import { prisma } from "~/utils/prisma.server";
import { createSnapshotDir } from "~/utils/snapshot-paths.server";
import { getStorePages } from "~/services/snapshot-logic.server";
import { takeSnapshots } from "~/services/snapshot.server";
import { runCompareJob } from "~/services/compareJob.server";
import path from "path";

type RunStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "APPROVED";

/* ---------------- LOADER ---------------- */

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Always authenticate first to handle the session/headers correctly
  const { session } = await authenticate.admin(request);

  const url = new URL(request.url);
  const runId = url.searchParams.get("runId");

  // If polling for a specific run
  if (runId) {
    const run = await prisma.snapshotRun.findUnique({
      where: { id: runId },
      select: { status: true, errorMessage: true },
    });
    // Return a structured object
    return json({ runStatus: run?.status, errorMessage: run?.errorMessage });
  }

  // Normal page load: fetch last 10 runs
  const runs = await prisma.snapshotRun.findMany({
    where: { storeId: session.shop },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { pages: { select: { id: true } } },
  });

  return json({ runs });
};
/* ---------------- ACTION ---------------- */

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  if (actionType === "run-comparison") {
    // ... (Your comparison logic remains same)
    return redirect(`/app/compare/${formData.get("runId")}`);
  }

  const categories = JSON.parse(String(formData.get("categories") || "[]"));
  const pages = await getStorePages(admin, categories, `https://${session.shop}`);
  const outputDir = createSnapshotDir(session.shop);

  const run = await prisma.snapshotRun.create({
    data: { storeId: session.shop, snapshotKey: path.basename(outputDir), status: "PENDING" },
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

  // IMPORTANT: DO NOT AWAIT THIS. Let it run in the background.
  backgroundProcess(run.id, pages, outputDir, session.shop).catch(console.error);

  return json({ ok: true, runId: run.id });
};

/* ---------------- UI ---------------- */

export default function SnapshotPage() {
  const { runs } = useLoaderData<typeof loader>() as { runs: any[] };
  const revalidator = useRevalidator();
  const navigate = useNavigate();

  const snapshotFetcher = useFetcher<any>();
  const pollFetcher = useFetcher<any>();
  const [modalOpen, setModalOpen] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [pollingId, setPollingId] = useState<string | null>(null);

  // 1. Start polling when we get a runId from the action
  useEffect(() => {
    if (snapshotFetcher.data?.ok && snapshotFetcher.data?.runId) {
      setPollingId(snapshotFetcher.data.runId);
    }
  }, [snapshotFetcher.data]);

  // Inside your useEffect for polling
  useEffect(() => {
    if (!pollingId) return;

    const interval = setInterval(() => {
      // Point to the NEW api route instead of "?"
      pollFetcher.load(`/api/poll-run?runId=${pollingId}`);
    }, 3000);

    return () => clearInterval(interval);
  }, [pollingId]);

  // Inside your handle polling results useEffect
  useEffect(() => {
    // Log this to see what's actually coming back!
    console.log("Poll Data:", pollFetcher.data);

    if (pollFetcher.data?.status === "FAILED") {
      setPollingId(null);
    }

    if (["COMPLETED", "APPROVED"].includes(pollFetcher.data?.status)) {
      console.log("Success! Refreshing table.");
      setPollingId(null);
      revalidator.revalidate();
    }
  }, [pollFetcher.data]);

  const handleStartCapture = () => {
    snapshotFetcher.submit({ categories: JSON.stringify(categories) }, { method: "POST" });
    setModalOpen(false);
  };

  return (
    <Page
      title="Visual Snapshots"
      primaryAction={{
        content: "Take Snapshots",
        onAction: () => setModalOpen(true),
        loading: snapshotFetcher.state !== "idle" || !!pollingId
      }}
    >
      <Card padding="0">
        <IndexTable
          resourceName={{ singular: "run", plural: "runs" }}
          itemCount={runs.length}
          selectable={false}
          headings={[{ title: "Date" }, { title: "Status" }, { title: "Pages" }, { title: "Actions" }]}
        >
          {runs.map((run, i) => (
            <IndexTable.Row id={run.id} key={run.id} position={i}>
              <IndexTable.Cell>
                <Text as="span" variant="bodyMd" fontWeight="bold">
                  {new Date(run.createdAt).toLocaleString()}
                </Text>
              </IndexTable.Cell>
              <IndexTable.Cell>
                <Badge tone={run.status === "COMPLETED" || run.status === "APPROVED" ? "success" : run.status === "FAILED" ? "critical" : "info"}>
                  {run.status}
                </Badge>
              </IndexTable.Cell>
              <IndexTable.Cell>{run.pages.length} Pages</IndexTable.Cell>
              <IndexTable.Cell>
                <Button size="slim" onClick={() => navigate(`/app/snapshot/${run.id}`)}>View</Button>
              </IndexTable.Cell>
            </IndexTable.Row>
          ))}
        </IndexTable>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Select Categories"
        primaryAction={{ content: "Start", onAction: handleStartCapture }}
      >
        <Modal.Section>
          <BlockStack gap="200">
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
  try {
    await prisma.snapshotRun.update({ where: { id: runId }, data: { status: "PROCESSING" } });
    await takeSnapshots({ pages, outputDir, password: "123" });

    const anchor = await prisma.snapshotAnchor.findUnique({ where: { storeId: shop } });
    if (!anchor) {
      await prisma.snapshotAnchor.create({ data: { storeId: shop, snapshotRunId: runId } });
      await prisma.snapshotRun.update({ where: { id: runId }, data: { status: "APPROVED" } });
    } else {
      await prisma.snapshotRun.update({ where: { id: runId }, data: { status: "COMPLETED" } });
    }
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    await prisma.snapshotRun.update({ where: { id: runId }, data: { status: "FAILED", errorMessage: errorMsg } });
  }
}