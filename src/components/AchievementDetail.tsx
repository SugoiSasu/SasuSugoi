import { useEffect } from "react";
import { Lock, Trophy, X } from "lucide-react";
import type { Achievement } from "@/lib/achievements-api";
import {
  RARITY_DOT,
  RARITY_LABEL,
  odsetekGraczyLabel,
  type AchievementStat,
  type Rarity,
} from "@/lib/achievement-rarity";
import { kategoriaKolor, kategoriaLabel } from "@/lib/achievement-categories";
import type { TileProgress } from "@/components/AchievementTile";

interface Props {
  a: Achievement;
  zdobyta: boolean;
  zdobytaKiedy: string | null;
  postep: TileProgress | null;
  rarity: Rarity | null;
  stat: AchievementStat | undefined;
  onClose: () => void;
}

/**
 * Szczegoly odznaki. Na desktopie panel z prawej, na telefonie arkusz od dolu -
 * jeden komponent, dwa ulozenia przez klasy, zamiast dwoch kopii tresci.
 *
 * Nie jest modalem: nie blokuje strony, nie przechwytuje focusa i nie ma
 * nakladki na desktopie. Klikanie kolejnych odznak ma podmieniac zawartosc
 * panelu, a nie zamykac i otwierac okno.
 */
export function AchievementDetail({
  a,
  zdobyta,
  zdobytaKiedy,
  postep,
  rarity,
  stat,
  onClose,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const wToku = !!postep && postep.pct > 0;
  const odsetek = odsetekGraczyLabel(stat);

  return (
    <>
      {/* Przyciemnienie tylko na telefonie - na desktopie panel stoi obok
          tresci, a nie nad nia, wiec nie ma czego przyciemniac. */}
      <button
        type="button"
        aria-label="Zamknij szczegóły odznaki"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-navy/45 lg:hidden"
      />

      <aside
        aria-label={`Szczegóły odznaki ${a.name}`}
        // Arkusz na telefonie konczy sie nad dolnym paskiem nawigacji i
        // centralnym "+", a nie pod nimi - bez tego ostatni wiersz tresci
        // (data zdobycia albo pasek postepu) chowal sie za przyciskiem.
        className="pz-fade-in fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-3xl border border-border bg-card p-5 pb-[calc(env(safe-area-inset-bottom,0px)+6rem)] shadow-2xl lg:static lg:z-auto lg:max-h-none lg:rounded-2xl lg:p-4 lg:shadow-sm"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border lg:hidden" aria-hidden />

        <div className="flex items-start gap-3">
          <span
            className={`pz-hex relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden ${
              zdobyta ? kategoriaKolor(a.category) : wToku ? `${kategoriaKolor(a.category)} opacity-40` : "bg-muted"
            }`}
            aria-hidden
          >
            {zdobyta && (
              <span className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-cream/30 to-transparent" />
            )}
            {!zdobyta && !wToku ? (
              <Lock size={20} className="relative text-muted-foreground" />
            ) : (
              <span className={`relative ${zdobyta ? "text-cream" : "text-foreground"}`}>
                {a.icon_url && a.icon_url.startsWith("http") ? (
                  <img loading="lazy" decoding="async" src={a.icon_url} alt="" className="h-9 w-9 object-contain" />
                ) : a.icon_url ? (
                  <span className="text-3xl leading-none">{a.icon_url}</span>
                ) : (
                  <Trophy size={26} />
                )}
              </span>
            )}
          </span>

          <div className="min-w-0 flex-1">
            <p className="font-display text-base font-extrabold leading-tight">{a.name}</p>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className={`h-1.5 w-1.5 rotate-45 rounded-[1px] ${kategoriaKolor(a.category)}`}
                  aria-hidden
                />
                {kategoriaLabel(a.category)}
              </span>
              {rarity && (
                <span className="inline-flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rotate-45 rounded-[1px] ${RARITY_DOT[rarity]}`} aria-hidden />
                  {RARITY_LABEL[rarity]}
                </span>
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>

        {a.description && (
          <p className="mt-3 text-sm leading-snug text-muted-foreground">{a.description}</p>
        )}

        {zdobyta ? (
          <p className="mt-3 rounded-xl bg-ok/10 px-3 py-2 text-xs font-extrabold text-ok">
            Zdobyta{zdobytaKiedy ? ` · ${zdobytaKiedy}` : ""}
          </p>
        ) : wToku ? (
          <div className="mt-3">
            <div className="flex items-baseline justify-between text-xs font-extrabold">
              <span className="text-tomato">
                {postep!.current} / {postep!.threshold}
              </span>
              <span className="text-muted-foreground">{postep!.pct}%</span>
            </div>
            <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
              <span
                className="block h-full rounded-full bg-tomato transition-[width] duration-700 ease-out"
                style={{ width: `${postep!.pct}%` }}
              />
            </span>
          </div>
        ) : (
          <p className="mt-3 rounded-xl bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground">
            Jeszcze przed Tobą.
          </p>
        )}

        {/* Odsetek graczy pojawia sie dopiero, gdy kont jest tyle, zeby cos
            znaczyl - przy dziesieciu bylby zwykla ciekawostka o dziesiatkach
            procent. Patrz MIN_PROBKA_GRACZY. */}
        {odsetek && <p className="mt-2.5 text-[11px] text-muted-foreground">{odsetek}</p>}
      </aside>
    </>
  );
}
