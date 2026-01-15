// app/utils/snapshot-paths.server.ts
import fs from "fs";
import path from "path";

export function createSnapshotDir(shop: string) {
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-");

  const dir = path.join(
    process.cwd(),
  );

  fs.mkdirSync(dir, { recursive: true });

  return dir;
}
