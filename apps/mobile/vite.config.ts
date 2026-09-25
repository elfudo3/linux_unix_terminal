import { readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";

const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

export default defineConfig({
  // Relative base: works inside the native app bundle and under a sub-path on the web.
  base: "./",
  build: { target: "es2022" },
  define: { __APP_VERSION__: JSON.stringify(version) },
  test: {
    name: "mobile",
    environment: "jsdom",
    include: ["tests/**/*.test.ts"],
  },
});
