import { defineConfig } from "vitest/config";

export default defineConfig({
  // Relative base so the built site works from any folder or sub-path.
  base: "./",
  build: { target: "es2022" },
  test: {
    name: "web",
    environment: "jsdom",
    include: ["tests/**/*.test.ts"],
  },
});
