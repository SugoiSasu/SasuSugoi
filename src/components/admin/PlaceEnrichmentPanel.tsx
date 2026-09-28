import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertCircle, Check, ExternalLink, Loader2, RefreshCw, Sparkles, X } from "lucide-react";
import type { OpeningHours, PlaceInput } from "@/lib/places-api";
import { MODEL_DOKLADNY, type KandydatObrazu, type PropozycjaLokalu } from "@/lib/place-enrichment.core";
import { pobierzObrazLokalu } from "@/lib/place-enrichment.functions";
import { czyTrwa, useOdrzucPropozycje, usePropozycjaLokalu, useSzukajDanych } from "@/lib/place-enrichment-api";

/**
 * "Uzupelnij z internetu": pokazuje propozycje pole po polu - obecna wartosc,
 * propozycja i zrodlo - i przyjmuje tylko zaznaczone. Nic nie zapisuje do
 * bazy: przyjete pola laduja w formularzu, admin sprawdza i klika Zapisz.
 *
 * Domyslnie zaznaczone sa tylko pola, ktore dzis sa puste - istniejacych
 * danych propozycja nie nadpisze, chyba ze admin sam to zaznaczy.
 */

const DNI: [keyof OpeningHours, string][] = [
  ["mon", "Pn"],
  ["tue", "Wt"],
  ["wed", "Śr"],
  ["thu", "Cz"],
  ["fri", "Pt"],
  ["sat", "So"],
  ["sun", "Nd"],
];

function godzinyTekst(g: OpeningHours | null | undefined): string {
  if (!g || !Object.keys(g).length) return "";
  return DNI.map(([k, l]) => {
    const h = g[k];
    return `${l} ${h ? `${h.open}–${h.close}` : "zamkn."}`;
  }).join(" · ");
}

const CENY = ["", "Bardzo tanio", "Tanio", "Średnio", "Drogo", "Bardzo drogo"];

type Klucz =
  | "address"
  | "district"
  | "phone"
  | "website"
  | "description"
  | "cuisine"
  | "price_range"
  | "has_takeaway"
  | "wheelchair_accessible"
  | "opening_hours"
  | "menu_url"
  | "menu_items";

interface Wiersz {
  klucz: Klucz;
  etykieta: string;
  teraz: string;
  propozycja: string;
  wartosc: PlaceInput[Klucz];
  zrodlo: string | null;
  /** Obecna wartosc pusta -> domyslnie zaznaczone. */
  puste: boolean;
}

function zbudujWiersze(p: PropozycjaLokalu, f: PlaceInput): Wiersz[] {
  const w: Wiersz[] = [];
  const tekst = (klucz: Klucz, etykieta: string, pole: { wartosc: string; zrodlo: string | null } | undefined) => {
    if (!pole) return;
    const teraz = String(f[klucz] ?? "").trim();
    if (teraz === pole.wartosc.trim()) return;
    w.push({ klucz, etykieta, teraz, propozycja: pole.wartosc, wartosc: pole.wartosc, zrodlo: pole.zrodlo, puste: !teraz });
  };
  tekst("address", "Adres", p.adres);
  tekst("district", "Dzielnica", p.dzielnica);
  tekst("phone", "Telefon", p.telefon);
  tekst("website", "Strona www", p.strona_www);
  tekst("description", "Opis", p.opis);
  if (p.kuchnia && p.kuchnia.wartosc !== f.cuisine) {
    w.push({
      klucz: "cuisine",
      etykieta: "Kuchnia",
      teraz: f.cuisine,
      propozycja: p.kuchnia.wartosc,
      wartosc: p.kuchnia.wartosc,
      zrodlo: p.kuchnia.zrodlo,
      // Kuchnia zawsze ma jakas wartosc (domyslna z formularza) - nie nadpisujemy sami.
      puste: false,
    });
  }
  if (p.poziom_cen) {
    const nowa = "$".repeat(p.poziom_cen.wartosc);
    if (nowa !== f.price_range) {
      w.push({
        klucz: "price_range",
        etykieta: "Poziom cen",
        teraz: f.price_range ?? "",
        propozycja: `${nowa} (${CENY[p.poziom_cen.wartosc]})`,
        wartosc: nowa,
        zrodlo: p.poziom_cen.zrodlo,
        // Stare wpisy tekstowe ("20-50zl") tez traktujemy jak puste - i tak sa do zamiany.
        puste: !/^\${1,5}$/.test(f.price_range ?? ""),
      });
    }
  }
  const flaga = (klucz: "has_takeaway" | "wheelchair_accessible", etykieta: string, pole: { wartosc: boolean; zrodlo: string | null } | undefined) => {
    if (!pole || pole.wartosc === f[klucz]) return;
    w.push({ klucz, etykieta, teraz: f[klucz] ? "tak" : "nie", propozycja: pole.wartosc ? "tak" : "nie", wartosc: pole.wartosc, zrodlo: pole.zrodlo, puste: !f[klucz] });
  };
  flaga("has_takeaway", "Na wynos", p.na_wynos);
  flaga("wheelchair_accessible", "Bez schodów", p.bez_barier);
  if (p.godziny) {
    const teraz = godzinyTekst(f.opening_hours);
    const nowe = godzinyTekst(p.godziny.wartosc);
    if (teraz !== nowe) {
      w.push({ klucz: "opening_hours", etykieta: "Godziny", teraz, propozycja: nowe, wartosc: p.godziny.wartosc as OpeningHours, zrodlo: p.godziny.zrodlo, puste: !teraz });
    }
  }
  tekst("menu_url", "Link do menu", p.menu_url);
  if (p.menu) {
    const kat = p.menu.wartosc;
    const poz = kat.reduce((n, c) => n + c.items.length, 0);
    const obecne = f.menu_items ?? [];
    const obecnePoz = obecne.reduce((n, c) => n + c.items.length, 0);
    w.push({
      klucz: "menu_items",
      etykieta: "Menu",
      teraz: obecnePoz ? `${obecnePoz} pozycji` : "",
      propozycja: `${poz} pozycji w ${kat.length} kat.: ${kat.map((c) => c.category).join(", ")}`,
      wartosc: kat,
      zrodlo: p.menu.zrodlo,
      puste: obecnePoz === 0,
    });
  }
  return w;
}

function Zrodlo({ url }: { url: string | null }) {
  if (!url) return <span className="text-muted-foreground">brak źródła</span>;
  let host = url;
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    /* zostaje surowy tekst */
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-tomato hover:underline">
      {host} <ExternalLink size={11} />
    </a>
  );
}

function WyborObrazu({
  tytul,
  kandydaci,
  wybrany,
  onWybierz,
  ksztalt,
}: {
  tytul: string;
  kandydaci: KandydatObrazu[];
  wybrany: string | null;
  onWybierz: (url: string | null) => void;
  ksztalt: "kwadrat" | "baner";
}) {
  if (!kandydaci.length) return null;
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{tytul}</div>
      <div className="flex flex-wrap gap-2">
        {kandydaci.map((k) => {
          const aktywny = wybrany === k.url;
          return (
            <button
              key={k.url}
              type="button"
              onClick={() => onWybierz(aktywny ? null : k.url)}
              aria-pressed={aktywny}
              title={`Źródło: ${k.zrodlo}`}
              className={`relative overflow-hidden rounded-xl border-2 bg-[repeating-conic-gradient(#0001_0_25%,transparent_0_50%)] bg-[length:12px_12px] transition ${
                ksztalt === "kwadrat" ? "h-20 w-20" : "h-20 w-40"
              } ${aktywny ? "border-tomato ring-2 ring-tomato/30" : "border-border hover:border-tomato/60"}`}
            >
              <img src={k.url} alt="" className="h-full w-full object-contain" loading="lazy" />
              {aktywny && (
                <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-tomato text-cream">
                  <Check size={12} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function PlaceEnrichmentPanel({
  placeId,
  form,
  onApply,
}: {
  placeId: string;
  form: PlaceInput;
  onApply: (patch: Partial<PlaceInput>) => void;
}) {
  const { data: wiersz } = usePropozycjaLokalu(placeId);
  const szukaj = useSzukajDanych();
  const odrzuc = useOdrzucPropozycje();
  const pobierzObraz = useServerFn(pobierzObrazLokalu);
  const [otwarty, setOtwarty] = useState(false);
  const [zaznaczone, setZaznaczone] = useState<Set<Klucz>>(new Set());
  const [logo, setLogo] = useState<string | null>(null);
  const [okladka, setOkladka] = useState<string | null>(null);
  const [przyjmuje, setPrzyjmuje] = useState(false);

  const p = wiersz?.status === "gotowe" ? wiersz.propozycja : null;
  const wiersze = useMemo(() => (p ? zbudujWiersze(p, form) : []), [p, form]);

  // Domyslne zaznaczenie liczone raz na propozycje, nie przy kazdej zmianie formularza.
  const znacznik = wiersz?.updated_at ?? "";
  useEffect(() => {
    if (!p) return;
    setZaznaczone(new Set(zbudujWiersze(p, form).filter((w) => w.puste).map((w) => w.klucz)));
    setLogo(!form.avatar_url && p.logo[0] ? p.logo[0].url : null);
    setOkladka(null);
    setOtwarty(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [znacznik]);

  const trwa = szukaj.isPending || czyTrwa(wiersz);

  async function start(dokladnie = false) {
    try {
      await szukaj.mutateAsync({ placeId, dokladnie });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Wyszukiwanie nie powiodło się");
    }
  }

  async function przyjmij() {
    const patch: Partial<PlaceInput> = {};
    for (const w of wiersze) {
      if (zaznaczone.has(w.klucz)) (patch as Record<string, unknown>)[w.klucz] = w.wartosc;
    }
    setPrzyjmuje(true);
    try {
      // Obrazy kopiujemy do naszego storage - link do cudzej strony kiedys padnie.
      if (logo) patch.avatar_url = (await pobierzObraz({ data: { placeId, url: logo, rodzaj: "logo" } })).url;
      if (okladka) patch.cover_image_url = (await pobierzObraz({ data: { placeId, url: okladka, rodzaj: "okladka" } })).url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nie udało się pobrać obrazu");
      setPrzyjmuje(false);
      return;
    }
    setPrzyjmuje(false);
    const ile = Object.keys(patch).length;
    if (!ile) {
      toast("Nic nie zaznaczono");
      return;
    }
    onApply(patch);
    setOtwarty(false);
    toast.success(`Przyjęto ${ile} ${ile === 1 ? "pole" : ile < 5 ? "pola" : "pól"}. Sprawdź formularz i kliknij Zapisz.`);
  }

  return (
    <div className="rounded-2xl border border-navy/20 bg-navy/[0.03] p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles size={15} className="text-tomato" /> Uzupełnij z internetu
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            AI szuka tylko tego, czego lokal jeszcze nie ma (strona, Facebook, platformy zamówień), i przy każdym polu podaje źródło. Ok. 20 s i ok. 0,07 $ za lokal.
          </p>
        </div>
        <div className="flex gap-2">
          {p && !otwarty && (
            <button type="button" onClick={() => setOtwarty(true)} className="chip bg-card border border-border text-xs">
              Pokaż propozycję
            </button>
          )}
          <button
            type="button"
            onClick={() => start()}
            disabled={trwa}
            className="inline-flex items-center gap-1.5 rounded-full bg-navy px-3.5 py-2 text-xs font-semibold text-cream transition hover:bg-navy/90 disabled:opacity-60"
          >
            {trwa ? <Loader2 size={13} className="animate-spin" /> : p ? <RefreshCw size={13} /> : <Sparkles size={13} />}
            {trwa ? "Szukam… (ok. minuty)" : p ? "Szukaj ponownie" : "Szukaj"}
          </button>
        </div>
      </div>

      {wiersz?.status === "blad" && !trwa && (
        <p className="flex items-start gap-1.5 rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertCircle size={14} className="mt-px shrink-0" /> {wiersz.blad ?? "Wyszukiwanie nie powiodło się"}
        </p>
      )}

      {p && otwarty && (
        <div className="space-y-4">
          {(!p.znaleziono || p.pewnosc !== "wysoka") && (
            <p className="flex items-start gap-1.5 rounded-xl bg-tomato/10 px-3 py-2 text-xs font-semibold text-tomato">
              <AlertCircle size={14} className="mt-px shrink-0" />
              <span className="flex-1">
                {!p.znaleziono
                  ? "AI nie jest pewne, czy znalazło ten lokal. Sprawdź źródła, zanim cokolwiek przyjmiesz."
                  : `Pewność: ${p.pewnosc}. Sprawdź źródła, zwłaszcza godziny.`}
              </span>
              {p.koszt.model !== MODEL_DOKLADNY && (
                <button
                  type="button"
                  onClick={() => start(true)}
                  disabled={trwa}
                  className="shrink-0 rounded-full bg-tomato px-3 py-1 text-[11px] font-semibold text-cream hover:bg-tomato/90 disabled:opacity-60"
                  title="Mocniejszy model - lepiej rozstrzyga sprzeczne źródła. Ok. 0,25 $."
                >
                  Szukaj dokładniej
                </button>
              )}
            </p>
          )}
          {p.uwagi && <p className="text-xs leading-relaxed text-muted-foreground">{p.uwagi}</p>}

          {wiersze.length === 0 && !p.logo.length && !p.okladka.length ? (
            <p className="text-sm text-muted-foreground">Nic nowego - wszystko, co znaleziono, już jest w formularzu.</p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border bg-card">
              {wiersze.map((w) => {
                const on = zaznaczone.has(w.klucz);
                return (
                  <li key={w.klucz}>
                    <label className="flex cursor-pointer gap-3 px-3 py-2.5 text-sm">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() =>
                          setZaznaczone((s) => {
                            const n = new Set(s);
                            if (n.has(w.klucz)) n.delete(w.klucz);
                            else n.add(w.klucz);
                            return n;
                          })
                        }
                        className="mt-1"
                      />
                      <span className="min-w-0 flex-1 space-y-0.5">
                        <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                          <span className="font-semibold">{w.etykieta}</span>
                          <span className="text-[11px]">
                            <Zrodlo url={w.zrodlo} />
                          </span>
                        </span>
                        <span className="block break-words">{w.propozycja}</span>
                        <span className="block break-words text-xs text-muted-foreground">
                          Teraz: {w.teraz || "puste"}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}

          <WyborObrazu tytul="Logo (kliknij, żeby wybrać)" kandydaci={p.logo} wybrany={logo} onWybierz={setLogo} ksztalt="kwadrat" />
          <WyborObrazu tytul="Okładka (opcjonalnie)" kandydaci={p.okladka} wybrany={okladka} onWybierz={setOkladka} ksztalt="baner" />

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={przyjmij}
              disabled={przyjmuje}
              className="inline-flex items-center gap-1.5 rounded-full bg-tomato px-4 py-2 text-sm font-semibold text-cream hover:bg-tomato/90 disabled:opacity-60"
            >
              {przyjmuje ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Przyjmij zaznaczone
            </button>
            <button
              type="button"
              onClick={() => setOtwarty(false)}
              className="chip bg-card border border-border text-xs"
            >
              Zwiń
            </button>
            <button
              type="button"
              onClick={() => odrzuc.mutate(placeId)}
              disabled={odrzuc.isPending}
              className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
            >
              <X size={12} /> Odrzuć propozycję
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Szukano {new Date(wiersz!.updated_at).toLocaleString("pl-PL")} ·{" "}
            {p.koszt.model === MODEL_DOKLADNY ? "dokładnie" : p.koszt.model ? "tanio" : "bez AI"} ·{" "}
            {(p.koszt.usd ?? 0).toFixed(2).replace(".", ",")} $ · {Math.round(p.koszt.ms / 1000)} s
          </p>
        </div>
      )}
    </div>
  );
}
