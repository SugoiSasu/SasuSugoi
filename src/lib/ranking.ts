/**
 * Logika rankingu v2 - bez Reacta i bez bazy, zeby dalo sie ja testowac.
 * Dane przychodza z RPC ranking_tablica (juz przefiltrowane pod widocznosc).
 */

export type Okres = "week" | "month" | "all";
export type Metryka = "pts" | "reviews" | "badges";
export type Zakres = "all" | "friends";

export const OKRESY: { id: Okres; etykieta: string }[] = [
  { id: "week", etykieta: "Tydzień" },
  { id: "month", etykieta: "Miesiąc" },
  { id: "all", etykieta: "Od początku" },
];

export const METRYKI: { id: Metryka; etykieta: string; jednostka: string }[] = [
  { id: "pts", etykieta: "Punkty", jednostka: "pkt" },
  { id: "reviews", etykieta: "Recenzje", jednostka: "rec." },
  { id: "badges", etykieta: "Odznaki", jednostka: "odzn." },
];

export interface WierszRankingu {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  avatar_source: string | null;
  gender: string | null;
  is_vip: boolean;
  vip_until: string | null;
  vip_nick_color: string | null;
  active_title: string | null;
  points_total: number;
  wartosc: number;
  wartosc_tydzien_temu: number | null;
  is_friend: boolean;
  is_me: boolean;
  created_at: string;
}

export interface Gracz extends WierszRankingu {
  miejsce: number;
  /** Zmiana miejsc w 7 dni: >0 w gore; null = nowy (konto z ostatnich 7 dni); undefined = nie liczymy (tydzien/miesiac). */
  zmiana?: number | null;
  /** Szerokosc paska wzgledem lidera, 3-100. */
  procent: number;
}

const TYDZIEN_MS = 7 * 24 * 3600 * 1000;

/** Miejsca "sportowo": remis = to samo miejsce, nastepne przeskakuje (1, 2, 2, 4). */
function nadajMiejsca<T>(lista: T[], wartosc: (x: T) => number): number[] {
  const m: number[] = [];
  lista.forEach((x, i) => {
    m.push(i > 0 && wartosc(x) === wartosc(lista[i - 1]) ? m[i - 1] : i + 1);
  });
  return m;
}

export function policzRanking(wiersze: WierszRankingu[], zakres: Zakres, teraz = Date.now()): Gracz[] {
  const lista = wiersze
    .filter((w) => zakres === "all" || w.is_friend || w.is_me)
    // SQL juz sortuje, ale po filtrze zakresu kolejnosc musi byc pewna.
    .slice()
    .sort((a, b) => b.wartosc - a.wartosc || a.created_at.localeCompare(b.created_at));
  const miejsca = nadajMiejsca(lista, (x) => x.wartosc);

  const liczZmiany = lista.some((w) => w.wartosc_tydzien_temu != null);
  const przedtem = new Map<string, number>();
  if (liczZmiany) {
    const stare = lista
      .slice()
      .sort(
        (a, b) =>
          (b.wartosc_tydzien_temu ?? 0) - (a.wartosc_tydzien_temu ?? 0) ||
          a.created_at.localeCompare(b.created_at),
      );
    const stareMiejsca = nadajMiejsca(stare, (x) => x.wartosc_tydzien_temu ?? 0);
    stare.forEach((w, i) => przedtem.set(w.user_id, stareMiejsca[i]));
  }

  const lider = Math.max(1, lista[0]?.wartosc ?? 1);
  return lista.map((w, i) => {
    let zmiana: number | null | undefined;
    if (liczZmiany) {
      const nowy = teraz - new Date(w.created_at).getTime() < TYDZIEN_MS;
      zmiana = nowy ? null : (przedtem.get(w.user_id) ?? miejsca[i]) - miejsca[i];
    }
    return { ...w, miejsce: miejsca[i], zmiana, procent: Math.max(3, Math.round((w.wartosc / lider) * 100)) };
  });
}

export interface Sasiedzi {
  ja: Gracz | null;
  przede: Gracz | null;
  za: Gracz | null;
}

export function sasiedzi(lista: Gracz[]): Sasiedzi {
  const ja = lista.find((g) => g.is_me) ?? null;
  if (!ja) return { ja: null, przede: null, za: null };
  const przede = lista.filter((g) => g.wartosc > ja.wartosc).pop() ?? null;
  const za = lista.find((g) => g.wartosc < ja.wartosc) ?? null;
  return { ja, przede, za };
}

export function odmiana(n: number, jeden: string, kilka: string, wiele: string): string {
  if (n === 1) return jeden;
  const d = n % 10;
  const t = n % 100;
  return d >= 2 && d <= 4 && (t < 12 || t > 14) ? kilka : wiele;
}

export function krotkaNazwa(g: { display_name: string | null; username: string | null }): string {
  return g.display_name?.trim().split(/\s+/)[0] || (g.username ? `@${g.username}` : "Użytkownik");
}

/**
 * Jedno zdanie "co zrobic, zeby awansowac". Punkty liczone z prawdziwych
 * regul (points_rules), nie z liczb z makiety - recenzja NOWEGO lokalu daje
 * recenzje + bonus za pierwsza wizyte.
 */
export function wskazowka(
  s: Sasiedzi,
  metryka: Metryka,
  reguly: { recenzja: number; nowyLokal: number },
): string {
  const { ja, przede, za } = s;
  if (!ja) return "";
  if (!przede) {
    if (!za) return "Jesteś na czele. Pilnuj korony.";
    const przewaga = ja.wartosc - za.wartosc;
    const j = METRYKI.find((m) => m.id === metryka)!.jednostka;
    return `${krotkaNazwa(za)} traci do Ciebie ${przewaga} ${j} Pilnuj korony.`;
  }
  const brak = przede.wartosc - ja.wartosc + 1;
  const kogo = krotkaNazwa(przede);
  if (metryka === "reviews") return `${brak} ${odmiana(brak, "recenzja", "recenzje", "recenzji")} i wyprzedzasz ${kogo}`;
  if (metryka === "badges") return `${brak} ${odmiana(brak, "odznaka", "odznaki", "odznak")} i wyprzedzasz ${kogo}`;
  const zaRecenzje = reguly.recenzja + reguly.nowyLokal;
  if (brak <= reguly.recenzja) return `Jedna recenzja (+${reguly.recenzja} pkt) i wyprzedzasz ${kogo}`;
  const ile = Math.ceil(brak / zaRecenzje);
  return ile === 1
    ? `Recenzja nowego lokalu (+${zaRecenzje} pkt) i wyprzedzasz ${kogo}`
    : `${ile} recenzje nowych lokali (+${ile * zaRecenzje} pkt) i wyprzedzasz ${kogo}`;
}

/** Poczatek nastepnego okresu w czasie polskim - do "zamyka sie za...". */
export function koniecOkresu(okres: Okres, teraz = new Date()): Date | null {
  if (okres === "all") return null;
  // Czesci daty w strefie Europe/Warsaw, niezaleznie od strefy przegladarki.
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(teraz);
  const cz = Object.fromEntries(f.map((p) => [p.type, p.value]));
  const r = Number(cz.year);
  const m = Number(cz.month);
  const d = Number(cz.day);
  const dni = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(cz.weekday);
  // Polnoc w Warszawie jako UTC: roznica stref w danym momencie.
  const przesuniecie = Date.UTC(r, m - 1, d, Number(cz.hour), Number(cz.minute)) - teraz.getTime();
  const polnocUtc = (rr: number, mm: number, dd: number) => new Date(Date.UTC(rr, mm - 1, dd) - przesuniecie);
  return okres === "week" ? polnocUtc(r, m, d + (7 - dni)) : polnocUtc(r, m + 1, 1);
}

export function ileZostalo(do_: Date, teraz = new Date()): string {
  const min = Math.max(0, Math.round((do_.getTime() - teraz.getTime()) / 60000));
  const dni = Math.floor(min / 1440);
  const godz = Math.floor((min % 1440) / 60);
  if (dni > 0) return `${dni} ${odmiana(dni, "dzień", "dni", "dni")} ${godz} h`;
  if (godz > 0) return `${godz} h ${min % 60} min`;
  return `${min} min`;
}

const MIESIACE = ["styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec", "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień"];

export function naglowekOkresu(okres: Okres, teraz = new Date()): string {
  if (okres === "all") return "Od początku";
  const cz = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw", year: "numeric", month: "numeric" })
      .formatToParts(teraz)
      .map((p) => [p.type, p.value]),
  );
  const miesiac = `${MIESIACE[Number(cz.month) - 1]} ${cz.year}`;
  return okres === "month" ? `Sezon ${miesiac}` : "Ten tydzień";
}
