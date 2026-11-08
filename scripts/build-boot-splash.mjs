// Renderuje animacje "pozerania" logo (src/lib/boot-splash-art.ts) do animowanego WebP:
// public/brand/boot-chomp.webp. Zasila ekran startowy aplikacji natywnej (src/lib/boot-splash.ts).
//
// Uzycie (jednorazowo po zmianie rysunku lub czasow w boot-splash-art.ts):
//   npm i --no-save playwright-core sharp
//   node scripts/build-boot-splash.mjs
// Wymaga Chrome (domyslna sciezka Windows; inna: CHROME_PATH).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import sharp from "sharp";
import { ART_CSS, ART_SVG, SEQUENCE_S } from "../src/lib/boot-splash-art.ts";

const KATALOG = path.dirname(fileURLToPath(import.meta.url));
const WYJSCIE = path.join(KATALOG, "../public/brand/boot-chomp.webp");
const LOGO = path.join(KATALOG, "../public/brand/po_zeramy-logo-dark-nav.webp");
const FPS = 20;
const DPR = 2;
// Plotno: logo 112x112 + 6 px zapasu na "ściśnięcie" po bokach/u góry i 38 px pod spodem na spadające okruszki.
const W = 124;
const H = 156;

const logo64 = fs.readFileSync(LOGO).toString("base64");
const svg = ART_SVG.replace("/brand/po_zeramy-logo-dark-nav.webp", `data:image/webp;base64,${logo64}`);
const html =
  `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent}` +
  `#pz-boot{width:112px;padding:6px 6px 38px}${ART_CSS}</style><div id="pz-boot">${svg}</div>`;

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe",
});
const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR })).newPage();
await page.setContent(html);

const klatki = [];
const N = Math.round(SEQUENCE_S * FPS);
for (let i = 0; i < N; i++) {
  // Zatrzymujemy wszystkie animacje CSS w danej chwili - klatki sa deterministyczne, niezalezne od tempa maszyny.
  await page.evaluate((t) => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = t * 1000; }), i / FPS);
  klatki.push(await page.screenshot({ clip: { x: 0, y: 0, width: W, height: H }, omitBackground: true }));
}
await browser.close();

const out = await sharp(klatki, { join: { animated: true } })
  .webp({ loop: 1, delay: Array(N).fill(Math.round(1000 / FPS)), quality: 72, alphaQuality: 80, effort: 5 })
  .toBuffer();
fs.writeFileSync(WYJSCIE, out);
const meta = await sharp(out, { animated: true }).metadata();
console.log(`klatek: ${N}, strony: ${meta.pages}, ${meta.width}x${meta.pageHeight}, ${(out.length / 1024).toFixed(0)} KB`);
