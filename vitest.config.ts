import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    environmentOptions: { timezone: "UTC" },
    include: ["tests/**/*.test.{js,ts}"],
    passWithNoTests: true,
  },
});
