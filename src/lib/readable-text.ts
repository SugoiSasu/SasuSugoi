/**
 * Pick the brand text colour that is actually readable on a given fill.
 *
 * The cuisine palette spans a very wide lightness range - Śniadania is a
 * bright yellow (#f0b840), Włoska a deep blue (#3b4cc7) - so a single fixed
 * text colour cannot serve both. Cream on the yellow measures 1.67:1;
 * navy on the blue measures 2.03:1. Both are unreadable, and which one
 * fails flips depending on the cuisine.
 *
 * Choosing per fill instead of per component also means a colour picked in
 * the admin panel tomorrow gets a readable label automatically, with no
 * code change.
 */

const CREAM: RGB = [253, 245, 239];
const NAVY: RGB = [35, 37, 94];

type RGB = [number, number, number];

function hexToRgb(hex: string): RGB | null {
  let h = hex.trim().replace("#", "");
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function relativeLuminance([r, g, b]: RGB): number {
  const a = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}

export function contrastRatio(a: RGB, b: RGB): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Tailwind class for label text on `fill`, whichever of cream/navy reads
 * better. Falls back to cream for anything unparseable (non-hex, empty),
 * which is what these labels used unconditionally before.
 */
export function readableTextClass(fill: string | null | undefined): string {
  if (!fill) return "text-cream";
  const rgb = hexToRgb(fill);
  if (!rgb) return "text-cream";
  return contrastRatio(CREAM, rgb) >= contrastRatio(NAVY, rgb) ? "text-cream" : "text-navy";
}

/**
 * Fill for a text label: `fill` itself when cream or navy already reach 4.5:1
 * on it, otherwise the fill darkened toward navy until cream does. Mid-tone
 * oranges (#e35d2e, #d4582a) sit between the two text colours and fail both,
 * so the label colour cannot fix them - the fill has to move.
 */
export function readableFill(fill: string | null | undefined): string | undefined {
  if (!fill) return undefined;
  const rgb = hexToRgb(fill);
  if (!rgb) return fill;
  const best = (c: RGB) => Math.max(contrastRatio(CREAM, c), contrastRatio(NAVY, c));
  if (best(rgb) >= 4.5) return fill;
  let c: RGB = rgb;
  for (let i = 0; i < 20 && contrastRatio(CREAM, c) < 4.5; i++) {
    c = [
      Math.round(c[0] + (NAVY[0] - c[0]) * 0.08),
      Math.round(c[1] + (NAVY[1] - c[1]) * 0.08),
      Math.round(c[2] + (NAVY[2] - c[2]) * 0.08),
    ];
  }
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}
