import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { authenticate } from "~/shopify.server";
import { useState } from "react";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";

type ResourceResult = {
  nodes: any[];
  pageInfo?: {
    hasNextPage: boolean;
  };
};

type ActionData = {
  data: Record<"products" | "collections" | "pages" | "blogs", ResourceResult>;
};


// ── Loader: only for initial page load (optional) ─────────────────────────────
export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return json({ initial: "Ready" });
};

// ── Action: triggered when button is clicked ────────────────────────────────
export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const graphql = admin.graphql;

  // You can increase first:50 → 100/250 depending on store size
  // Real stores with >1000 items need pagination (cursor + loop)
  const queries = {
    products: `
      query GetProducts {
        products(first: 100) {
          nodes {
            id
            title
            handle
            status
          }
          pageInfo {
            hasNextPage
          }
        }
      }
    `,
    collections: `
      query GetCollections {
        collections(first: 100) {
          nodes {
            id
            title
            handle
            updatedAt
          }
          pageInfo {
            hasNextPage
          }
        }
      }
    `,
    pages: `
      query GetPages {
        pages(first: 100) {
          nodes {
            id
            title
            handle
            updatedAt
          }
          pageInfo {
            hasNextPage
          }
        }
      }
    `,
    blogs: `
      query GetBlogs {
        blogs(first: 100) {
          nodes {
            id
            title
            handle
          }
          pageInfo {
            hasNextPage
          }
        }
      }
    `
  };

  const results: Record<string, any> = {};

  for (const [key, query] of Object.entries(queries)) {
    try {
      const response = await graphql(query);
      const json = await response.json();
      results[key] = json.data?.[key]?.nodes ?? [];
    } catch (err) {
      results[key] = { error: (err as Error).message };
    }
  }

  return json({ data: results });
};

export default function Resources() {
  const fetcher = useFetcher<ActionData>();
  const [activeTab, setActiveTab] = useState<"products" | "collections" | "pages" | "blogs">("products");

  const isLoading = fetcher.state !== "idle";
  const data = fetcher.data?.data;

  return (
    <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      <h1>Store Resources Snapshot</h1>
      <p>Use this view to quickly check current store content.</p>

      <fetcher.Form method="post">
        <button
          type="submit"
          disabled={isLoading}
          style={{
            padding: "12px 24px",
            fontSize: "16px",
            background: isLoading ? "#ccc" : "#2c6ecb",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: isLoading ? "not-allowed" : "pointer",
            margin: "1.5rem 0"
          }}
        >
          {isLoading ? "Loading..." : "Load All Resources"}
        </button>
      </fetcher.Form>

      {data && (
        <>
          <div style={{ margin: "1.5rem 0", display: "flex", gap: "1rem" }}>
            {(["products", "collections", "pages", "blogs"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: "8px 16px",
                  background: activeTab === tab ? "#2c6ecb" : "#eee",
                  color: activeTab === tab ? "white" : "black",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer"
                }}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

            <TableView
              title={activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
              items={data[activeTab]?.nodes ?? []}
              columns={getColumnsForTab(activeTab)}
              hasNextPage={data[activeTab]?.pageInfo?.hasNextPage}
            />

        </>
      )}
    </div>
  );
}

function TableView({
  title,
  items,
  columns,
  hasNextPage,
}: {
  title: string;
  items: any[];
  columns: string[];
  hasNextPage?: boolean;
}) {
  if (items.length === 0) {
    return <p style={{ color: "#666" }}>No {title.toLowerCase()} found</p>;
  }

  return (
    <>
      <h2>{title} ({items.length})</h2>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "1rem" }}>
        <thead>
          <tr style={{ background: "#f5f5f5" }}>
            {columns.map((col) => (
              <th key={col} style={{ padding: "12px", textAlign: "left", borderBottom: "2px solid #ddd" }}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={item.id || i} style={{ borderBottom: "1px solid #eee" }}>
              {columns.map((col) => (
                <td key={col} style={{ padding: "12px" }}>
                  {item[col] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {hasNextPage && (
        <p style={{ color: "#d32f2f", marginTop: "1rem" }}>
          → Warning: More items exist (pagination not implemented yet)
        </p>
      )}
    </>
  );
}

function getColumnsForTab(tab: string): string[] {
  switch (tab) {
    case "products":     return ["id", "title", "handle", "status"];
    case "collections":  return ["id", "title", "handle", "updatedAt"];
    case "pages":        return ["id", "title", "handle", "updatedAt"];
    case "blogs":        return ["id", "title", "handle"];
    default:             return ["id", "title"];
  }
}