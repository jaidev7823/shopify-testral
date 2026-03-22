// app/hooks/useEnv.ts
import { useRouteLoaderData } from "react-router";

export function useEnv() {
  return useRouteLoaderData("root") as {
    ENV: {
      PUBLIC_BASE_URL: process.env.SHOPIFY_APP_URL;
      DATABASE_URL: string;
    };
  };
}
