// Display metadata for cuisines. Actual place data lives in the database (table: places).
export const CUISINES = [
  "Włoska",
  "Amerykańska",
  "Kebaby",
  "Azjatycka",
  "Śniadania",
  "Słodkości",
  "Polska",
  "Meksykańska",
  "Wegańska",
  "Burgery",
  "Ramen",
  "Sushi",
  "Mix",
] as const;

import americanCover from "@/assets/brand/po_zeramy-american-quisine.png.asset.json";
import asiaCover from "@/assets/brand/po_zeramy-asia-express.png.asset.json";
import breakfastCover from "@/assets/brand/po_zeramy-english-brakfast.png.asset.json";
import italianoCover from "@/assets/brand/po_zeramy-italiano.png.asset.json";
import mixCover from "@/assets/brand/po_zeramy-mix-smakow.png.asset.json";
import kebabCover from "@/assets/brand/po_zeramy-mrga-rollo.png.asset.json";
import sweetCover from "@/assets/brand/po_zeramy-sweet-baby.png.asset.json";

export interface CuisineMeta {
  color: string;
  cover: string;
  emoji: string;
}

const META: Record<string, CuisineMeta> = {
  "Włoska":      { color: "#3b4cc7", cover: italianoCover.url,  emoji: "🍕" },
  "Amerykańska": { color: "#5b6cf0", cover: americanCover.url,  emoji: "🌭" },
  "Kebaby":      { color: "#e26a3a", cover: kebabCover.url,     emoji: "🌯" },
  "Azjatycka":   { color: "#d4582a", cover: asiaCover.url,      emoji: "🍜" },
  "Śniadania":   { color: "#f0b840", cover: breakfastCover.url, emoji: "🍳" },
  "Słodkości":   { color: "#e89aab", cover: sweetCover.url,     emoji: "🍦" },
  "Polska":      { color: "#c4416a", cover: mixCover.url,       emoji: "🥟" },
  "Meksykańska": { color: "#3aa56b", cover: mixCover.url,       emoji: "🌮" },
  "Wegańska":    { color: "#3aa56b", cover: mixCover.url,       emoji: "🥗" },
  "Burgery":     { color: "#e35d2e", cover: americanCover.url,  emoji: "🍔" },
  "Ramen":       { color: "#8e5cd9", cover: asiaCover.url,      emoji: "🍲" },
  "Sushi":       { color: "#e35d2e", cover: asiaCover.url,      emoji: "🍣" },
  "Mix":         { color: "#3b4cc7", cover: mixCover.url,       emoji: "✨" },
};

const FALLBACK: CuisineMeta = { color: "#221e50", cover: mixCover.url, emoji: "🍽️" };

export function cuisineMeta(cuisine: string): CuisineMeta {
  return META[cuisine] ?? FALLBACK;
}

export const CUISINE_META = new Proxy({} as Record<string, CuisineMeta>, {
  get: (_t, k: string) => cuisineMeta(k),
});
