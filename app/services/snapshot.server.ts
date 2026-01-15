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
  const browser = await chromium.launch({
    headless: false,
    args: [
      "--disable-cache",
      "--disable-application-cache",
      "--disable-offline-load-stale-cache",
      "--disk-cache-size=0",
      "--media-cache-size=0",
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    bypassCSP: true,
    serviceWorkers: "block",
  });

  for (const p of pages) {
    const page = await context.newPage();

    const freshUrl = `${p.url}?t=${Date.now()}`;


    await page.goto(freshUrl, { waitUntil: "networkidle", timeout: 60_000 });

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

    // allow SPA hydration to settle
    await page.waitForTimeout(1500);

    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation: none !important;
          transition: none !important;
        }
      `,
    });

    await page.screenshot({
      path: path.join(outputDir, `${p.name}.png`),
      fullPage: true,
    });

    await page.close();
  }

  await context.close();
  await browser.close();
}
