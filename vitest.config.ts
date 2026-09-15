import { defineConfig } from "vitest/config";
import tsConfigPaths from "vite-tsconfig-paths";

// Deliberately separate from vite.config.ts: that one loads the TanStack
// Start and Nitro plugins, which spin up a whole server build the unit tests
// have no use for. Tests here cover pure logic, so they only need the "@/"
// path alias to resolve.
export default defineConfig({
  plugins: [tsConfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
