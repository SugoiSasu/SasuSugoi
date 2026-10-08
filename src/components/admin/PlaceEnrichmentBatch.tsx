import { useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertCircle, ArrowRight, Loader2, Sparkles, Square } from "lucide-react";
import { usePlacesWithMenus, type Place } from "@/lib/places-api";
import { szukajDanychLokalu } from "@/lib/place-enrichment.functions";
import { czyTrwa, usePropozycjeLokali, type WierszPropozycji } from "@/lib/place-enrichment-api";

/**
 * Hurtowe szukanie danych dla szkicow. Szuka w przegladarce admina po dwa
 * lokale naraz (kazdy to osobne wywolanie funkcji, ok. minuty) i zapisuje
 * propozycje w bazie - przegladanie potem w edytorze lokalu, w dowolnym
 * momencie. Zamkniecie karty przerywa tylko kolejke; to, co juz znalezione,
 * zostaje.
 */

const ROWNOLEGLE = 2;
/** Zmierzone na szkicach Haiku z pomijaniem wypelnionych pol: 0,06-0,10 USD. */
const KOSZT_USD = 0.08;

function braki(p: Place): string[] {
  const b: string[] = [];
  if (!p.avatar_url) b.push("logo");
  if (!p.opening_hours || !Object.keys(p.opening_hours).length) b.push("godziny");
  if (!p.menu_items?.length) b.push("menu");
  if (!p.phone) b.push("telefon");
  if (!p.website) b.push("www");
  return b;
}

function Status({ w, wKolejce }: { w: WierszPropozycji | undefined; wKolejce: boolean }) {
  if (czyTrwa(w)) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-navy dark:text-cream">
        <Loader2 size={12} className="animate-spin" /> szukam…
      </span>
    );
  }
  if (wKolejce) return <span className="text-xs text-muted-foreground">w kolejce</span>;
  if (!w) return <span className="text-xs text-muted-foreground">nie szukano</span>;
  if (w.status === "gotowe") {
    const p = w.propozycja;
    const niepewne = p && (!p.znaleziono || p.pewnosc !== "wysoka");
    return (
      <span className={`text-xs font-semibold ${niepewne ? "text-tomato" : "text-ok"}`}>
        {niepewne ? "propozycja - sprawdź dokładnie" : "propozycja gotowa"}
      </span>
    );
  }
  return (
    <span className="text-xs font-semibold text-destructive" title={w.blad ?? ""}>
      {w.status === "szukam" ? "przerwane" : "błąd"}
    </span>
  );
}

export function PlaceEnrichmentBatch() {
  const { data: places, isLoading } = usePlacesWithMenus(true);
  const { data: propozycje } = usePropozycjeLokali();
  const szukaj = useServerFn(szukajDanychLokalu);
  const qc = useQueryClient();
  const [kolejka, setKolejka] = useState<string[]>([]);
  const [potwierdz, setPotwierdz] = useState(false);
  const stop = useRef(false);

  const szkice = useMemo(() => (places ?? []).filter((p) => !p.is_published), [places]);
  const mapa = useMemo(() => new Map((propozycje ?? []).map((w) => [w.place_id, w])), [propozycje]);
  const doSzukania = szkice.filter((p) => {
    const w = mapa.get(p.id);
    return !w || (w.status !== "gotowe" && !czyTrwa(w));
  });
  const biegnie = kolejka.length > 0;

  async function uruchom(ids: string[]) {
    setPotwierdz(false);
    stop.current = false;
    setKolejka(ids);
    const doZrobienia = [...ids];
    let ok = 0;
    let bledy = 0;
    const pracownik = async () => {
      while (doZrobienia.length && !stop.current) {
        const id = doZrobienia.shift()!;
        // Pokazujemy "szukam" od razu, zanim serwer zapisze swoj status.
        await qc.invalidateQueries({ queryKey: ["place-enrichment"] });
        try {
          await szukaj({ data: { placeId: id } });
          ok++;
        } catch {
          bledy++;
        }
        setKolejka((k) => k.filter((x) => x !== id));
        await qc.invalidateQueries({ queryKey: ["place-enrichment"] });
      }
    };
    await Promise.all(Array.from({ length: ROWNOLEGLE }, pracownik));
    setKolejka([]);
    toast.success(`Gotowe: ${ok} propozycji${bledy ? `, ${bledy} błędów` : ""}. Przeglądaj je w edytorze lokalu.`);
  }

  if (isLoading) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="animate-spin" size={28} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2 font-semibold">
          <Sparkles size={16} className="text-tomato" /> Uzupełnianie szkiców z internetu
        </div>
        <p className="text-sm text-muted-foreground max-w-prose">
          AI wyszukuje każdy lokal (oficjalna strona, Facebook, platformy zamówień) i zapisuje propozycje: logo,
          godziny, menu, telefon, opis. Nic nie trafia do lokalu samo - otwierasz lokal, zaznaczasz, co przyjąć, i
          klikasz Zapisz.
        </p>
        {biegnie ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 text-sm font-semibold">
              <Loader2 size={15} className="animate-spin" /> Zostało {kolejka.length}. Nie zamykaj tej karty.
            </span>
            <button
              type="button"
              onClick={() => {
                stop.current = true;
                toast("Zatrzymam po bieżących lokalach");
              }}
              className="chip bg-card border border-border text-xs"
            >
              <Square size={11} /> Zatrzymaj
            </button>
          </div>
        ) : potwierdz ? (
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-tomato/10 px-3 py-2.5 text-sm">
            <AlertCircle size={15} className="text-tomato" />
            <span>
              {doSzukania.length} lokali × ok. {KOSZT_USD.toFixed(2).replace(".", ",")} $ ≈{" "}
              <b>{(doSzukania.length * KOSZT_USD).toFixed(2).replace(".", ",")} $</b>, ok. {Math.max(1, Math.ceil((doSzukania.length / ROWNOLEGLE) * 0.4))} min.
            </span>
            <button
              type="button"
              onClick={() => uruchom(doSzukania.map((p) => p.id))}
              className="rounded-full bg-tomato px-4 py-1.5 text-sm font-semibold text-cream hover:bg-tomato/90"
            >
              Szukaj
            </button>
            <button type="button" onClick={() => setPotwierdz(false)} className="text-sm text-muted-foreground">
              Anuluj
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPotwierdz(true)}
            disabled={!doSzukania.length}
            className="inline-flex items-center gap-2 rounded-full bg-navy px-4 py-2 text-sm font-semibold text-cream hover:bg-navy/90 disabled:opacity-50"
          >
            <Sparkles size={14} />
            {doSzukania.length ? `Szukaj dla ${doSzukania.length} szkiców bez propozycji` : "Wszystkie szkice mają propozycje"}
          </button>
        )}
      </div>

      <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
        {szkice.map((p) => {
          const b = braki(p);
          return (
            <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{p.name}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {b.length ? (
                    b.map((x) => (
                      <span key={x} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        brak: {x}
                      </span>
                    ))
                  ) : (
                    <span className="text-[11px] text-ok">komplet</span>
                  )}
                </div>
              </div>
              <Status w={mapa.get(p.id)} wKolejce={kolejka.includes(p.id) && !czyTrwa(mapa.get(p.id))} />
              <Link
                to="/admin/places/$id"
                params={{ id: p.id }}
                className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:border-tomato hover:text-tomato"
              >
                {mapa.get(p.id)?.status === "gotowe" ? "Przejrzyj" : "Otwórz"} <ArrowRight size={12} />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
