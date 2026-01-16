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
  // 1. Launch browser
  const browser = await chromium.launch({
    headless: true, // Revert to headless: true as requested, now that we have fixes
    args: [
      '--disable-http-cache',
      '--disable-cache',
      '--disk-cache-size=0',
      '--disable-service-workers-self-verification',
      '--disable-site-isolation-trials',
    ]
  });

  // 2. Create context with "Real User" characteristics
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    // Strict service worker blocking at context level
    serviceWorkers: 'block',
    // Real User Agent to avoid bot detection/switches
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    // Headers sent with *every* request, including the initial navigation
    extraHTTPHeaders: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
    bypassCSP: true, // Allow our injected scripts to run
  });

  // 3. NUCLEAR OPTION: Inject script to kill any existing Service Workers immediately
  await context.addInitScript(() => {
    // @ts-ignore
    if (window.navigator && navigator.serviceWorker) {
      // @ts-ignore
      navigator.serviceWorker.getRegistrations().then(registrations => {
        for (const registration of registrations) {
          registration.unregister();
        }
      });
    }
  });

  try {
    for (const p of pages) {
      const page = await context.newPage();

      // 4. CDP Session for low-level cache disabling (The "Real Way")
      const client = await page.context().newCDPSession(page);
      await client.send('Network.setCacheDisabled', { cacheDisabled: true });

      try {
        const freshUrl = `${p.url}?nocache=${Date.now()}`;
        console.log(`[Snapshot] Navigating to: ${p.name}`);

        // 5. Robust Navigation
        await page.goto(freshUrl, {
          waitUntil: "networkidle", // Wait for network to be quiet
          timeout: 60000
        });

        // 6. Login Handling (Run on every page to be safe, but cookie should persist)
        if (password) {
          // Check specifically for the password input that Shopify uses
          const passwordInput = await page.$('input[name="password"], #password');
          if (passwordInput) {
            console.log(`[Snapshot] Password protection detected for ${p.name}`);
            await passwordInput.fill(password);
            await Promise.all([
              page.waitForNavigation({ waitUntil: "networkidle" }),
              page.keyboard.press("Enter"),
            ]);
            // Small buffer for redirect/SW kill to take effect
            await page.waitForTimeout(1000);
          }
        }

        // 7. Final Settling
        // Wait a bit longer to ensure any "after load" JS/animations finish
        await page.waitForTimeout(3000);

        await page.screenshot({
          path: path.join(outputDir, `${p.name}.png`),
          fullPage: true,
        });

        console.log(`[Snapshot] Saved: ${p.name}`);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`[Snapshot] Failed page ${p.name}:`, errorMessage);
      } finally {
        await page.close();
      }
    }
  } finally {
    console.log("[Snapshot] Closing browser...");
    await context.close().catch(() => { });
    await browser.close().catch(() => { });
    console.log("[Snapshot] Browser closed.");
  }
}