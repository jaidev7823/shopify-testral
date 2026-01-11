// app/services/snapshot.server.ts
import { chromium } from "playwright";
import path from "path";

export async function takeSnapshots({
  pages,
  outputDir,
}: {
  pages: { name: string; url: string }[];
  outputDir: string;
}) {
  const browser = await chromium.launch({ headless: true });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });

  const page = await context.newPage();

  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
      }
    `,
  });

  for (const p of pages) {
    await page.goto(p.url, { waitUntil: "networkidle" });
    await page.screenshot({
      path: path.join(outputDir, `${p.name}.png`),
      fullPage: true,
    });
  }

  await browser.close();
}
