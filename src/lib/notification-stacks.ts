/**
 * Zwija serie powiadomień tego samego typu (np. 5 odznak pod rząd) w jedną pozycję.
 * Zwijamy tylko typy "seryjne" i dopiero od MIN_SERII sztuk, żeby pojedyncze wpisy zostały jak są.
 */
export const MIN_SERII = 3;
const SERYJNE = new Set(["achievement"]);

export type Wpis<T> = { kind: "jeden"; n: T } | { kind: "seria"; type: string; items: T[] };

export function zwinSerie<T extends { type: string }>(rows: T[]): Wpis<T>[] {
  const out: Wpis<T>[] = [];
  let i = 0;
  while (i < rows.length) {
    const t = rows[i].type;
    let j = i + 1;
    while (j < rows.length && rows[j].type === t) j++;
    const len = j - i;
    if (SERYJNE.has(t) && len >= MIN_SERII) {
      out.push({ kind: "seria", type: t, items: rows.slice(i, j) });
    } else {
      for (let k = i; k < j; k++) out.push({ kind: "jeden", n: rows[k] });
    }
    i = j;
  }
  return out;
}

export function podpisSerii(type: string, ile: number): string {
  if (type === "achievement") return `${ile} nowych odznak`;
  return `${ile} powiadomień`;
}
