// Nitro's Vercel-preset build splits the TanStack Start SSR entry into two
// circularly-importing chunks (_ssr/ssr.mjs <-> _ssr/ssr2.mjs). Its Rollup
// output currently mishandles that circularity in two ways:
//
//   1. ssr.mjs re-exports a local binding `ssr_exports` that was never
//      defined/imported, crashing every request at import time with
//      "SyntaxError: Export 'ssr_exports' is not defined in module".
//   2. ssr2.mjs calls a middleware-factory function imported back from
//      ssr.mjs (originally `createMiddleware`, later renamed upstream to
//      `createCsrfMiddleware`) at its own top level, while ssr.mjs is still
//      mid-evaluation importing ssr2.mjs -- that eager call sees an
//      unresolved binding and crashes with "<name> is not a function".
//      The fix defers the call to first use instead of hardcoding the
//      current function name, since that name has already drifted once.
//
// Both are upstream bundler bugs (reproduced across nitro 3.0.260522-beta,
// 3.0.260603-beta and 3.0.260610-beta) in generated output, not in our
// source. This patches the deterministic, narrow symptom after every build
// so production actually boots. Safe to delete once nitro ships a fix --
// each check below will throw loudly if the expected broken pattern is no
// longer present, so an upstream fix (or an unrelated change to this
// generated file) surfaces immediately instead of silently no-opping.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const FUNC_DIR = join(process.cwd(), ".vercel/output/functions/__server.func");
const SSR_PATH = join(FUNC_DIR, "_ssr/ssr.mjs");
const SSR2_PATH = join(FUNC_DIR, "_ssr/ssr2.mjs");

if (!existsSync(FUNC_DIR)) {
  console.log("[fix-nitro-vercel-ssr] no .vercel/output function dir found, skipping (not a vercel build)");
  process.exit(0);
}

function patchSsrExports() {
  let content = readFileSync(SSR_PATH, "utf-8");
  if (content.includes("var ssr_exports = {")) {
    console.log("[fix-nitro-vercel-ssr] ssr.mjs already patched");
    return;
  }
  const target = "export { ssr_exports as a,";
  if (!content.includes(target)) {
    throw new Error(
      "[fix-nitro-vercel-ssr] expected broken 'ssr_exports' export not found in _ssr/ssr.mjs -- " +
      "nitro output shape changed, review this script (may mean the upstream bug is fixed).",
    );
  }
  const namespaceObject =
    "var ssr_exports = { createServerEntry, default: server_default, getRequest, TSS_SERVER_FUNCTION, createMiddleware, getServerFnById, createServerFn };\n";
  content = content.replace(target, namespaceObject + target);
  writeFileSync(SSR_PATH, content, "utf-8");
  console.log("[fix-nitro-vercel-ssr] patched missing ssr_exports namespace object in ssr.mjs");
}

function patchCircularCreateMiddleware() {
  let content = readFileSync(SSR2_PATH, "utf-8");
  const lazyMarker = "function __lazyDefaultCsrfMiddleware()";
  if (content.includes(lazyMarker)) {
    console.log("[fix-nitro-vercel-ssr] ssr2.mjs already patched");
    return;
  }
  // Structural pattern, not a hardcoded function name: `defaultCsrfMiddleware`
  // is TanStack Start's own stable variable name for this singleton; the
  // factory function it calls (2nd capture group) is whatever this build's
  // circular import resolved to -- that's the part that already drifted
  // once (createMiddleware -> createCsrfMiddleware) and will likely drift
  // again on a future upstream bump.
  const eagerInitRegex = /var defaultCsrfMiddleware = (\w+)\(([^;]*)\);\n/;
  const match = content.match(eagerInitRegex);
  if (!match) {
    throw new Error(
      "[fix-nitro-vercel-ssr] expected eager 'defaultCsrfMiddleware' top-level init not found in _ssr/ssr2.mjs -- " +
      "nitro output shape changed, review this script (may mean the upstream bug is fixed).",
    );
  }
  const [fullMatch, factoryFnName, args] = match;
  const lazyInit =
    `let __defaultCsrfMiddlewareCache;\n` +
    `${lazyMarker} { return __defaultCsrfMiddlewareCache ??= ${factoryFnName}(${args}); }\n`;
  content = content.replace(fullMatch, lazyInit);

  // Usage site shape depends on build config: a plain array literal
  // `[defaultCsrfMiddleware]` normally, or an object-shorthand
  // `{ defaultCsrfMiddleware }` passed into `wrapMiddlewaresWithSentry(...)`
  // when @sentry/tanstackstart-react's vite plugin is active (its
  // SENTRY_AUTH_TOKEN-gated branch in vite.config.ts). Object shorthand
  // needs `key: value` on replace, not a bare call, or the syntax breaks.
  let usageCount = 0;
  content = content.replace(/\[defaultCsrfMiddleware\]/g, () => {
    usageCount++;
    return "[__lazyDefaultCsrfMiddleware()]";
  });
  content = content.replace(/\{\s*defaultCsrfMiddleware\s*\}/g, () => {
    usageCount++;
    return "{ defaultCsrfMiddleware: __lazyDefaultCsrfMiddleware() }";
  });
  if (usageCount === 0) {
    throw new Error(
      "[fix-nitro-vercel-ssr] expected 'defaultCsrfMiddleware' usage site not found in _ssr/ssr2.mjs -- " +
      "nitro output shape changed, review this script (may mean the upstream bug is fixed).",
    );
  }

  writeFileSync(SSR2_PATH, content, "utf-8");
  console.log(
    `[fix-nitro-vercel-ssr] deferred eager circular ${factoryFnName}() call to first use in ssr2.mjs (${usageCount} usage site(s))`,
  );
}

patchSsrExports();
patchCircularCreateMiddleware();
