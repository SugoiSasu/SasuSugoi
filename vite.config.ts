import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { sentryTanstackStart } from "@sentry/tanstackstart-react/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  resolve: {
    dedupe: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-start"],
  },
  plugins: [
    tsConfigPaths(),
    tailwindcss(),
    tanstackStart({ server: { entry: "./src/server.ts" } }),
    nitro({ preset: "vercel" }),
    viteReact(),
    // Uploads source maps so Sentry shows real stack traces instead of
    // minified ones - only runs when SENTRY_AUTH_TOKEN is set (e.g. in CI/
    // Vercel env vars), so a missing token just skips upload rather than
    // failing the build.
    ...(process.env.SENTRY_AUTH_TOKEN
      ? [sentryTanstackStart({ org: "pozeramy", project: "javascript-tanstackstart-react", authToken: process.env.SENTRY_AUTH_TOKEN })]
      : []),
  ],
});
