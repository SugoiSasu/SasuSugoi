// Nitro's Vercel-preset build splits the TanStack Start SSR entry into two
// circularly-importing chunks (_ssr/ssr.mjs <-> _ssr/ssr2.mjs). Its Rollup
// output currently mishandles that circularity in two ways:
//
//   1. ssr.mjs re-exports a local binding `ssr_exports` that was never
//      defined/imported, crashing every request at import time with
//      "SyntaxError: Export 'ssr_exports' is not defined in module".
//   2. ssr2.mjs imports `createMiddleware` back from ssr.mjs, but that
//      binding never resolves to the real function, crashing CSRF
//      middleware setup with "createMiddleware is not a function".
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
  if (content.includes('var createMiddleware = (options, __opts) => {')) {
    console.log("[fix-nitro-vercel-ssr] ssr2.mjs already patched");
    return;
  }
  const brokenImport = 'import { o as createMiddleware } from "./ssr.mjs";\n';
  if (!content.includes(brokenImport)) {
    throw new Error(
      "[fix-nitro-vercel-ssr] expected circular createMiddleware import not found in _ssr/ssr2.mjs -- " +
      "nitro output shape changed, review this script (may mean the upstream bug is fixed).",
    );
  }
  const inlineImpl = `var createMiddleware = (options, __opts) => {
	const resolvedOptions = {
		type: "request",
		...__opts || options
	};
	const setValidator = (validator) => {
		return createMiddleware({}, Object.assign(resolvedOptions, {
			validator,
			inputValidator: validator
		}));
	};
	return {
		options: resolvedOptions,
		middleware: (middleware) => {
			return createMiddleware({}, Object.assign(resolvedOptions, { middleware }));
		},
		validator: setValidator,
		inputValidator: setValidator,
		client: (client) => {
			return createMiddleware({}, Object.assign(resolvedOptions, { client }));
		},
		server: (server) => {
			return createMiddleware({}, Object.assign(resolvedOptions, { server }));
		}
	};
};
`;
  content = content.replace(brokenImport, inlineImpl);
  writeFileSync(SSR2_PATH, content, "utf-8");
  console.log("[fix-nitro-vercel-ssr] broke circular createMiddleware import in ssr2.mjs (inlined instead)");
}

patchSsrExports();
patchCircularCreateMiddleware();
