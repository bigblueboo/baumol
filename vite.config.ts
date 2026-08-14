import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
  },
  server: {
    host: true,
    port: 6414,
    strictPort: true,
    allowedHosts: ["m4air", "m4air.local", "iphone-14-pro-max", ".ts.net"],
  },
  preview: {
    host: true,
    port: 6415,
    strictPort: true,
    allowedHosts: ["m4air", "m4air.local", "iphone-14-pro-max", ".ts.net"],
  },
});
