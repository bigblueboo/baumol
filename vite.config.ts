import { defineConfig } from "vitest/config";

const allowedHosts = ["m4air", "m4air.local", "iphone-14-pro-max", ".ts.net"];

export default defineConfig({
  server: { host: true, port: 6170, strictPort: true, allowedHosts },
  preview: { host: true, port: 6171, strictPort: true, allowedHosts },
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});
