import { defineConfig } from "vitest/config";

// `npm test` at the root runs every workspace's own test config.
export default defineConfig({
  test: {
    projects: ["packages/*", "apps/*"],
  },
});
