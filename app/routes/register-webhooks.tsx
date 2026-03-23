// app/routes/register-webhooks.tsx

import { authenticate } from "../shopify.server";
import { registerWebhooks } from "../shopify.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  await registerWebhooks({ session });

  return new Response("registered");
};
