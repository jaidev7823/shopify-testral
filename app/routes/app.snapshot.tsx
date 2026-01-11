import { useState, useCallback, useEffect } from "react";
import { useFetcher } from "react-router";
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
} from "@shopify/polaris";
import { takeSnapshots } from "~/services/snapshot.server";
import { createSnapshotDir } from "~/utils/snapshot-paths.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

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

    // 1️⃣ Homepage
    if (categories.includes("homepage")) {
      pages.push({
        name: "homepage",
        url: storeUrl,
      });
    }

    // 2️⃣ Products
    if (categories.includes("products")) {
      try {
        const res = await admin.graphql(`
          query {
            products(first: 20) {
              nodes { handle }
            }
          }
        `);

        const json = await res.json() as { data?: { products?: { nodes?: Array<{ handle: string }> } }; errors?: Array<{ message: string }> };
        if (json.errors) {
          throw new Error(`GraphQL error: ${JSON.stringify(json.errors)}`);
        }

        const products = json.data?.products?.nodes || [];

        for (const p of products) {
          pages.push({
            name: `product-${p.handle}`,
            url: `${storeUrl}/products/${p.handle}`,
          });
        }
      } catch (error) {
        console.error("Error fetching products:", error);
        return { ok: false, error: `Failed to fetch products: ${error instanceof Error ? error.message : String(error)}` };
      }
    }

    // 3️⃣ Collections
    if (categories.includes("collections")) {
      try {
        const res = await admin.graphql(`
          query {
            collections(first: 20) {
              nodes { handle }
            }
          }
        `);

        const json = await res.json() as { data?: { collections?: { nodes?: Array<{ handle: string }> } }; errors?: Array<{ message: string }> };
        if (json.errors) {
          throw new Error(`GraphQL error: ${JSON.stringify(json.errors)}`);
        }

        const collections = json.data?.collections?.nodes || [];

        for (const c of collections) {
          pages.push({
            name: `collection-${c.handle}`,
            url: `${storeUrl}/collections/${c.handle}`,
          });
        }
      } catch (error) {
        console.error("Error fetching collections:", error);
        return { ok: false, error: `Failed to fetch collections: ${error instanceof Error ? error.message : String(error)}` };
      }
    }

    // 4️⃣ Pages
    if (categories.includes("pages")) {
      try {
        const res = await admin.graphql(`
          query {
            pages(first: 20) {
              nodes { handle }
            }
          }
        `);

        const json = await res.json() as { data?: { pages?: { nodes?: Array<{ handle: string }> } }; errors?: Array<{ message: string }> };
        if (json.errors) {
          throw new Error(`GraphQL error: ${JSON.stringify(json.errors)}`);
        }

        const pagesData = json.data?.pages?.nodes || [];

        for (const p of pagesData) {
          pages.push({
            name: `page-${p.handle}`,
            url: `${storeUrl}/pages/${p.handle}`,
          });
        }
      } catch (error) {
        console.error("Error fetching pages:", error);
        return { ok: false, error: `Failed to fetch pages: ${error instanceof Error ? error.message : String(error)}` };
      }
    }

    if (pages.length === 0) {
      return { ok: false, error: "No pages found to snapshot" };
    }

    // 📁 Create snapshot folder
    const outputDir = createSnapshotDir(session.shop);

    // ▶️ RUN SNAPSHOT COMMAND
    try {
      await takeSnapshots({
        pages,
        outputDir,
        password: "123",
      });
    } catch (error) {
      console.error("Error taking snapshots:", error);
      return { ok: false, error: `Failed to take snapshots: ${error instanceof Error ? error.message : String(error)}` };
    }

    return { ok: true, count: pages.length, outputDir };
  } catch (error) {
    console.error("Action error:", error);
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
};

export default function SnapshotPage() {
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  
  const isLoading =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";

  const [modalOpen, setModalOpen] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);

  // Handle response from action
  useEffect(() => {
    if (fetcher.data) {
      if (fetcher.data.ok) {
        shopify.toast.show(
          `Successfully captured ${fetcher.data.count} page${fetcher.data.count !== 1 ? "s" : ""}`,
          { duration: 5000 }
        );
        setModalOpen(false);
        setCategories([]);
      } else {
        shopify.toast.show(
          `Error: ${fetcher.data.error || "Unknown error"}`,
          { duration: 5000, isError: true }
        );
      }
    }
  }, [fetcher.data, shopify]);


  const toggleCategory = useCallback((key: string) => {
    setCategories((prev) =>
      prev.includes(key)
        ? prev.filter((c) => c !== key)
        : [...prev, key],
    );
  }, []);

  const submitSnapshots = () => {
    if (categories.length === 0) {
      shopify.toast.show("Please select at least one category", { isError: true });
      return;
    }
    
    fetcher.submit(
      {
        categories: JSON.stringify(categories),
      },
      { method: "post" },
    );
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

      <Modal
        open={modalOpen}
        onClose={() => {
          if (!isLoading) {
            setModalOpen(false);
            setCategories([]);
          }
        }}
        title="Select page categories"
        primaryAction={{
          content: "Start capture",
          onAction: submitSnapshots,
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
