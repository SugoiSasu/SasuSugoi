/**
 * Generates the poŻeramy basemap styles from OpenFreeMap's Bright.
 *
 * Why a generated file rather than the upstream URL: the upstream style is good
 * cartography but wrong for us in one specific way. Its road network is painted
 * in saturated yellow-orange (#fea, #fc8) - the same warm, saturated register as
 * our tomato pins - so the map competes with the only thing on it that matters.
 * Positron solved that by draining every colour, which left the map reading as
 * blank paper next to our cream chrome.
 *
 * So: keep the structural colour (water, greens, warm land), drain the warm
 * saturation out of the roads, and let tomato be the single loud warm thing on
 * screen. Every value below is derived from the brand tokens in styles.css -
 * same hues, different lightness and chroma - so the map belongs to the brand
 * rather than sitting under it.
 *
 * Run: node scripts/build-map-style.mjs
 * Tiles, glyphs and sprites still come from OpenFreeMap; only the paint is ours.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const UPSTREAM = "https://tiles.openfreemap.org/styles/bright";
const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "public", "map");

/** Upstream colour -> ours. Applied recursively, so it reaches inside
 *  `interpolate` expressions where a colour varies by zoom. */
const LIGHT = {
  // land, buildings
  "#f8f4f0": "#f5ebe2", // background + pier: a shade deeper than --cream, so the
  //                        map separates from the page instead of merging into it
  "#f2eae2": "#eee0d7",
  "#dfdbd7": "#e7d5c9",

  // water, in the navy hue family rather than a generic blue
  "#AECFE2": "#adcbea",
  "#a0c8f0": "#93bce6",
  "hsl(210,67%,85%)": "#c4d8f0",
  "#74aee9": "#5c86c4",
  "#495e91": "#273871",
  "rgba(108, 159, 182, 1)": "#8fa9c9",

  // greens
  "#d8e8c8": "#cbe5cb",
  "#6a4": "#3f7d4f",
  "#e0e4dd": "#dfe3d8",

  // roads - the whole point of the exercise
  "#fea": "#fdf3e9", // trunk / primary / secondary / tertiary
  "#fc8": "#f9d6bf", // motorway
  "#fff": "#fffbf8", // minor roads
  "#e9ac77": "#e8a587", // major casing
  "#cfcdca": "#e1ccbf", // minor casing
  "hsl(28,76%,67%)": "#e8a587",
  "#fff4c6": "#f7ead8",
  "#ffdaa6": "#f2d3b8",
  "rgba(244, 209, 158, 1)": "#f2d3b8",
  "rgba(200, 147, 102, 1)": "#d9a184",
  "#cba": "#cbb6a4", // paths
  "rgba(245, 238, 188, 1)": "#f0e3c8", // sand

  // rail, boundaries
  "#bbb": "#b9bec8",
  "hsl(0,0%,70%)": "hsl(230,12%,66%)",
  "hsl(248,7%,66%)": "hsl(240,25%,58%)",

  // special landuse
  "#fde": "#f7dbdb",
  "#f0e8f8": "#e8e6f5",

  // labels: navy text on a cream halo
  "#000": "#273871",
  "#333": "#3d4a7a",
  "#666": "#5c6886",
  "#ffffff": "#fdf5ef",
};

/** The dark twin. Same structure, `fiord`-adjacent but pulled onto our navy. */
const DARK = {
  "#f8f4f0": "#141c3a",
  "#f2eae2": "#1e274a",
  "#dfdbd7": "#28325a",

  "#AECFE2": "#0f1730",
  "#a0c8f0": "#1b2c52",
  "hsl(210,67%,85%)": "#16204a",
  "#74aee9": "#6f8fd0",
  "#495e91": "#8ea4dc",
  "rgba(108, 159, 182, 1)": "#3f5580",

  "#d8e8c8": "#1c2f2a",
  "#6a4": "#2f5c3f",
  "#e0e4dd": "#212a45",

  "#fea": "#2c3866",
  "#fc8": "#3a4878",
  "#fff": "#26305a",
  "#e9ac77": "#3f4d80",
  "#cfcdca": "#222c52",
  "hsl(28,76%,67%)": "#3f4d80",
  "#fff4c6": "#2c3866",
  "#ffdaa6": "#3a4878",
  "rgba(244, 209, 158, 1)": "#3a4878",
  "rgba(200, 147, 102, 1)": "#2c3866",
  "#cba": "#39406a",
  "rgba(245, 238, 188, 1)": "#2a3055",

  "#bbb": "#39406a",
  "hsl(0,0%,70%)": "hsl(230,18%,45%)",
  "hsl(248,7%,66%)": "hsl(240,22%,52%)",

  "#fde": "#33203a",
  "#f0e8f8": "#241f3f",

  "#000": "#e8ecfb",
  "#333": "#c8d0ea",
  "#666": "#9aa6c8",
  "#ffffff": "#141c3a",
};

/** Landuse tints arrive as hsla with an alpha that carries real meaning
 *  (0.4 vs 0.2 vs 0.0), so the alpha is preserved and only the hue moves. */
function retintHsla(value, dark) {
  const m = /^hsla\(([^)]+)\)$/.exec(value);
  if (!m) return null;
  const parts = m[1].split(",").map((p) => p.trim());
  if (parts.length !== 4) return null;
  const alpha = parts[3];
  const known = {
    "30,19%,90%": dark ? "232,22%,20%" : "28,32%,88%", // residential / suburb / railway
    "0,60%,87%": dark ? "348,20%,24%" : "10,38%,88%", // commercial
    "49,100%,88%": dark ? "44,22%,22%" : "44,45%,88%", // industrial
    "0,0%,73%": dark ? "232,14%,38%" : "26,14%,74%", // railway transit
    "0,0%,89%": dark ? "232,14%,26%" : "28,18%,88%", // highway area
    "0,0%,0%": dark ? "0,0%,0%" : "26,20%,30%", // wood outline
  };
  const key = parts.slice(0, 3).join(",");
  const next = known[key];
  return next ? `hsla(${next},${alpha})` : null;
}

function recolour(node, table, dark) {
  if (typeof node === "string") {
    if (table[node]) return table[node];
    const tinted = retintHsla(node, dark);
    return tinted ?? node;
  }
  if (Array.isArray(node)) return node.map((n) => recolour(n, table, dark));
  if (node && typeof node === "object") {
    const out = {};
    for (const [k, v] of Object.entries(node)) out[k] = recolour(v, table, dark);
    return out;
  }
  return node;
}

function build(style, table, { dark, name }) {
  const out = JSON.parse(JSON.stringify(style));
  out.name = name;
  out.metadata = { ...(out.metadata ?? {}), "pozeramy:generated-from": UPSTREAM };

  for (const layer of out.layers) {
    if (layer.paint) layer.paint = recolour(layer.paint, table, dark);
    if (layer.layout) layer.layout = recolour(layer.layout, table, dark);
  }

  // The shaded-relief raster only shows below zoom 6 - country scale, never ours -
  // and it drags a brown wash across the land tint. One less request, one less
  // colour we do not control.
  out.layers = out.layers.filter((l) => l.source !== "ne2_shaded");
  delete out.sources.ne2_shaded;

  // Every text label gets a halo in the land colour, so labels stay legible over
  // parks and water without a white rectangle effect.
  const halo = dark ? "#141c3a" : "#f5ebe2";
  for (const layer of out.layers) {
    if (layer.type === "symbol" && layer.paint && "text-color" in layer.paint) {
      layer.paint["text-halo-color"] = halo;
    }
  }

  return out;
}

const upstream = await fetch(UPSTREAM).then((r) => {
  if (!r.ok) throw new Error(`${UPSTREAM} -> ${r.status}`);
  return r.json();
});

mkdirSync(OUT_DIR, { recursive: true });
const targets = [
  ["pozeramy-light.json", LIGHT, { dark: false, name: "poŻeramy" }],
  ["pozeramy-dark.json", DARK, { dark: true, name: "poŻeramy (ciemny)" }],
];
for (const [file, table, opts] of targets) {
  const style = build(upstream, table, opts);
  writeFileSync(resolve(OUT_DIR, file), JSON.stringify(style, null, 1) + "\n");
  console.log(`${file}: ${style.layers.length} layers`);
}
