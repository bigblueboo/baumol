import { defineConfig, devices } from "@playwright/test";

const port = 6172;

export default defineConfig({
  testDir: "e2e",
  reporter: "list",
  timeout: 60_000,
  // No filmstrip in traces: WebKit's screencast frames pile up in kernel memory while the Mac's display sleeps.
  use: { baseURL: `http://localhost:${port}`, trace: { mode: "retain-on-failure", screenshots: false } },
  webServer: {
    command: `npx vite --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: true,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1360, height: 900 } } },
    { name: "phone", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
  ],
});
