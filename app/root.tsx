import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import { json } from "@remix-run/node";
import { useLoaderData } from "react-router";
import "@shopify/polaris/build/esm/styles.css";
export async function loader() {
  return json({
    ENV: {
      PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL ?? "",
    },
  });
}
export default function App() {
  const { ENV } = useLoaderData<typeof loader>();

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        />
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
