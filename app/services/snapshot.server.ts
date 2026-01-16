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
  // 1. Launch with aggressive cache disabling flags
  const browser = await chromium.launch({
    headless: false, // Set to true for stability, change to false ONLY for debugging
    args: [
      '--disable-http-cache',
      '--disable-cache',
      '--disk-cache-size=0',
    ]
  });

  // 2. Create a totally fresh context for every run
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    offline: false,
  });

  try {
    for (const p of pages) {
      const page = await context.newPage();

      // 3. FORCE the browser to ignore cache for every request
      await page.route('**/*', (route) => {
        const headers = {
          ...route.request().headers(),
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        };
        route.continue({ headers });
      });

      try {
        const freshUrl = `${p.url}?nocache=${Date.now()}`;
        console.log(`[Snapshot] Navigating to: ${p.name}`);

        // Use 'domcontentloaded' instead of 'networkidle' if it hangs. 
        // Some Shopify apps keep the network busy forever (chat bots, etc.)
        await page.goto(freshUrl, {
          waitUntil: "networkidle",
          timeout: 60000
        });

        if (password) {
          const passwordInput = await page.$('input[name="password"], #password');
          if (passwordInput) {
            await passwordInput.fill(password);
            await Promise.all([
              page.waitForNavigation({ waitUntil: "networkidle" }),
              page.keyboard.press("Enter"),
            ]);
            // Give Shopify a moment to redirect after password
            await page.waitForTimeout(2000);
          }
        }

        // 4. Final "Settling" time for JS/Animations
        await page.waitForTimeout(2000);

        await page.screenshot({
          path: path.join(outputDir, `${p.name}.png`),
          fullPage: true,
        });

        console.log(`[Snapshot] Saved: ${p.name}`);
      } catch (err) {
        // Fix: Check if it's a real Error object
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`[Snapshot] Failed page ${p.name}:`, errorMessage);
      } finally {
        await page.close();
      }
    }
  } finally {
    console.log("[Snapshot] Closing browser...");
    await context.close().catch(() => { }); // Catch potential close errors
    await browser.close().catch(() => { }); // Catch potential close errors
    console.log("[Snapshot] Browser closed.");
    // DO NOT ADD ANY RETURN STATEMENTS HERE
  }
}