#!/usr/bin/env node
/**
 * Pre-deploy guard: fails if any source file, email template, sitemap
 * or robots.txt references a legacy domain instead of pozeramy.live.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");

const FORBIDDEN = [
  "pozeramy.lovable.app",
  "id-preview--69a907e9-12b9-4311-a050-0bcead17962f.lovable.app",
];

const REQUIRED_BASE = "pozeramy.live";

const SCAN_DIRS = ["src", "public", "supabase/functions"];
const SCAN_EXT = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".json", ".html", ".xml", ".txt", ".md",
]);
const SKIP = new Set(["node_modules", ".git", "dist", "build", ".lovable"]);
const SKIP_FILES = new Set([
  "src/lib/site-config.ts",
  "scripts/check-domains.mjs",
]);

const violations = [];

function walk(dir) {
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const name of entries) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) { walk(p); continue; }
    if (name === "routeTree.gen.ts") continue;
    if (name === "bun.lock" || name === "package-lock.json") continue;
    if (!SCAN_EXT.has(extname(name))) continue;
    const rel = p.replace(ROOT + "/", "");
    if (SKIP_FILES.has(rel)) continue;
    const text = readFileSync(p, "utf8");
    const lines = text.split("\n");
    for (const bad of FORBIDDEN) {
      lines.forEach((line, i) => {
        if (line.includes(bad)) {
          violations.push({ file: rel, line: i + 1, match: bad });
        }
      });
    }
  }
}

for (const d of SCAN_DIRS) walk(join(ROOT, d));

const required = [
  { label: "sitemap BASE_URL", path: "src/routes/sitemap[.]xml.ts", needle: `BASE_URL` },
  { label: "robots.txt sitemap reference", path: "public/robots.txt", needle: `https://${REQUIRED_BASE}/sitemap.xml` },
  { label: "auth webhook ROOT_DOMAIN", path: "src/routes/lovable/email/auth/webhook.ts", needle: `"${REQUIRED_BASE}"` },
  { label: "email preview ROOT_DOMAIN", path: "src/routes/lovable/email/auth/preview.ts", needle: `"${REQUIRED_BASE}"` },
  { label: "central APP_URL config", path: "src/lib/site-config.ts", needle: `"${REQUIRED_BASE}"` },
];

const missing = [];
for (const r of required) {
  let body = "";
  try { body = readFileSync(join(ROOT, r.path), "utf8"); }
  catch { missing.push(`${r.label}: file not found (${r.path})`); continue; }
  if (!body.includes(r.needle)) {
    missing.push(`${r.label}: missing "${r.needle}" in ${r.path}`);
  }
}

const TEMPLATE_DIR = join(ROOT, "src/lib/email-templates");
let templateFiles = [];
try { templateFiles = readdirSync(TEMPLATE_DIR).filter((f) => f.endsWith(".tsx")); } catch {}
for (const t of templateFiles) {
  const body = readFileSync(join(TEMPLATE_DIR, t), "utf8");
  for (const bad of FORBIDDEN) {
    if (body.includes(bad)) {
      violations.push({ file: `src/lib/email-templates/${t}`, line: 0, match: bad });
    }
  }
}

let failed = false;
if (violations.length) {
  failed = true;
  console.error("\n❌ Forbidden legacy domain references:");
  for (const v of violations) {
    console.error(`  - ${v.file}:${v.line}  →  ${v.match}`);
  }
}
if (missing.length) {
  failed = true;
  console.error("\n❌ Required pozeramy.live references missing:");
  for (const m of missing) console.error(`  - ${m}`);
}

if (failed) {
  console.error(`\nFix the above before deploying.\n`);
  process.exit(1);
}

console.log(`✅ Domain check passed — no legacy references, ${REQUIRED_BASE} wired everywhere.`);
console.log(`   Scanned: ${SCAN_DIRS.join(", ")}  •  Email templates: ${templateFiles.length}`);
