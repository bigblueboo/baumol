import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  reporter: "list",
  timeout: 120_000,
  // A 16 GB fanless machine: more workers starve the rAF-driven sim.
  workers: 2,
  use: {
    baseURL: "http://localhost:6416",
    trace: "retain-on-failure",
  },
  webServer: {
    // e2e runs against the production build: static, no HMR reloads, no
    // dependency re-optimization mid-suite.
    command: "npx vite build && npx vite preview --port 6416 --strictPort",
    url: "http://localhost:6416",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } },
    },
    {
      // Chromium with phone metrics: WebKit can't launch reliably on this
      // memory-constrained box, and the tests target layout, not engines.
      name: "phone",
      use: {
        ...devices["iPhone 14 Pro Max"],
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
      },
    },
  ],
});
