import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: { MRA_MODEL: "test/model-from-vitest-config" },
  },
});
