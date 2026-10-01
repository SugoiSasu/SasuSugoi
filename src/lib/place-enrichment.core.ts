/**
 * Szukanie danych lokalu w internecie: AI (Claude z wyszukiwarka i czytaniem
 * stron) + deterministyczne wyciaganie logo z oficjalnej strony.
 *
 * Wynik to PROPOZYCJA - nic tu nie zapisuje do lokalu. Kazde pole ma zrodlo,
 * zeby admin mogl sprawdzic, skad sie wzielo, zanim je przyjmie. Wyszukiwarka
 * potrafi trafic na lokal o tej samej nazwie w innym miescie albo na stare
 * godziny z katalogu, stad zatwierdzanie zamiast wpisywania od razu.
 *
 * Plik bez importow - uzywany przez funkcje serwerowa, da sie go tez odpalic
 * z Node do testow.
 */

export type DzienKlucz = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type Godziny = Partial<Record<DzienKlucz, { open: string; close: string }>>;
export type KategoriaMenu = { category: string; items: { name: string; price?: string; description?: string }[] };

export interface Pole<T> {
  wartosc: T;
  zrodlo: string | null;
}

export interface KandydatObrazu {
  url: string;
  zrodlo: string;
  /** Skad wiemy: "strona" = znacznik na oficjalnej stronie, "ai" = wskazal model. */
  skad: "strona" | "ai";
}

export interface PropozycjaLokalu {
  znaleziono: boolean;
  pewnosc: "wysoka" | "srednia" | "niska";
  uwagi: string;
  adres?: Pole<string>;
  dzielnica?: Pole<string>;
  telefon?: Pole<string>;
  strona_www?: Pole<string>;
  opis?: Pole<string>;
  kuchnia?: Pole<string>;
  poziom_cen?: Pole<number>;
  na_wynos?: Pole<boolean>;
  bez_barier?: Pole<boolean>;
  godziny?: Pole<Godziny>;
  menu_url?: Pole<string>;
  menu?: Pole<KategoriaMenu[]>;
  logo: KandydatObrazu[];
  okladka: KandydatObrazu[];
  /** Diagnostyka: czas i zuzycie, do oceny kosztu. */
  koszt: { ms: number; wyszukiwania: number; tokeny_we: number; tokeny_wy: number; usd: number; model: string | null };
}

/** Pola, o ktore pytamy AI. Obrazy (logo/okladka) ida osobno, bez AI. */
export const POLA_AI = [
  "adres",
  "dzielnica",
  "telefon",
  "strona_www",
  "opis",
  "kuchnia",
  "poziom_cen",
  "na_wynos",
  "bez_barier",
  "godziny",
  "menu_url",
  "menu",
] as const;
export type PoleAI = (typeof POLA_AI)[number];

export interface WejscieLokalu {
  nazwa: string;
  adres?: string | null;
  strona?: string | null;
  kuchnie: string[];
  dzielnice: string[];
  /**
   * Pola do znalezienia. Wypelnione juz w bazie nie sa szukane - AI nie
   * czyta stron po cos, co mamy, a schemat wyniku jest krotszy. Pusta lista =
   * AI w ogole nie jest wolane (np. brakuje tylko logo).
   */
  szukaj?: PoleAI[];
  /** Tylko do testow porownawczych modeli. */
  model?: string;
}

/** Ceny USD za 1M tokenow (wejscie, wyjscie) - do pokazania realnego kosztu. */
const CENNIK: Record<string, [number, number]> = {
  "claude-sonnet-5": [3, 15],
  "claude-haiku-4-5-20251001": [1, 5],
};
/**
 * Haiku domyslnie: 7x taniej (ok. 0,06-0,10 USD na lokal), dobrze przepisuje
 * menu i dane z oficjalnych stron. Slabszy przy sprzecznych zrodlach (DRAM:
 * wykryl sprzecznosc, ale wpisal zle godziny) - od tego jest "dokladniej"
 * na Sonnecie, uzywane tylko tam, gdzie wynik jest niepewny.
 */
export const MODEL_DOMYSLNY = "claude-haiku-4-5-20251001";
export const MODEL_DOKLADNY = "claude-sonnet-5";

const pole = (typ: Record<string, unknown>, opis: string) => ({
  type: "object",
  description: opis,
  properties: {
    wartosc: typ,
    zrodlo: { type: "string", description: "Dokladny URL strony, na ktorej to przeczytales." },
  },
  required: ["wartosc", "zrodlo"],
});

const godzinaDnia = {
  anyOf: [
    {
      type: "object",
      properties: {
        open: { type: "string", description: "HH:MM" },
        close: { type: "string", description: "HH:MM; po polnocy np. 02:00" },
      },
      required: ["open", "close"],
    },
    { type: "null" },
  ],
};

function narzedzieWyniku(w: WejscieLokalu, szukane: PoleAI[]) {
  const wszystkie = narzedzieWszystkichPol(w);
  const props = wszystkie.input_schema.properties as Record<string, unknown>;
  const zostaw = new Set<string>(["znaleziono", "pewnosc", "uwagi", ...szukane]);
  // Logo z AI tylko wtedy, gdy nie znamy strony - inaczej bierzemy je ze strony bez AI.
  if (!w.strona) zostaw.add("logo_urls");
  for (const k of Object.keys(props)) if (!zostaw.has(k)) delete props[k];
  return wszystkie;
}

function narzedzieWszystkichPol(w: WejscieLokalu) {
  return {
    name: "zapisz_dane_lokalu",
    description: "Zapisz wszystko, co udalo sie ustalic o lokalu. Wywolaj dokladnie raz, na koncu.",
    input_schema: {
      type: "object",
      properties: {
        znaleziono: { type: "boolean", description: "Czy znalazles TEN lokal (ta nazwa, Poznan)." },
        pewnosc: {
          type: "string",
          enum: ["wysoka", "srednia", "niska"],
          description: "Pewnosc, ze znalezione zrodla dotycza tego lokalu, a nie innego o podobnej nazwie.",
        },
        uwagi: {
          type: "string",
          description: "Telegraficznie, max 20 slow: tylko sprzecznosci/ryzyka (np. 'godziny rozne na 2 stronach'). Pusty, jesli brak.",
        },
        adres: pole({ type: "string" }, "Pelny adres: 'ul. X 12, 60-000 Poznan'."),
        dzielnica: pole({ type: "string", enum: w.dzielnice }, "Dzielnica Poznania z listy."),
        telefon: pole({ type: "string" }, "Format '+48 600 000 000'."),
        strona_www: pole({ type: "string" }, "Oficjalna strona lokalu (nie katalog, nie Facebook)."),
        opis: pole(
          { type: "string" },
          "Max 160 znakow, po polsku, wlasnymi slowami: co serwuja i czym sie wyrozniaja. Bez superlatywow, bez kopiowania.",
        ),
        kuchnia: pole({ type: "string", enum: w.kuchnie }, "Najlepiej pasujaca kategoria z listy."),
        poziom_cen: pole(
          { type: "integer", minimum: 1, maximum: 4 },
          "Cena typowego dania glownego: 1 ponizej 25 zl, 2 25-40 zl, 3 40-60 zl, 4 powyzej 60 zl.",
        ),
        na_wynos: pole({ type: "boolean" }, "Tylko jesli zrodlo wprost mowi o wynosie/dowozie."),
        bez_barier: pole({ type: "boolean" }, "Tylko jesli zrodlo wprost mowi o dostepnosci dla wozkow."),
        godziny: pole(
          {
            type: "object",
            properties: {
              mon: godzinaDnia,
              tue: godzinaDnia,
              wed: godzinaDnia,
              thu: godzinaDnia,
              fri: godzinaDnia,
              sat: godzinaDnia,
              sun: godzinaDnia,
            },
          },
          "Godziny otwarcia; null = zamkniete tego dnia. Pomin cale pole, jesli nie masz pewnego zrodla.",
        ),
        menu_url: pole({ type: "string" }, "Link do menu (strona lub PDF) na oficjalnej stronie."),
        menu: pole(
          {
            type: "array",
            items: {
              type: "object",
              properties: {
                category: { type: "string" },
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      price: { type: "string", description: "np. '32 zl'" },
                      description: { type: "string" },
                    },
                    required: ["name"],
                  },
                },
              },
              required: ["category", "items"],
            },
          },
          "Menu przepisane z oficjalnego zrodla (strona lokalu, PDF, platforma zamowien). Nazwy i ceny dokladnie jak w zrodle. Opis tylko, jesli jest w zrodle.",
        ),
        logo_urls: {
          type: "array",
          description: "Bezposrednie URL-e plikow z logo lokalu (png/jpg/webp/svg), jesli je widziales.",
          items: {
            type: "object",
            properties: { url: { type: "string" }, zrodlo: { type: "string" } },
            required: ["url", "zrodlo"],
          },
        },
        okladka_urls: {
          type: "array",
          description: "Bezposrednie URL-e zdjec wnetrza lub dan z oficjalnej strony lokalu.",
          items: {
            type: "object",
            properties: { url: { type: "string" }, zrodlo: { type: "string" } },
            required: ["url", "zrodlo"],
          },
        },
      },
      required: ["znaleziono", "pewnosc", "uwagi"],
    },
  };
}

function polecenie(w: WejscieLokalu, szukane: PoleAI[]): string {
  return [
    `Lokal: "${w.nazwa}", Poznan.`,
    w.adres ? `Adres: ${w.adres}.` : "",
    w.strona ? `Strona: ${w.strona} - zacznij od niej (web_fetch), bez wyszukiwania, jesli wystarczy.` : "",
    `Znajdz TYLKO: ${szukane.join(", ")}. Reszte juz mamy - nie szukaj.`,
    "Zrodla: oficjalna strona > FB/IG > Pyszne/Glovo/Wolt/Uber Eats > katalogi. Upewnij sie, ze to ten lokal w Poznaniu.",
    "Tylko to, co przeczytales w zrodle. Brak pola lepszy niz zgadywanie.",
    szukane.includes("godziny")
      ? "Godziny: sprawdz na 2 zrodlach (np. strona PL + Google/FB). Rozne -> wez nowsze/polska wersje, roznice wpisz w uwagi, pewnosc 'srednia'."
      : "",
    "Nie pisz zadnego tekstu miedzy narzedziami. Konczysz jednym wywolaniem zapisz_dane_lokalu.",
  ]
    .filter(Boolean)
    .join("\n");
}

type Blok = { type: string; name?: string; input?: Record<string, unknown> } & Record<string, unknown>;

async function wywolaj(apiKey: string, body: Record<string, unknown>) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "web-fetch-2025-09-10",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Anthropic API (${res.status}): ${t.slice(0, 300)}`);
  }
  return (await res.json()) as {
    content: Blok[];
    stop_reason: string;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      server_tool_use?: { web_search_requests?: number };
    };
  };
}

export async function szukajDanychAI(w: WejscieLokalu, szukane: PoleAI[], apiKey: string) {
  const start = Date.now();
  const model = w.model ?? MODEL_DOMYSLNY;
  const narzedzie = narzedzieWyniku(w, szukane);
  // Koszt to w ~80% tekst stron i wynikow, ktory model czyta - stad limity
  // liczby wyszukiwan, otwieranych stron i dlugosci kazdej strony.
  const tools = [
    {
      type: "web_search_20250305",
      name: "web_search",
      max_uses: 3,
      user_location: { type: "approximate", city: "Poznań", country: "PL", timezone: "Europe/Warsaw" },
    },
    { type: "web_fetch_20250910", name: "web_fetch", max_uses: 3, max_content_tokens: 6000 },
    narzedzie,
  ];
  const messages: { role: string; content: unknown }[] = [{ role: "user", content: polecenie(w, szukane) }];
  const koszt = { wyszukiwania: 0, tokeny_we: 0, tokeny_wy: 0 };

  for (let tura = 0; tura < 4; tura++) {
    const wymus = tura === 3 || (tura > 0 && messages[messages.length - 1].role === "user" && typeof messages[messages.length - 1].content === "string");
    const odp = await wywolaj(apiKey, {
      model,
      max_tokens: szukane.includes("menu") ? 12000 : 3000,
      tools,
      tool_choice: wymus ? { type: "tool", name: narzedzie.name } : { type: "auto" },
      messages,
    });
    koszt.tokeny_we += odp.usage?.input_tokens ?? 0;
    koszt.tokeny_wy += odp.usage?.output_tokens ?? 0;
    koszt.wyszukiwania += odp.usage?.server_tool_use?.web_search_requests ?? 0;

    const wynik = odp.content.find((b) => b.type === "tool_use" && b.name === narzedzie.name);
    if (wynik?.input) {
      const [cWe, cWy] = CENNIK[model] ?? [3, 15];
      const usd = (koszt.tokeny_we * cWe + koszt.tokeny_wy * cWy) / 1e6 + koszt.wyszukiwania * 0.01;
      return { dane: wynik.input, koszt: { ...koszt, usd, model, ms: Date.now() - start } };
    }

    messages.push({ role: "assistant", content: odp.content });
    // pause_turn = serwerowe narzedzia jeszcze pracuja, kontynuujemy ta sama rozmowe.
    if (odp.stop_reason !== "pause_turn") {
      messages.push({ role: "user", content: "Zapisz teraz wynik narzedziem zapisz_dane_lokalu." });
    }
  }
  throw new Error("AI nie zwrocilo wyniku po 4 turach.");
}

// ── Logo z oficjalnej strony (bez AI) ──────────────────────────────────────

const UA = "Mozilla/5.0 (compatible; pozeramy-bot/1.0; +https://pozeramy.pl)";

/** Tylko publiczne http(s) - bez localhost i adresow IP (funkcja pobiera URL-e wskazane przez AI). */
export function bezpiecznyUrl(u: string): URL | null {
  try {
    const url = new URL(u);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const h = url.hostname.toLowerCase();
    if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return null;
    if (/^[\d.]+$/.test(h) || h.includes(":")) return null;
    return url;
  } catch {
    return null;
  }
}

export async function kandydaciZeStrony(strona: string): Promise<KandydatObrazu[]> {
  const url = bezpiecznyUrl(strona);
  if (!url) return [];
  let html: string;
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10000) });
    if (!r.ok) return [];
    html = (await r.text()).slice(0, 400_000);
  } catch {
    return [];
  }
  return kandydaciZHtml(html, url.toString());
}

/** Czesc bez sieci - osobno, zeby dalo sie ja przetestowac. */
export function kandydaciZHtml(html: string, baza: string): KandydatObrazu[] {
  const wynik: KandydatObrazu[] = [];
  const dodaj = (href: string | undefined) => {
    if (!href) return;
    try {
      const abs = new URL(href.replace(/&amp;/g, "&"), baza).toString();
      if (!wynik.some((k) => k.url === abs)) wynik.push({ url: abs, zrodlo: baza, skad: "strona" });
    } catch {
      /* zly href */
    }
  };
  const attr = (tag: string, nazwa: string) =>
    tag.match(new RegExp(`${nazwa}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1];

  // <img> z "logo" w klasie, id, alt albo nazwie pliku - najczesciej prawdziwe logo.
  for (const tag of html.match(/<img\b[^>]*>/gi) ?? []) {
    if (/logo/i.test(tag)) dodaj(attr(tag, "src") ?? attr(tag, "data-src"));
  }
  // Ikony strony - od najwiekszych.
  const ikony = (html.match(/<link\b[^>]*>/gi) ?? [])
    .filter((t) => /rel\s*=\s*["'][^"']*(apple-touch-icon|icon)[^"']*["']/i.test(t))
    .map((t) => ({ href: attr(t, "href"), rozmiar: Number(attr(t, "sizes")?.split("x")[0]) || 0 }))
    .sort((a, b) => b.rozmiar - a.rozmiar);
  for (const i of ikony) dodaj(i.href);
  // og:image to zwykle zdjecie (okladka), ale bywa logo - admin wybiera.
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    if (/property\s*=\s*["']og:image["']/i.test(tag)) dodaj(attr(tag, "content"));
  }
  return wynik.slice(0, 8);
}

/** Typy, ktore da sie potem wgrac do storage. Bez SVG (skrypty w pliku) i ICO (za male na logo). */
export const TYPY_OBRAZOW: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Sprawdza, ze URL naprawde zwraca obraz - martwe linki od AI odpadaja. */
export async function czyObraz(u: string): Promise<boolean> {
  const url = bezpiecznyUrl(u);
  if (!url) return false;
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) });
    const typ = (r.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    await r.body?.cancel().catch(() => {});
    return r.ok && typ in TYPY_OBRAZOW;
  } catch {
    return false;
  }
}

const GODZINA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Odrzuca zle sformatowane fragmenty zamiast ufac modelowi. */
export function oczyscGodziny(g: unknown): Godziny | undefined {
  if (!g || typeof g !== "object") return undefined;
  const wynik: Godziny = {};
  let jakiekolwiek = false;
  for (const d of ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as DzienKlucz[]) {
    const v = (g as Record<string, unknown>)[d];
    if (v === null) {
      jakiekolwiek = true;
      continue; // zamkniete = brak klucza, tak jak w bazie
    }
    const o = v as { open?: string; close?: string } | undefined;
    if (!o) continue;
    const open = o.open?.replace(/^(\d):/, "0$1:");
    const close = o.close?.replace(/^(\d):/, "0$1:").replace(/^24:00$/, "00:00");
    if (open && close && GODZINA.test(open) && GODZINA.test(close) && open !== close) {
      wynik[d] = { open, close };
      jakiekolwiek = true;
    }
  }
  return jakiekolwiek ? wynik : undefined;
}

function wezPole<T>(dane: Record<string, unknown>, klucz: string, ok: (v: unknown) => v is T): Pole<T> | undefined {
  const p = dane[klucz] as { wartosc?: unknown; zrodlo?: unknown } | undefined;
  if (!p || p.wartosc === undefined || p.wartosc === null || p.wartosc === "") return undefined;
  if (!ok(p.wartosc)) return undefined;
  return { wartosc: p.wartosc, zrodlo: typeof p.zrodlo === "string" ? p.zrodlo : null };
}
const jestTekst = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const jestBool = (v: unknown): v is boolean => typeof v === "boolean";
const jestLiczba = (v: unknown): v is number => typeof v === "number" && v >= 1 && v <= 5;

export async function znajdzDaneLokalu(w: WejscieLokalu, apiKey: string): Promise<PropozycjaLokalu> {
  let szukane = [...(w.szukaj ?? POLA_AI)];
  // Bez strony nie ma skad wziac logo bez AI - wtedy AI musi ja przynajmniej znalezc.
  if (!szukane.length && !w.strona) szukane = ["strona_www"];
  const start = Date.now();
  // Pusta lista = wszystko poza obrazami juz jest: AI nie jest wolane (0 USD),
  // logo i okladka biora sie tylko ze znacznikow oficjalnej strony.
  const { dane, koszt } = szukane.length
    ? await szukajDanychAI(w, szukane, apiKey)
    : {
        dane: { znaleziono: true, pewnosc: "wysoka", uwagi: "" } as Record<string, unknown>,
        koszt: { wyszukiwania: 0, tokeny_we: 0, tokeny_wy: 0, usd: 0, model: null, ms: 0 },
      };
  const d = dane as Record<string, unknown>;

  const p: PropozycjaLokalu = {
    znaleziono: d.znaleziono === true,
    pewnosc: (["wysoka", "srednia", "niska"].includes(d.pewnosc as string) ? d.pewnosc : "niska") as PropozycjaLokalu["pewnosc"],
    uwagi: typeof d.uwagi === "string" ? d.uwagi : "",
    adres: wezPole(d, "adres", jestTekst),
    dzielnica: wezPole(d, "dzielnica", (v): v is string => jestTekst(v) && w.dzielnice.includes(v)),
    telefon: wezPole(d, "telefon", jestTekst),
    strona_www: wezPole(d, "strona_www", (v): v is string => jestTekst(v) && !!bezpiecznyUrl(v)),
    opis: wezPole(d, "opis", jestTekst),
    kuchnia: wezPole(d, "kuchnia", (v): v is string => jestTekst(v) && w.kuchnie.includes(v)),
    poziom_cen: wezPole(d, "poziom_cen", jestLiczba),
    na_wynos: wezPole(d, "na_wynos", jestBool),
    bez_barier: wezPole(d, "bez_barier", jestBool),
    menu_url: wezPole(d, "menu_url", (v): v is string => jestTekst(v) && !!bezpiecznyUrl(v)),
    menu: wezPole(d, "menu", (v): v is KategoriaMenu[] => Array.isArray(v) && v.length > 0),
    logo: [],
    okladka: [],
    koszt,
  };
  const g = d.godziny as { wartosc?: unknown; zrodlo?: string } | undefined;
  const godz = oczyscGodziny(g?.wartosc);
  if (godz) p.godziny = { wartosc: godz, zrodlo: g?.zrodlo ?? null };

  // Obrazy: najpierw znaczniki z oficjalnej strony, potem to, co wskazal model.
  const strona = p.strona_www?.wartosc ?? w.strona ?? null;
  const zeStrony = strona ? await kandydaciZeStrony(strona) : [];
  const odAI = (klucz: string): KandydatObrazu[] =>
    Array.isArray(d[klucz])
      ? (d[klucz] as { url?: string; zrodlo?: string }[])
          .filter((k) => typeof k.url === "string")
          .map((k) => ({ url: k.url!, zrodlo: k.zrodlo ?? "", skad: "ai" as const }))
      : [];
  const sprawdz = async (lista: KandydatObrazu[]) => {
    const unikalne = lista.filter((k, i) => lista.findIndex((x) => x.url === k.url) === i).slice(0, 10);
    const ok = await Promise.all(unikalne.map((k) => czyObraz(k.url)));
    return unikalne.filter((_, i) => ok[i]);
  };
  const ogImage = zeStrony.filter((k) => !/logo|icon/i.test(k.url));
  p.logo = await sprawdz([...zeStrony.filter((k) => /logo|icon/i.test(k.url)), ...odAI("logo_urls"), ...ogImage]);
  p.okladka = await sprawdz(ogImage);
  p.koszt.ms = Date.now() - start;
  return p;
}
