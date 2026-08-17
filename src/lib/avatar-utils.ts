// Deterministic colored initials for avatars without an uploaded picture.

const COLORS = [
  "#e35d2e", "#f0a500", "#3b4cc7", "#5b6cf0", "#d4582a",
  "#e89aab", "#f0b840", "#3aa56b", "#c4416a", "#8e5cd9",
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
