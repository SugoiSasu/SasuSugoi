// Display metadata for cuisines. Actual place data lives in the database (table: places).
export const CUISINES = [
  "Włoska",
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
import kebabCover from "@/assets/brand/po_zeramy-kebab-pattern.jpg.asset.json";
import sweetCover from "@/assets/brand/po_zeramy-sweet-baby.png.asset.json";
import confettiPattern from "@/assets/brand/po_zeramy-confetti-pattern.svg.asset.json";
// The "Kategorie" chip renders these at 56x56 CSS px. The *-pattern.jpg files
// above are 2000x1116 full-bleed hero images (~200-260KB each) meant for a
// larger surface - these are 128px center-crop WebPs of the same art,
// generated specifically for chip scale (~4KB each).
import italianoChip from "@/assets/brand/po_zeramy-italiano-chip.webp.asset.json";
import kebabChip from "@/assets/brand/po_zeramy-kebab-chip.webp.asset.json";
import asiaChip from "@/assets/brand/po_zeramy-asia-chip.webp.asset.json";
import sweetChip from "@/assets/brand/po_zeramy-sweet-chip.webp.asset.json";
import polskaChip from "@/assets/brand/po_zeramy-polska-chip.webp.asset.json";
import burgerChip from "@/assets/brand/po_zeramy-burger-chip.webp.asset.json";

export interface CuisineMeta {
  color: string;
  cover: string;
  emoji: string;
  /** Background pattern for the "Kategorie" chip. Falls back to a flat
   * `color` chip when unset. */
  chipBackground?: string;
}

const META: Record<string, CuisineMeta> = {
  Włoska: {
    color: "#3b4cc7",
    cover: italianoCover.url,
    emoji: "🍕",
    chipBackground: italianoChip.url,
  },
  Kebaby: { color: "#e26a3a", cover: kebabCover.url, emoji: "🌯", chipBackground: kebabChip.url },
  Azjatycka: {
    color: "#d4582a",
    cover: asiaCover.url,
    emoji: "🍜",
    chipBackground: asiaChip.url,
  },
  Śniadania: {
    color: "#f0b840",
    cover: breakfastCover.url,
    emoji: "🍳",
    chipBackground: confettiPattern.url,
  },
  Słodkości: {
    color: "#e89aab",
    cover: sweetCover.url,
    emoji: "🍦",
    chipBackground: sweetChip.url,
  },
  Polska: {
    color: "#c4416a",
    cover: mixCover.url,
    emoji: "🥟",
    chipBackground: polskaChip.url,
  },
  Meksykańska: {
    color: "#3aa56b",
    cover: mixCover.url,
    emoji: "🌮",
    chipBackground: confettiPattern.url,
  },
  Wegańska: {
    color: "#3aa56b",
    cover: mixCover.url,
    emoji: "🥗",
    chipBackground: confettiPattern.url,
  },
  Burgery: {
    color: "#e35d2e",
    cover: americanCover.url,
    emoji: "🍔",
    chipBackground: burgerChip.url,
  },
  Ramen: {
    color: "#8e5cd9",
    cover: asiaCover.url,
    emoji: "🍲",
    chipBackground: confettiPattern.url,
  },
  Sushi: {
    color: "#e35d2e",
    cover: asiaCover.url,
    emoji: "🍣",
    chipBackground: confettiPattern.url,
  },
  Mix: {
    color: "#3b4cc7",
    cover: mixCover.url,
    emoji: "✨",
    chipBackground: confettiPattern.url,
  },
};

const FALLBACK: CuisineMeta = { color: "#221e50", cover: mixCover.url, emoji: "🍽️" };

export function cuisineMeta(cuisine: string): CuisineMeta {
  return META[cuisine] ?? FALLBACK;
}

export const CUISINE_META = new Proxy({} as Record<string, CuisineMeta>, {
  get: (_t, k: string) => cuisineMeta(k),
});
