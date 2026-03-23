import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  // This validates HMAC and will send 401 if invalid:
  const { topic, shop, session, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  switch (topic) {
    case "APP_UNINSTALLED":
      if (session) {
        await db.session.deleteMany({ where: { shop } });
      }
      break;

    case "CUSTOMERS_DATA_REQUEST": {
      // GDPR - customer data request
      const customerId = payload.customer?.id;
      if (customerId) {
        await db.yourTable.deleteMany({
          where: { customerId: String(customerId) },
        });
      }
      break;
    }

    case "CUSTOMERS_REDACT": {
      const customerId = payload.customer?.id;
      if (customerId) {
        await db.yourTable.deleteMany({
          where: { customerId: String(customerId) },
        });
      }
      break;
    }

    case "SHOP_REDACT":
      await db.yourTable.deleteMany({ where: { shop } });
      break;

    default:
      // Optional: unknown topic → 404 or 200 depending on your needs
      // For app review you can safely do 404 here
      throw new Response("Unhandled webhook topic", { status: 404 });
  }

  // Must return 200 for successful processing
  return new Response(null, { status: 200 });
};