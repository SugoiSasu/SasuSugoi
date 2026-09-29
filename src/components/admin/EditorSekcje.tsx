import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Zwijane sekcje edytora lokalu + przyklejona nawigacja skokowa.
 * Edytor mial ~10 kart pod soba i trzeba bylo dlugo przewijac (Mateusz
 * 2026-09-29). Sekcje sa zawsze zamontowane (zwijane tylko wizualnie), zeby stan
 * formularza i wgrywane pliki nie gubily sie przy zwijaniu.
 * Komunikacja przez zdarzenie okna: nawigacja i przyciski "rozwin/zwin wszystko"
 * nie musza znac stanu sekcji.
 */
const ZDARZENIE = "pz-sekcja-edytora";
type Szczegoly = { id?: string; wszystkie?: boolean; otwarta?: boolean };

export function otworzSekcje(id: string) {
  window.dispatchEvent(new CustomEvent<Szczegoly>(ZDARZENIE, { detail: { id, otwarta: true } }));
}
export function ustawWszystkie(otwarta: boolean) {
  window.dispatchEvent(new CustomEvent<Szczegoly>(ZDARZENIE, { detail: { wszystkie: true, otwarta } }));
}

export type Znacznik = { ok: boolean; tekst: string } | null;

export function SekcjaEdytora({
  id,
  tytul,
  znacznik,
  domyslnieOtwarta = false,
  children,
}: {
  id: string;
  tytul: string;
  znacznik?: Znacznik;
  domyslnieOtwarta?: boolean;
  children: React.ReactNode;
}) {
  const [otwarta, setOtwarta] = useState(domyslnieOtwarta);
  useEffect(() => {
    const onZdarzenie = (e: Event) => {
      const d = (e as CustomEvent<Szczegoly>).detail;
      if (d.wszystkie || d.id === id) setOtwarta(d.otwarta ?? true);
    };
    window.addEventListener(ZDARZENIE, onZdarzenie);
    return () => window.removeEventListener(ZDARZENIE, onZdarzenie);
  }, [id]);

  return (
    <section id={`sekcja-${id}`} className="scroll-mt-40">
      <button
        type="button"
        onClick={() => setOtwarta((o) => !o)}
        aria-expanded={otwarta}
        aria-controls={`sekcja-tresc-${id}`}
        className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-5 py-3.5 text-left transition hover:border-tomato/50"
      >
        <span className="font-display text-lg leading-none">{tytul}</span>
        {znacznik && (
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
              znacznik.ok ? "bg-ok/12 text-ok" : "bg-mustard/25 text-foreground"
            }`}
          >
            {znacznik.ok ? "✓" : "⚠"} {znacznik.tekst}
          </span>
        )}
        <ChevronDown
          size={18}
          aria-hidden="true"
          className={`ml-auto shrink-0 text-muted-foreground transition-transform ${otwarta ? "rotate-180" : ""}`}
        />
      </button>
      <div id={`sekcja-tresc-${id}`} hidden={!otwarta} className="mt-3 space-y-4">
        {children}
      </div>
    </section>
  );
}

export function NawigacjaSekcji({
  pozycje,
}: {
  pozycje: { id: string; etykieta: string; znacznik?: Znacznik }[];
}) {
  // Wysokosc przyklejonego naglowka admina zmienia sie (zawija sie na waskich
  // ekranach), wiec mierzymy ja zamiast zgadywac stala.
  const [top, setTop] = useState(0);
  useEffect(() => {
    const pomiar = () => {
      const h = document.querySelector("header.sticky") as HTMLElement | null;
      setTop(h ? Math.round(h.getBoundingClientRect().height) : 0);
    };
    pomiar();
    window.addEventListener("resize", pomiar);
    return () => window.removeEventListener("resize", pomiar);
  }, []);

  function idz(id: string) {
    otworzSekcje(id);
    // Po rozwinieciu tresc zmienia wysokosc - przewijamy w nastepnej klatce.
    requestAnimationFrame(() =>
      document.getElementById(`sekcja-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }

  return (
    <nav
      aria-label="Sekcje edytora lokalu"
      style={{ top }}
      className="sticky z-20 -mx-1 flex items-center gap-1.5 overflow-x-auto rounded-2xl border border-border bg-card/95 px-2 py-2 shadow-sm backdrop-blur"
    >
      {pozycje.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => idz(p.id)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-foreground/80 transition hover:bg-foreground/5 hover:text-foreground"
        >
          {p.etykieta}
          {p.znacznik && (
            <span
              aria-label={p.znacznik.tekst}
              title={p.znacznik.tekst}
              className={`h-1.5 w-1.5 rounded-full ${p.znacznik.ok ? "bg-ok" : "bg-mustard"}`}
            />
          )}
        </button>
      ))}
      <span className="mx-1 h-4 w-px shrink-0 bg-border" aria-hidden="true" />
      <button
        type="button"
        onClick={() => ustawWszystkie(true)}
        className="shrink-0 rounded-full px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        Rozwiń wszystko
      </button>
      <button
        type="button"
        onClick={() => ustawWszystkie(false)}
        className="shrink-0 rounded-full px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        Zwiń
      </button>
    </nav>
  );
}
