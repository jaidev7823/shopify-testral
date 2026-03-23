import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, topic, shop } = await authenticate.webhook(request);

  console.log(`Received ${topic} for ${shop}`);

  const customerId = payload.customer?.id;

  // delete customer data from your DB
  if (customerId) {
    await db.yourTable.deleteMany({
      where: { customerId: String(customerId) },
    });
  }

  return new Response();
};
