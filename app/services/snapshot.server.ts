// app/services/snapshot.server.ts
import { chromium } from "playwright";
import path from "path";

export async function takeSnapshots({
  pages,
  outputDir,
  password,
}: {
  pages: { name: string; url: string }[];
  outputDir: string;
  password?: string;
}) {
  const browser = await chromium.launch({ headless: true });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });

  const page = await context.newPage();

  // 1️⃣ Open homepage first (important)
  await page.goto(pages[0].url, { waitUntil: "domcontentloaded" });

  // 2️⃣ Handle Shopify password page (ONCE)
  if (password) {
    const passwordInput = await page.$("#password");

    if (passwordInput) {
      await page.fill("#password", password);
      await Promise.all([
        page.click('button[type="submit"]'),
        page.waitForNavigation({ waitUntil: "networkidle" }),
      ]);
    }
  }

  // 3️⃣ Disable animations AFTER unlock
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
      }
    `,
  });

  // 4️⃣ Screenshot loop
  for (const p of pages) {
    await page.goto(p.url, { waitUntil: "networkidle" });
    await page.screenshot({
      path: path.join(outputDir, `${p.name}.png`),
      fullPage: true,
    });
  }

  await browser.close();
}
