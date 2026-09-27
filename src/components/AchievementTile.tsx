import { Lock, Trophy } from "lucide-react";
import type { Achievement } from "@/lib/achievements-api";
import { RARITY_DOT, RARITY_LABEL, type Rarity } from "@/lib/achievement-rarity";
import { kategoriaKolor } from "@/lib/achievement-categories";

export interface TileProgress {
  current: number;
  threshold: number;
  pct: number;
}

interface Props {
  a: Achievement;
  zdobyta: boolean;
  /** null, gdy odznaka zdobyta albo gdy kryterium nie da sie zmierzyc. */
  postep: TileProgress | null;
  rarity: Rarity | null;
  wybrana: boolean;
  onSelect: (id: string) => void;
}

/**
 * Kafelek odznaki - heksagon, zgodnie z paczka designu, ktora rezerwuje ten
 * ksztalt dla odznak w calej marce (zaokraglony kwadrat znaczy kategorie
 * kuchni, wiec ksztalt niesie informacje).
 *
 * Stan czyta sie z samego heksagonu: zdobyta ma pelny kolor kategorii i
 * polysk, w toku przygaszony kolor i pasek postepu, niezdobyta klodke.
 * Ramka zostaje na obudowie, nie na heksagonie - clip-path przycialby ja
 * razem z tlem (ta sama pulapka co przy kafelkach kategorii).
 */
export function AchievementTile({ a, zdobyta, postep, rarity, wybrana, onSelect }: Props) {
  const wToku = !!postep && postep.pct > 0;
  const legendarnaZdobyta = zdobyta && rarity === "legendary";

  const tloHex = zdobyta
    ? kategoriaKolor(a.category)
    : wToku
      ? `${kategoriaKolor(a.category)} opacity-40`
      : "bg-muted";

  const podpis = zdobyta
    ? "Zdobyta"
    : wToku
      ? `${postep!.current} / ${postep!.threshold}`
      : rarity
        ? RARITY_LABEL[rarity]
        : "Do zdobycia";

  return (
    <button
      type="button"
      onClick={() => onSelect(a.id)}
      aria-pressed={wybrana}
      className={`relative flex w-full flex-col items-center gap-1.5 rounded-2xl border p-2.5 text-center transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tomato ${
        wybrana
          ? "border-tomato bg-tomato/5 shadow-[0_8px_20px_-8px_var(--tomato)]"
          : legendarnaZdobyta
            ? "border-mustard/70 bg-mustard/[0.07]"
            : "border-border bg-card"
      }`}
    >
      {rarity && (
        <span
          aria-hidden
          title={RARITY_LABEL[rarity]}
          className={`absolute right-2 top-2 h-1.5 w-1.5 rotate-45 rounded-[1px] ${RARITY_DOT[rarity]}`}
        />
      )}

      <span
        className={`pz-hex relative grid h-14 w-14 place-items-center overflow-hidden ${tloHex}`}
        aria-hidden
      >
        {zdobyta && (
          <span className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-cream/30 to-transparent" />
        )}
        {!zdobyta && !wToku ? (
          <Lock size={18} className="relative text-muted-foreground" />
        ) : (
          <span className={`relative ${zdobyta ? "text-cream" : "text-foreground"}`}>
            {a.icon_url && a.icon_url.startsWith("http") ? (
              <img src={a.icon_url} alt="" className="h-8 w-8 object-contain" loading="lazy" />
            ) : a.icon_url ? (
              <span className="text-2xl leading-none">{a.icon_url}</span>
            ) : (
              <Trophy size={22} />
            )}
          </span>
        )}
      </span>

      <span
        className={`w-full truncate text-[11px] font-extrabold leading-tight ${
          zdobyta || wToku ? "text-foreground" : "text-muted-foreground"
        }`}
      >
        {a.name}
      </span>

      <span
        className={`text-[9.5px] font-extrabold leading-none ${
          zdobyta ? "text-ok" : wToku ? "text-tomato" : "text-muted-foreground/70"
        }`}
      >
        {podpis}
      </span>

      {wToku && (
        <span className="h-1 w-4/5 overflow-hidden rounded-full bg-muted" aria-hidden>
          <span
            className="block h-full rounded-full bg-tomato transition-[width] duration-700 ease-out"
            style={{ width: `${postep!.pct}%` }}
          />
        </span>
      )}
    </button>
  );
}
