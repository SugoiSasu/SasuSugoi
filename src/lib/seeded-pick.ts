/** Deterministic hash → stable pseudo-random pick from a list. Same seed
 * always yields the same item (no flicker on re-render/reload), but
 * different seeds spread picks across the list - used to rotate between
 * multiple active items (ads, random-place suggestions) fairly across users
 * without needing any stored rotation state. */
export function pickSeeded<T>(items: T[], seed: string): T | null {
  if (items.length === 0) return null;
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(h) % items.length;
  return items[idx];
}
