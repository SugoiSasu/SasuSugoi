import { Star, Undo2 } from "lucide-react";
import { cuisineMeta } from "@/data/places";
import { YummyFace, NopeFace } from "@/components/SwipeFaces";
import type { Place } from "@/lib/places-api";

export type SwipeDecisionType = "want" | "fav" | "skip";
export type SwipeDecision = { place: Place; type: SwipeDecisionType };

const OPIS: Record<SwipeDecisionType, string> = {
  want: "Chcę odwiedzić",
  fav: "Ulubione",
  skip: "Pominięte",
};

function policz(history: SwipeDecision[]) {
  return {
    want: history.filter((h) => h.type === "want").length,
    fav: history.filter((h) => h.type === "fav").length,
    skip: history.filter((h) => h.type === "skip").length,
  };
}

function Ikona({ type }: { type: SwipeDecisionType }) {
  if (type === "want") return <YummyFace size={20} />;
  if (type === "skip") return <NopeFace size={20} />;
  return <Star size={18} className="fill-mustard text-mustard" aria-hidden="true" />;
}

/** Trzy liczniki: chcę / ulubione / pominięte (z tej sesji, nie z całego konta). */
function Liczniki({ history }: { history: SwipeDecision[] }) {
  const c = policz(history);
  const kafel = (n: number, label: string, cls: string) => (
    <div className={`rounded-2xl px-2 py-2 text-center ${cls}`}>
      <div className="font-display text-xl font-extrabold leading-none">{n}</div>
      <div className="mt-0.5 text-[10.5px] font-bold text-foreground/60">{label}</div>
    </div>
  );
  return (
    <div className="grid grid-cols-3 gap-2">
      {kafel(c.want, "Chcę", "bg-tomato/10 text-tomato")}
      {kafel(c.fav, "Ulubione", "bg-mustard/20 text-foreground")}
      {kafel(c.skip, "Pominięte", "bg-foreground/5 text-foreground")}
    </div>
  );
}

function Wiersz({
  d,
  onUndo,
}: {
  d: SwipeDecision;
  onUndo: (placeId: string) => void;
}) {
  const meta = cuisineMeta(d.place.cuisine);
  const thumb = d.place.avatar_url ?? d.place.cover_image_url;
  return (
    <li className="flex items-center gap-2.5 rounded-xl px-1.5 py-1.5">
      <span
        className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg border border-border"
        style={thumb ? undefined : { backgroundColor: meta.color }}
      >
        {thumb ? (
          <img loading="lazy" decoding="async" src={thumb} alt="" aria-hidden="true" className="h-full w-full object-cover" />
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{d.place.name}</span>
        <span className="block truncate text-[11px] text-muted-foreground">{OPIS[d.type]}</span>
      </span>
      <Ikona type={d.type} />
      <button
        type="button"
        onClick={() => onUndo(d.place.id)}
        aria-label={`Cofnij: ${d.place.name}`}
        title="Cofnij tę decyzję"
        className="pz-hit grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground"
      >
        <Undo2 size={15} />
      </button>
    </li>
  );
}

/**
 * Lista decyzji z tej sesji, każdą da się cofnąć (nie tylko ostatnią - baza
 * trzyma decyzje osobno, więc nic nie wymusza kolejki).
 * Na komputerze stoi obok karty, na telefonie otwiera się z przycisku "Decyzje".
 */
export function DecisionsList({
  history,
  onUndo,
  limit,
}: {
  /** Oldest first, matching the deck's own stack order. */
  history: SwipeDecision[];
  onUndo: (placeId: string) => void;
  limit?: number;
}) {
  const wszystkie = history.slice().reverse();
  const recent = limit ? wszystkie.slice(0, limit) : wszystkie;
  return (
    <div className="flex min-h-0 flex-col gap-3">
      <Liczniki history={history} />
      {history.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nic jeszcze nie zdecydowałeś. Każdą decyzję da się tu cofnąć.
        </p>
      ) : (
        <ul className="min-h-0 space-y-0.5 overflow-y-auto">
          {recent.map((d) => (
            <Wiersz key={d.place.id} d={d} onUndo={onUndo} />
          ))}
        </ul>
      )}
      {limit && wszystkie.length > recent.length && (
        <p className="text-[11px] text-muted-foreground">
          …i {wszystkie.length - recent.length} wcześniej
        </p>
      )}
    </div>
  );
}

/** Desktop-only panel obok karty (na telefonie: arkusz z przycisku "Decyzje"). */
export function SwipeHistoryRail({
  history,
  onUndo,
}: {
  history: SwipeDecision[];
  onUndo: (placeId: string) => void;
}) {
  return (
    <aside
      className="hidden w-64 shrink-0 self-start rounded-3xl border border-border bg-card p-4 text-left lg:block"
      aria-label="Twoje decyzje w tej sesji"
    >
      <h2 className="mb-3 font-display text-base font-bold">Twoje decyzje</h2>
      <DecisionsList history={history} onUndo={onUndo} limit={8} />
    </aside>
  );
}
