// app/services/snapshot-logic.server.ts
import { prisma } from "~/utils/prisma.server";

export async function getStorePages(admin: any, categories: string[], storeUrl: string) {
  const pages: { name: string; url: string }[] = [];
  
  const queryMap: Record<string, string> = {
    products: `query { products(first: 20) { nodes { handle } } }`,
    collections: `query { collections(first: 20) { nodes { handle } } }`,
    pages: `query { pages(first: 20) { nodes { handle } } }`,
  };

  if (categories.includes("homepage")) pages.push({ name: "homepage", url: storeUrl });

  for (const cat of categories.filter(c => c !== "homepage")) {
    if (!queryMap[cat]) continue;
    const res = await admin.graphql(queryMap[cat]);
    const json = await res.json();
    const nodes = json.data?.[cat]?.nodes || [];
    nodes.forEach((node: any) => {
      pages.push({
        name: `${cat.slice(0, -1)}-${node.handle}`,
        url: `${storeUrl}/${cat}/${node.handle}`,
      });
    });
  }
  return pages;
}