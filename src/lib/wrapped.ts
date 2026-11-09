/**
 * Podsumowanie roku ("Wrapped"): liczby z konta za dany rok, tekst do udostępnienia i obraz 1080x1920 do zapisania
 * (rysowany na canvasie, bez dodatkowych bibliotek). Dane przychodzą z istniejących hooków - tu tylko składanie.
 */

export interface DaneWrapped {
  rok: number;
  imie: string;
  odwiedzone: number;
  ulubione: number;
  opinie: number;
  znajomi: number;
  odznaki: number;
  punkty: number;
  poziom: number;
  topKuchnie: { cuisine: string; share: number }[];
  topDzielnica: string | null;
  pierwszyLokal: string | null;
}

export interface WizytaZData {
  added_at: string;
  name: string;
}

/** Tylko wpisy z danego roku (po dacie dodania). */
/** Rok liczymy w strefie użytkownika (31 grudnia 23:00 UTC to dla Polaka już nowy rok). */
export function wRoku<T extends { added_at?: string }>(lista: T[] | undefined, rok: number): T[] {
  return (lista ?? []).filter((x) => !!x.added_at && new Date(x.added_at).getFullYear() === rok);
}

/** Najstarsza wizyta w roku = "pierwszy lokal roku". */
export function pierwszaWizyta(wizyty: WizytaZData[]): string | null {
  if (wizyty.length === 0) return null;
  return [...wizyty].sort((a, b) => a.added_at.localeCompare(b.added_at))[0].name;
}

/** Czy jest cokolwiek do pokazania - pusty rok nie powinien udawać podsumowania. */
export function maCoPokazac(d: DaneWrapped): boolean {
  return d.odwiedzone + d.ulubione + d.opinie > 0;
}

export function tekstUdostepnienia(d: DaneWrapped): string {
  const czesci = [`Mój ${d.rok} w poŻeramy 🍽️`, `${d.odwiedzone} odwiedzonych lokali`];
  if (d.topKuchnie[0]) czesci.push(`najczęściej: ${d.topKuchnie[0].cuisine}`);
  czesci.push(`poziom ${d.poziom}`);
  return czesci.join(" · ") + "\nhttps://pozeramy.live";
}

const NAVY = "#221e50";
const CREAM = "#fff8ef";
const TOMATO = "#e8532f";

function zawin(ctx: CanvasRenderingContext2D, tekst: string, maxSzer: number): string[] {
  const slowa = tekst.split(/\s+/);
  const wiersze: string[] = [];
  let biezacy = "";
  for (const s of slowa) {
    const proba = biezacy ? `${biezacy} ${s}` : s;
    if (ctx.measureText(proba).width > maxSzer && biezacy) {
      wiersze.push(biezacy);
      biezacy = s;
    } else biezacy = proba;
  }
  if (biezacy) wiersze.push(biezacy);
  return wiersze;
}

/** Rysuje obraz 1080x1920 (format relacji). Wywoływać tylko w przeglądarce. */
export function narysujObraz(canvas: HTMLCanvasElement, d: DaneWrapped): void {
  const W = 1080;
  const H = 1920;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const tlo = ctx.createLinearGradient(0, 0, W, H);
  tlo.addColorStop(0, NAVY);
  tlo.addColorStop(1, "#37448f");
  ctx.fillStyle = tlo;
  ctx.fillRect(0, 0, W, H);
  // Konfetti w tle (stałe pozycje, żeby obraz był powtarzalny).
  const kolory = ["#f4a7a0", "#fff8ef", TOMATO, "#f0b840"];
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = kolory[i % kolory.length] + "55";
    const x = (i * 197) % W;
    const y = (i * 331) % H;
    ctx.beginPath();
    ctx.arc(x, y, 6 + (i % 5) * 4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.textAlign = "left";
  ctx.fillStyle = CREAM;
  ctx.font = '700 44px "Manrope", system-ui, sans-serif';
  ctx.fillText("poŻeramy", 90, 150);

  ctx.font = '800 150px "Bricolage Grotesque", system-ui, sans-serif';
  ctx.fillText(`Twój ${d.rok}`, 90, 360);
  ctx.font = '600 52px "Manrope", system-ui, sans-serif';
  ctx.fillStyle = "#fff8efcc";
  ctx.fillText(d.imie, 90, 440);

  // Liczba główna.
  ctx.fillStyle = TOMATO;
  ctx.font = '800 360px "Bricolage Grotesque", system-ui, sans-serif';
  ctx.fillText(String(d.odwiedzone), 80, 800);
  ctx.fillStyle = CREAM;
  ctx.font = '700 64px "Manrope", system-ui, sans-serif';
  ctx.fillText("odwiedzonych lokali", 90, 890);

  // Kuchnie.
  let y = 1040;
  if (d.topKuchnie.length > 0) {
    ctx.fillStyle = "#fff8efaa";
    ctx.font = '700 40px "Manrope", system-ui, sans-serif';
    ctx.fillText("TWOJE KUCHNIE", 90, y);
    y += 70;
    for (const k of d.topKuchnie.slice(0, 3)) {
      ctx.fillStyle = CREAM;
      ctx.font = '700 56px "Manrope", system-ui, sans-serif';
      ctx.fillText(k.cuisine, 90, y);
      ctx.fillStyle = "#ffffff22";
      ctx.fillRect(90, y + 24, 900, 18);
      ctx.fillStyle = TOMATO;
      ctx.fillRect(90, y + 24, Math.max(24, (900 * k.share) / 100), 18);
      y += 130;
    }
  }

  // Drobne liczby.
  const drobne: [string, number][] = [
    ["opinii", d.opinie],
    ["ulubionych", d.ulubione],
    ["znajomych", d.znajomi],
    ["odznak", d.odznaki],
  ];
  const szer = 225;
  drobne.forEach(([nazwa, wartosc], i) => {
    const x = 90 + i * szer;
    ctx.fillStyle = CREAM;
    ctx.font = '800 80px "Bricolage Grotesque", system-ui, sans-serif';
    ctx.fillText(String(wartosc), x, 1640);
    ctx.fillStyle = "#fff8efaa";
    ctx.font = '600 34px "Manrope", system-ui, sans-serif';
    ctx.fillText(nazwa, x, 1690);
  });

  ctx.fillStyle = CREAM;
  ctx.font = '700 44px "Manrope", system-ui, sans-serif';
  const pod = d.pierwszyLokal
    ? zawin(ctx, `Zaczęło się od: ${d.pierwszyLokal}`, 900)
    : [`Poziom ${d.poziom} · ${d.punkty} pkt`];
  pod.slice(0, 2).forEach((w, i) => ctx.fillText(w, 90, 1790 + i * 54));

  ctx.textAlign = "right";
  ctx.fillStyle = "#fff8efaa";
  ctx.font = '600 34px "Manrope", system-ui, sans-serif';
  ctx.fillText("pozeramy.live", W - 90, H - 60);
}
