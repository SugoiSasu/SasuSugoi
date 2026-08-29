// Deterministic colored initials for avatars without an uploaded picture.
//
// Kazdy kolor musi osiagac >= 4.5:1 z kremem LUB granatem (readableTextClass
// wybiera lepszy z dwoch) - inicjaly sa male i pogrubione, wiec nie licza sie
// jako duzy tekst. Piec kolorow bylo ponizej progu przy obu tuszach i zostalo
// przyciemnionych albo rozjasnionych 2026-08-30. Zmieniajac ten zestaw, przemierz kontrast.

const COLORS = [
  "#b64a25", "#f0a500", "#3b4cc7", "#5160d6", "#de805d",
  "#e89aab", "#f0b840", "#46aa74", "#c4416a", "#8154c5",
];

export function initialsFromName(displayName?: string | null, username?: string | null): string {
  const src = (displayName || username || "?").trim();
  if (!src) return "?";
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

export function colorFromKey(key?: string | null): string {
  const k = (key || "user").toLowerCase();
  let h = 0;
  for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}
