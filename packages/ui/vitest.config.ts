import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "ui",
    environment: "jsdom",
    include: ["tests/**/*.test.ts"],
  },
});
