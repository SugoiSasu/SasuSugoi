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
