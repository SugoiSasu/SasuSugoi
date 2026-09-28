import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { sentryTanstackStart } from "@sentry/tanstackstart-react/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

// Znacznik builda - ten sam w kodzie przegladarki i serwera tego samego
// deployu. Aplikacja z ekranu glownego iPhone'a wznawia sie z pamieci ze
// starym JS; porownanie ze znacznikiem serwera mowi, ze wyszla nowa wersja.
const PZ_WERSJA = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || `lokalna-${Date.now()}`;

export default defineConfig({
  define: {
    __PZ_WERSJA__: JSON.stringify(PZ_WERSJA),
  },
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
