import { pluralPl } from "@/lib/plural-pl";
import { RARITY_DOT, RARITY_LABEL, RARITY_ORDER, type Rarity } from "@/lib/achievement-rarity";

interface Props {
  zdobyte: number;
  lacznie: number;
  wToku: number;
  wgRzadkosci: Record<Rarity, { zdobyte: number; lacznie: number }> | null;
}

/**
 * "Twoja kolekcja" z paczki designu - jedna karta z calym stanem kolekcji.
 *
 * LevelProgressCard obok mowi o POZIOMIE konta (punkty, XP do nastepnego), ta
 * o ODZNAKACH. Do tej pory licznik odznak byl doklejony do karty poziomu i
 * mowil tylko "13 z 71" - bez tego, ile jest w toku i ile zostalo.
 */
export function CollectionSummary({ zdobyte, lacznie, wToku, wgRzadkosci }: Props) {
  const doZdobycia = Math.max(0, lacznie - zdobyte - wToku);
  const pct = lacznie > 0 ? Math.round((zdobyte / lacznie) * 100) : 0;

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="text-[10px] font-extrabold uppercase tracking-[0.09em] text-muted-foreground">
        Twoja kolekcja
      </h2>

      <p className="mt-2 flex items-baseline gap-2">
        <span className="font-display text-3xl font-extrabold leading-none">{zdobyte}</span>
        <span className="text-sm font-semibold text-muted-foreground">
          z {lacznie} {pluralPl(lacznie, "odznaki", "odznak", "odznak")}
        </span>
        <span className="ml-auto text-sm font-extrabold text-tomato">{pct}%</span>
      </p>

      <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <span
          className="block h-full rounded-full bg-tomato transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </span>

      <dl className="mt-3.5 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-muted/60 px-3 py-2">
          <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            W toku
          </dt>
          <dd className="font-display text-lg font-extrabold leading-tight text-tomato">{wToku}</dd>
        </div>
        <div className="rounded-xl bg-muted/60 px-3 py-2">
          <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Do zdobycia
          </dt>
          <dd className="font-display text-lg font-extrabold leading-tight">{doZdobycia}</dd>
        </div>
      </dl>

      {/* Podzial wg rzadkosci pojawia sie dopiero, gdy jest z czego go policzyc
          - patrz MIN_PROBKA_GRACZY w achievement-rarity.ts. */}
      {wgRzadkosci && (
        <ul className="mt-3 space-y-1.5">
          {RARITY_ORDER.map((r) => (
            <li key={r} className="flex items-center gap-2 text-[11px] font-semibold">
              <span className={`h-2 w-2 shrink-0 rotate-45 rounded-[1px] ${RARITY_DOT[r]}`} aria-hidden />
              <span className="text-muted-foreground">{RARITY_LABEL[r]}</span>
              <span className="ml-auto tabular-nums">
                {wgRzadkosci[r].zdobyte}/{wgRzadkosci[r].lacznie}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
