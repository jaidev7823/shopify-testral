import { data, useFetcher } from "react-router";
import { authenticate } from "~/shopify.server";
import { useState, useCallback } from "react";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import {
  Page,
  Layout,
  Card,
  Button,
  DataTable,
  Tabs,
  Badge,
  Banner,
  BlockStack,
  Box,
  Text,
} from "@shopify/polaris";

type ResourceKey = "products" | "collections" | "pages" | "blogs";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return data({ ok: true });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const queries: Record<ResourceKey, string> = {
    products: `query { products(first: 100) { nodes { id title handle status } pageInfo { hasNextPage } } }`,
    collections: `query { collections(first: 100) { nodes { id title handle updatedAt } pageInfo { hasNextPage } } }`,
    pages: `query { pages(first: 100) { nodes { id title handle updatedAt } pageInfo { hasNextPage } } }`,
    blogs: `query { blogs(first: 100) { nodes { id title handle } pageInfo { hasNextPage } } }`,
  };

  const results: any = {};
  for (const key of Object.keys(queries) as ResourceKey[]) {
    try {
      const res = await admin.graphql(queries[key]);
      const json = await res.json();
      results[key] = json.data[key];
    } catch (e) {
      results[key] = { nodes: [] };
    }
  }
  return data({ data: results });
};

export default function Resources() {
  const fetcher = useFetcher<any>();
  const [selectedTab, setSelectedTab] = useState(0);

  const resourceKeys: ResourceKey[] = ["products", "collections", "pages", "blogs"];
  const activeTabKey = resourceKeys[selectedTab];
  
  const isLoading = fetcher.state !== "idle";
  const fetcherData = fetcher.data?.data;
  const resources = fetcherData?.[activeTabKey];

  const handleTabChange = useCallback(
    (selectedTabIndex: number) => setSelectedTab(selectedTabIndex),
    [],
  );

  const tabs = resourceKeys.map((key) => {
    const count = fetcherData?.[key]?.nodes?.length;
    const label = key.charAt(0).toUpperCase() + key.slice(1);
    return {
      id: key,
      content: count !== undefined ? `${label} (${count})` : label,
      accessibilityLabel: label,
      panelID: `${key}-panel`,
    };
  });

  const headings = getColumns(activeTabKey).map(col => col.toUpperCase());
  const rows = resources?.nodes.map((item: any) => 
    getColumns(activeTabKey).map((col) => String(item[col] ?? "—"))
  ) || [];

  return (
    <Page title="Store Resources">
      <Layout>
        {/* Top Control Section */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Data Management</Text>
              <Text as="p" variant="bodyMd">Fetch latest store data for products, collections, pages and blogs.</Text>
              <fetcher.Form method="post">
                <Button variant="primary" submit loading={isLoading}>
                  Load All Resources
                </Button>
              </fetcher.Form>

              {!fetcherData && !isLoading && (
                <Banner tone="info">
                  <p>Click "Load All Resources" to begin fetching data from Shopify.</p>
                </Banner>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Results Section */}
        {fetcherData && (
          <Layout.Section>
            <Card padding="0">
              <Tabs tabs={tabs} selected={selectedTab} onSelect={handleTabChange}>
                <Box padding="400">
                  <BlockStack gap="400">
                    <Box paddingBlockStart="200" paddingBlockEnd="200">
                      <Text as="h3" variant="headingSm">
                        Showing {activeTabKey}{" "}
                        {resources?.nodes && (
                          <Badge tone="info">{String(resources.nodes.length)}</Badge>
                        )}
                      </Text>
                    </Box>

                    {resources?.pageInfo?.hasNextPage && (
                      <Banner tone="warning">
                        <p>Your store has more than 100 {activeTabKey}. Only the first 100 are shown.</p>
                      </Banner>
                    )}

                    {resources?.nodes?.length ? (
                      <DataTable
                        columnContentTypes={getColumns(activeTabKey).map(() => "text")}
                        headings={headings}
                        rows={rows}
                      />
                    ) : (
                      <Banner tone="warning">
                        <p>No {activeTabKey} found in this store.</p>
                      </Banner>
                    )}
                  </BlockStack>
                </Box>
              </Tabs>
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}

function getColumns(tab: ResourceKey): string[] {
  switch (tab) {
    case "products": return ["id", "title", "handle", "status"];
    case "collections": return ["id", "title", "handle", "updatedAt"];
    case "pages": return ["id", "title", "handle", "updatedAt"];
    case "blogs": return ["id", "title", "handle"];
    default: return [];
  }
}