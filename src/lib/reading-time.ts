// Rough Polish reading speed ~200 słów/min. Zwraca liczbę minut (min. 1).
export function readingTimeMinutes(text: string | null | undefined): number {
  if (!text) return 1;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function readingTimeLabel(text: string | null | undefined): string {
  const m = readingTimeMinutes(text);
  return `${m} min czytania`;
}
