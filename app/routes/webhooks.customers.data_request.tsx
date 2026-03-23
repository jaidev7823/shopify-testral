import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { payload, topic, shop } = await authenticate.webhook(request);
    console.log(`Received ${topic} for ${shop}`);
    console.log("Payload:", JSON.stringify(payload, null, 2));
    return new Response(null, { status: 200 });
  } catch (error) {
    console.error("Webhook authentication failed:", error);
    return new Response("Unauthorized", { status: 401 });
  }
};
