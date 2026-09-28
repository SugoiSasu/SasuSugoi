import { useEffect } from "react";
import { toast } from "sonner";

/** Nie czesciej niz raz na minute - powrot do aplikacji bywa co kilka sekund. */
const ODSTEP_MS = 60_000;

function trybAplikacji(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // Safari na iOS: aplikacja dodana do ekranu glownego.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Czy przeladowanie cos zepsuje: ktos pisze albo ma otwarte okno. */
function uzytkownikCosRobi(): boolean {
  const el = document.activeElement;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLElement && el.isContentEditable) return true;
  const pola = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    "textarea, input[type=text], input[type=search]:not([aria-label*='Szukaj'])",
  );
  if ([...pola].some((p) => p.value.trim().length > 0)) return true;
  return !!document.querySelector('[role="dialog"][aria-modal="true"]');
}

/**
 * iPhone wznawia aplikacje z ekranu glownego z pamieci - bez przeladowania,
 * z JS sprzed ostatniego wdrozenia. Po kazdym powrocie (i nie czesciej niz
 * co minute) pytamy serwer o wersje:
 *  - aplikacja z ekranu glownego: przeladowanie, o ile nikt nic nie pisze,
 *  - zwykla karta przegladarki: toast z "Odswiez" (nie przeladowujemy
 *    komus strony, w ktorej mogl cos czytac).
 */
export function useNowaWersja() {
  useEffect(() => {
    if (__PZ_WERSJA__.startsWith("lokalna-")) return; // lokalnie kazdy build jest "nowy"
    let ostatnio = 0;
    let pokazano = false;

    async function sprawdz() {
      if (document.visibilityState !== "visible") return;
      const teraz = Date.now();
      if (teraz - ostatnio < ODSTEP_MS) return;
      ostatnio = teraz;
      try {
        const r = await fetch(`/api/public/wersja?t=${teraz}`, { cache: "no-store" });
        if (!r.ok) return;
        const { wersja } = (await r.json()) as { wersja?: string };
        if (!wersja || wersja === __PZ_WERSJA__) return;
        if (trybAplikacji() && !uzytkownikCosRobi()) {
          window.location.reload();
          return;
        }
        if (pokazano) return;
        pokazano = true;
        toast("Jest nowa wersja poŻeramy", {
          id: "nowa-wersja",
          duration: Infinity,
          action: { label: "Odśwież", onClick: () => window.location.reload() },
        });
      } catch {
        /* offline albo blad sieci - sprawdzimy przy nastepnym powrocie */
      }
    }

    document.addEventListener("visibilitychange", sprawdz);
    window.addEventListener("focus", sprawdz);
    window.addEventListener("pageshow", sprawdz);
    return () => {
      document.removeEventListener("visibilitychange", sprawdz);
      window.removeEventListener("focus", sprawdz);
      window.removeEventListener("pageshow", sprawdz);
    };
  }, []);
}
