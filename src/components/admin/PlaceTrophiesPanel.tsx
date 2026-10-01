import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, ExternalLink, Loader2, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { TrophyIcon } from "@/components/TrophyIcon";
import { szukajTrofeow } from "@/lib/place-trophies.functions";
import {
  useDodajTrofeum,
  useTrofeaLokalu,
  useTrofeaWierszeAdmin,
  useUsunTrofeum,
  useZatwierdzTrofeum,
} from "@/lib/trophies-api";
import { OPIS_RODZAJU, podpisTrofeum, type RodzajTrofeum } from "@/lib/trophies";
import { useQueryClient } from "@tanstack/react-query";

const RODZAJE_RECZNE: RodzajTrofeum[] = [
  "michelin_star",
  "michelin_bib",
  "michelin_recommended",
  "warte_pozarcia",
  "inna_nagroda",
];

/**
 * Trofea lokalu w edytorze admina: zatwierdzone (reczne), propozycje z AI do
 * zatwierdzenia oraz wygrane z naszego glosowania (tylko do odczytu).
 */
export function PlaceTrophiesPanel({ placeId, autoSearch = false }: { placeId: string; autoSearch?: boolean }) {
  const { data: wiersze, isLoading } = useTrofeaWierszeAdmin(placeId);
  const { data: wszystkie } = useTrofeaLokalu(placeId);
  const dodaj = useDodajTrofeum(placeId);
  const zatwierdz = useZatwierdzTrofeum(placeId);
  const usun = useUsunTrofeum(placeId);
  const qc = useQueryClient();
  const szukaj = useServerFn(szukajTrofeow);
  const [szuka, setSzuka] = useState(false);

  const [rodzaj, setRodzaj] = useState<RodzajTrofeum>("michelin_star");
  const [poziom, setPoziom] = useState(1);
  const [rok, setRok] = useState(new Date().getFullYear());
  const [opis, setOpis] = useState("");
  const [zrodlo, setZrodlo] = useState("");

  const zatwierdzone = (wiersze ?? []).filter((w) => w.status === "zatwierdzone");
  const propozycje = (wiersze ?? []).filter((w) => w.status === "propozycja");
  const zGlosowania = (wszystkie ?? []).filter((t) => t.origin === "glosowanie");

  async function szukajAI() {
    setSzuka(true);
    try {
      const r = await szukaj({ data: { placeId } });
      qc.invalidateQueries({ queryKey: ["place-trophies-admin", placeId] });
      if (r.dodane > 0) toast.success(`AI znalazło ${r.dodane} do sprawdzenia (ok. ${r.usd} USD)`);
      else if (!r.znaleziono) toast.message("AI nie znalazło tego lokalu w źródłach", { description: r.uwagi || undefined });
      else toast.message("Brak nowych trofeów", { description: r.uwagi || "Nic, czego jeszcze nie ma na liście." });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Wyszukiwanie nie powiodło się");
    } finally {
      setSzuka(false);
    }
  }

  const wystartowano = useRef(false);
  useEffect(() => {
    if (!autoSearch || wystartowano.current) return;
    wystartowano.current = true;
    void szukajAI();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSearch]);

  async function dodajRecznie() {
    if (rodzaj === "inna_nagroda" && !opis.trim()) {
      toast.error("Wpisz nazwę nagrody");
      return;
    }
    const url = zrodlo.trim();
    if (url && !/^https?:\/\/\S+$/i.test(url)) {
      toast.error("Źródło musi być adresem http(s)://");
      return;
    }
    try {
      await dodaj.mutateAsync({
        kind: rodzaj,
        tier: rodzaj === "michelin_star" ? poziom : null,
        year: rok,
        label: opis.trim() || null,
        source_url: url || null,
      });
      setOpis("");
      setZrodlo("");
      toast.success("Dodano trofeum");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nie udało się dodać");
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            Gwiazdki, Bib Gourmand i wyróżnienia Michelin oraz Warte poŻarcia. Na profilu widać je tylko, gdy lokal
            ma choć jedno.
          </p>
          <button
            type="button"
            onClick={szukajAI}
            disabled={szuka}
            className="inline-flex items-center gap-2 rounded-full bg-navy px-4 py-2 text-sm font-semibold text-cream hover:bg-navy/90 disabled:opacity-60"
          >
            {szuka ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {szuka ? "Szukam…" : "Szukaj trofeów (AI)"}
          </button>
        </div>

        {propozycje.length > 0 && (
          <div className="space-y-2 rounded-xl border border-mustard/50 bg-mustard/10 p-3">
            <div className="text-xs font-bold uppercase tracking-wider">Do sprawdzenia (znalezione przez AI)</div>
            {propozycje.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center gap-2 text-sm">
                <TrophyIcon trofeum={t} size={20} />
                <span className="font-semibold">{podpisTrofeum(t)}</span>
                {t.source_url && (
                  <a
                    href={t.source_url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="inline-flex items-center gap-1 text-xs text-tomato hover:underline"
                  >
                    źródło <ExternalLink size={11} />
                  </a>
                )}
                <span className="ml-auto flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => zatwierdz.mutate(t.id, { onError: (e) => toast.error(e.message) })}
                    disabled={zatwierdz.isPending}
                    className="inline-flex items-center gap-1 rounded-full bg-ok px-3 py-1 text-xs font-semibold text-white"
                  >
                    <Check size={12} /> Zatwierdź
                  </button>
                  <button
                    type="button"
                    onClick={() => usun.mutate(t.id, { onError: (e) => toast.error(e.message) })}
                    className="rounded-full border border-border px-3 py-1 text-xs font-semibold hover:border-destructive hover:text-destructive"
                  >
                    Odrzuć
                  </button>
                </span>
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground">
              Sprawdź źródło, zanim zatwierdzisz: AI mogło trafić na lokal o podobnej nazwie.
            </p>
          </div>
        )}

        {isLoading ? (
          <Loader2 className="animate-spin text-muted-foreground" size={16} />
        ) : zatwierdzone.length + zGlosowania.length === 0 ? (
          <p className="text-xs text-muted-foreground">Brak trofeów. Sekcja „Trofea" nie pojawi się na profilu lokalu.</p>
        ) : (
          <ul className="space-y-1.5">
            {zGlosowania.map((t, i) => (
              <li key={`g${i}`} className="flex items-center gap-2 text-sm">
                <TrophyIcon trofeum={t} size={20} />
                <span className="font-semibold">{podpisTrofeum(t)}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  z głosowania
                </span>
              </li>
            ))}
            {zatwierdzone.map((t) => (
              <li key={t.id} className="flex items-center gap-2 text-sm">
                <TrophyIcon trofeum={t} size={20} />
                <span className="font-semibold">{podpisTrofeum(t)}</span>
                {t.proposed_by_ai && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    AI, zatwierdzone
                  </span>
                )}
                {t.source_url && (
                  <a
                    href={t.source_url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="inline-flex items-center gap-1 text-xs text-tomato hover:underline"
                  >
                    źródło <ExternalLink size={11} />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => usun.mutate(t.id, { onError: (e) => toast.error(e.message) })}
                  aria-label={`Usuń: ${podpisTrofeum(t)}`}
                  className="ml-auto text-destructive hover:opacity-80"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* div, nie form: panel siedzi wewnatrz formularza edytora (zagniezdzone formy sa niepoprawne). */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dodaj ręcznie</div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-semibold text-muted-foreground">
            Rodzaj
            <select value={rodzaj} onChange={(e) => setRodzaj(e.target.value as RodzajTrofeum)} className="input mt-1">
              {RODZAJE_RECZNE.map((r) => (
                <option key={r} value={r}>
                  {OPIS_RODZAJU[r]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-muted-foreground">
            Rok
            <input
              type="number"
              min={1950}
              max={new Date().getFullYear() + 1}
              value={rok}
              onChange={(e) => setRok(parseInt(e.target.value) || new Date().getFullYear())}
              className="input mt-1"
            />
          </label>
        </div>
        {rodzaj === "michelin_star" && (
          <label className="block text-xs font-semibold text-muted-foreground">
            Liczba gwiazdek
            <select value={poziom} onChange={(e) => setPoziom(Number(e.target.value))} className="input mt-1">
              <option value={1}>1 gwiazdka</option>
              <option value={2}>2 gwiazdki</option>
              <option value={3}>3 gwiazdki</option>
            </select>
          </label>
        )}
        <label className="block text-xs font-semibold text-muted-foreground">
          {rodzaj === "warte_pozarcia"
            ? "Kategoria (np. Kebaby)"
            : rodzaj === "inna_nagroda"
              ? "Nazwa nagrody (wymagane, np. White Star)"
              : "Dopisek (opcjonalnie)"}
          <input value={opis} maxLength={120} onChange={(e) => setOpis(e.target.value)} className="input mt-1" />
        </label>
        <label className="block text-xs font-semibold text-muted-foreground">
          Źródło (link, opcjonalnie)
          <input
            type="url"
            value={zrodlo}
            onChange={(e) => setZrodlo(e.target.value)}
            placeholder="https://guide.michelin.com/..."
            className="input mt-1"
          />
        </label>
        <button
          type="button"
          onClick={dodajRecznie}
          disabled={dodaj.isPending}
          className="inline-flex items-center gap-2 rounded-full bg-tomato px-4 py-2 text-sm font-semibold text-cream disabled:opacity-60"
        >
          {dodaj.isPending && <Loader2 size={14} className="animate-spin" />} Dodaj trofeum
        </button>
      </div>
    </div>
  );
}
