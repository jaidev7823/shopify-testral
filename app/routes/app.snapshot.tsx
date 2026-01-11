import { useState, useCallback, useEffect } from "react";
import { useFetcher, useLoaderData } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { authenticate } from "~/shopify.server";
import { useAppBridge } from "@shopify/app-bridge-react";
import {
  Page,
  Card,
  Button,
  Modal,
  BlockStack,
  Checkbox,
  Text,
  Badge,
  IndexTable,
  InlineStack,
} from "@shopify/polaris";
import { takeSnapshots } from "~/services/snapshot.server";
import { createSnapshotDir } from "~/utils/snapshot-paths.server";
import { prisma } from "~/utils/prisma.server";
import path from "path";

/* ---------------- LOADER ---------------- */

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const runId = url.searchParams.get("runId");

  // If checking status of a specific run
  if (runId) {
    const run = await prisma.snapshotRun.findUnique({
      where: { id: runId },
      select: { id: true, status: true },
    });
    return { status: run?.status || "PENDING" };
  }

  const runs = await prisma.snapshotRun.findMany({
    where: { storeId: session.shop },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      pages: true,
    },
  });

  // Serialize dates to prevent hydration errors
  return {
    runs: runs.map((run) => ({
      ...run,
      createdAt: run.createdAt.toISOString(),
      pages: run.pages.map((page) => ({ ...page })),
    })),
  };
};

/* ---------------- ACTION ---------------- */

// Background function to process snapshots
async function processSnapshots(
  runId: string,
  pages: { name: string; url: string }[],
  outputDir: string,
  password: string,
  sessionShop: string,
) {
  try {
    // Update status to PROCESSING
    await prisma.snapshotRun.update({
      where: { id: runId },
      data: { status: "PROCESSING" as any },
    });

    // Take snapshots (this can take a long time)
    await takeSnapshots({
      pages,
      outputDir,
      password,
    });

    // Update status to COMPLETED
    await prisma.snapshotRun.update({
      where: { id: runId },
      data: { status: "COMPLETED" as any },
    });

    // Check if this should be auto-approved
    const anchor = await prisma.snapshotAnchor.findUnique({
      where: { storeId: sessionShop },
    });

    if (!anchor) {
      await prisma.snapshotAnchor.create({
        data: {
          storeId: sessionShop,
          snapshotRunId: runId,
        },
      });

      await prisma.snapshotRun.update({
        where: { id: runId },
        data: { status: "APPROVED" },
      });
    }
  } catch (error) {
    // Update status to FAILED on error
    await prisma.snapshotRun.update({
      where: { id: runId },
      data: { status: "FAILED" as any },
    });
    console.error("Snapshot processing error:", error);
  }
}

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { admin, session } = await authenticate.admin(request);
    const formData = await request.formData();

    const categories = JSON.parse(
      String(formData.get("categories") || "[]"),
    ) as string[];

    if (categories.length === 0) {
      return { ok: false, error: "Please select at least one category" };
    }

    const storeUrl = `https://${session.shop}`;
    const pages: { name: string; url: string }[] = [];

    if (categories.includes("homepage")) {
      pages.push({ name: "homepage", url: storeUrl });
    }

    if (categories.includes("products")) {
      const res = await admin.graphql(`
        query {
          products(first: 20) {
            nodes { handle }
          }
        }
      `);
      const json = await res.json();
      if (json.data?.products?.nodes) {
        for (const p of json.data.products.nodes) {
          pages.push({
            name: `product-${p.handle}`,
            url: `${storeUrl}/products/${p.handle}`,
          });
        }
      }
    }

    if (categories.includes("collections")) {
      const res = await admin.graphql(`
        query {
          collections(first: 20) {
            nodes { handle }
          }
        }
      `);
      const json = await res.json();
      if (json.data?.collections?.nodes) {
        for (const c of json.data.collections.nodes) {
          pages.push({
            name: `collection-${c.handle}`,
            url: `${storeUrl}/collections/${c.handle}`,
          });
        }
      }
    }

    if (categories.includes("pages")) {
      const res = await admin.graphql(`
        query {
          pages(first: 20) {
            nodes { handle }
          }
        }
      `);
      const json = await res.json();
      if (json.data?.pages?.nodes) {
        for (const p of json.data.pages.nodes) {
          pages.push({
            name: `page-${p.handle}`,
            url: `${storeUrl}/pages/${p.handle}`,
          });
        }
      }
    }

    if (pages.length === 0) {
      return { ok: false, error: "No pages found to snapshot" };
    }

    const outputDir = createSnapshotDir(session.shop);
    const snapshotKey = path.basename(outputDir);

    // Create snapshot run with PENDING status
    const snapshotRun = await prisma.snapshotRun.create({
      data: {
        storeId: session.shop,
        snapshotKey,
        status: "PENDING",
      },
    });

    // Create page records
    await prisma.snapshotPage.createMany({
      data: pages.map((p) => ({
        snapshotRunId: snapshotRun.id,
        pageName: p.name,
        pageUrl: p.url,
        imagePath: `${snapshotKey}/${p.name}.png`,
      })),
    });

    // Start background processing (don't await - return immediately)
    processSnapshots(
      snapshotRun.id,
      pages,
      outputDir,
      "123",
      session.shop,
    ).catch((error) => {
      console.error("Background snapshot processing failed:", error);
    });

    // Return immediately with run ID
    return { ok: true, count: pages.length, runId: snapshotRun.id };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
};

/* ---------------- COMPONENT ---------------- */

export default function SnapshotPage() {
  const loaderData = useLoaderData<typeof loader>();
  const runs = loaderData.runs || [];
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [localTimes, setLocalTimes] = useState<Record<string, string>>({});

  useEffect(() => {
    const map: Record<string, string> = {};

    for (const run of runs) {
      map[run.id] = new Date(run.createdAt).toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    setLocalTimes(map);
  }, [runs]);
  const [modalOpen, setModalOpen] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [pollingRunId, setPollingRunId] = useState<string | null>(null);


  const isLoading =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";

  // Handle action response
  useEffect(() => {
    if (!fetcher.data) return;

    if (fetcher.data.ok) {
      shopify.toast.show(`Started capturing ${fetcher.data.count} pages`);
      setModalOpen(false);
      setCategories([]);
      // Start polling for status if we have a runId
      if (fetcher.data.runId) {
        setPollingRunId(fetcher.data.runId);
      }
    } else {
      shopify.toast.show(fetcher.data.error || "An error occurred", { isError: true });
    }
  }, [fetcher.data, shopify]);

  // Poll for snapshot completion using fetcher
  const statusFetcher = useFetcher();

  useEffect(() => {
    if (!pollingRunId) return;

    const interval = setInterval(() => {
      statusFetcher.load(`/app/snapshot?runId=${pollingRunId}`);
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, [pollingRunId, statusFetcher]);

  useEffect(() => {
    if (!statusFetcher.data || !pollingRunId) return;

    const status = (statusFetcher.data as { status?: string })?.status;

    if (status === "COMPLETED" || status === "APPROVED") {
      shopify.toast.show("Snapshots completed successfully!");
      setPollingRunId(null);
      // Reload the page data
      window.location.reload();
    } else if (status === "FAILED") {
      shopify.toast.show("Snapshot capture failed", { isError: true });
      setPollingRunId(null);
    }
  }, [statusFetcher.data, pollingRunId, shopify]);

  const toggleCategory = useCallback((key: string) => {
    setCategories((prev) =>
      prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key],
    );
  }, []);

  const statusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return <Badge tone="success">Approved</Badge>;
      case "COMPLETED":
        return <Badge tone="info">Completed</Badge>;
      case "PROCESSING":
        return <Badge tone="info">Processing...</Badge>;
      case "FAILED":
        return <Badge tone="critical">Failed</Badge>;
      case "PENDING":
      default:
        return <Badge tone="warning">Pending</Badge>;
    }
  };

  return (
    <Page title="Visual Snapshots">
      <Card>
        <BlockStack gap="400">
          <Text as="h2" variant="headingMd">
            Baseline Capture
          </Text>

          <Button variant="primary" onClick={() => setModalOpen(true)}>
            Take Snapshots
          </Button>
        </BlockStack>
      </Card>

      <Card>
        <BlockStack gap="300">
          <InlineStack gap="400" blockAlign="center">
            <Text as="h2" variant="headingMd">
              Recent Snapshot Runs
            </Text>
            <div style={{ marginLeft: "auto" }}>
              <Button variant="plain">View all runs</Button>
            </div>
          </InlineStack>

          {runs.length === 0 ? (
            <Text as="p" tone="subdued">
              No snapshot runs yet. Click "Take Snapshots" to create your first run.
            </Text>
          ) : (
            <IndexTable
              resourceName={{ singular: "run", plural: "runs" }}
              itemCount={runs.length}
              selectable={false}
              headings={[
                { title: "Date & Time" },
                { title: "Status" },
                { title: "Page Count" },
                { title: "Actions" },
              ]}
            >
              {runs.map((run, index) => (
                <IndexTable.Row
                  id={run.id}
                  key={run.id}
                  position={index}
                >
                  <IndexTable.Cell>
                    <BlockStack gap="100">
                      <Text as="h3" variant="headingSm">
                        {localTimes[run.id] ??
                          `${run.createdAt.replace("T", " ").slice(0, 16)} UTC`}
                      </Text>

                      <Text as="p" tone="subdued" variant="bodySm">
                        Run ID: #{run.id.slice(0, 6)}
                      </Text>
                    </BlockStack>
                  </IndexTable.Cell>

                  <IndexTable.Cell>
                    {statusBadge(run.status)}
                  </IndexTable.Cell>

                  <IndexTable.Cell>
                    {run.pages.length} Pages
                  </IndexTable.Cell>

                  <IndexTable.Cell>
                    <InlineStack gap="200">
                      <Button size="slim">Compare</Button>
                      {run.status !== "APPROVED" && run.status !== "PENDING" && run.status !== "PROCESSING" && (
                        <Button size="slim" variant="primary">
                          Approve
                        </Button>
                      )}
                    </InlineStack>
                  </IndexTable.Cell>
                </IndexTable.Row>
              ))}
            </IndexTable>
          )}
        </BlockStack>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => !isLoading && setModalOpen(false)}
        title="Select page categories"
        primaryAction={{
          content: "Start capture",
          onAction: () =>
            fetcher.submit(
              { categories: JSON.stringify(categories) },
              { method: "post" },
            ),
          loading: isLoading,
          disabled: categories.length === 0 || isLoading,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => {
              if (!isLoading) {
                setModalOpen(false);
                setCategories([]);
              }
            },
            disabled: isLoading,
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="300">
            <Checkbox
              label="Homepage"
              checked={categories.includes("homepage")}
              onChange={() => toggleCategory("homepage")}
            />
            <Checkbox
              label="Products"
              checked={categories.includes("products")}
              onChange={() => toggleCategory("products")}
            />
            <Checkbox
              label="Collections"
              checked={categories.includes("collections")}
              onChange={() => toggleCategory("collections")}
            />
            <Checkbox
              label="Pages"
              checked={categories.includes("pages")}
              onChange={() => toggleCategory("pages")}
            />
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>


  );
}