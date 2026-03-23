import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} for ${shop}`);

  // delete ALL shop data
  await db.yourTable.deleteMany({
    where: { shop },
  });

  return new Response();
};
