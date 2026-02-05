import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    // Replaces 'outputDir'
    screenshotsFolder: "screenshots/output", 
    video: false,
    chromeWebSecurity: false, // Allows cross-origin if needed
    setupNodeEvents(on, config) {
      on('before:browser:launch', (browser, launchOptions) => {
        if (browser.family === 'chromium' && browser.name !== 'electron') {
          // Replicates your Playwright args
          launchOptions.args.push('--disable-http-cache');
          launchOptions.args.push('--disk-cache-size=0');
          launchOptions.args.push('--disable-site-isolation-trials');
          return launchOptions;
        }
      });
    },
  },
});