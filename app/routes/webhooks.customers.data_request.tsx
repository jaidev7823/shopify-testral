import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, topic, shop } = await authenticate.webhook(request);

  console.log(`Received ${topic} for ${shop}`);

  // fetch + prepare customer data (if you store any)
  console.log(payload);

  return new Response();
};
