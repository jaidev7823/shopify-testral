// app/utils/snapshot-paths.server.ts
import fs from "fs";
import path from "path";

export function createSnapshotDir(shop: string) {
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-");

  // 1. Define the path inside the 'public' folder so it's accessible to the web
  // This will look like: /your-project/public/snapshots/your-store.myshopify.com/2023-10-27...
  const dir = path.join(
    process.cwd(),
    "public",
    "snapshots",
    shop,
    timestamp
  );

  // 2. Create the folder (recursive: true ensures all parent folders are created too)
  fs.mkdirSync(dir, { recursive: true });

  return dir;
}