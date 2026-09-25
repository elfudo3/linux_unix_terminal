import { defineConfig } from "vitest/config";

export default defineConfig({
  // Relative base so the built site works from any folder or sub-path.
  base: "./",
  build: { target: "es2022" },
  test: {
    // Core and trainer tests run in plain Node; UI tests opt into jsdom
    // with a `// @vitest-environment jsdom` comment at the top of the file.
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
