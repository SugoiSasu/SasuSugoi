import { Undo2 } from "lucide-react";
import { cuisineMeta } from "@/data/places";
import { YummyFace, NopeFace } from "@/components/SwipeFaces";
import type { Place } from "@/lib/places-api";

export type SwipeDecision = { place: Place; direction: "left" | "right" };

/**
 * Desktop-only record of what you just decided.
 *
 * The deck already remembered every decision so the undo button could reverse
 * one, but that memory was invisible: you could undo a mis-swipe only if you
 * noticed it before the card was gone, and you had no way to check what the
 * last few cards even were. On mobile the deck fills the screen and there is
 * nowhere to put this; on desktop the column sat in the middle of a mostly
 * empty page, so the space was already there.
 *
 * The counts are per session on purpose. Lifetime totals live in the sidebar
 * and repeating them here would say nothing about the run you are in.
 */
export function SwipeHistoryRail({
  history,
  onUndo,
}: {
  /** Oldest first, matching the deck's own stack order. */
  history: SwipeDecision[];
  onUndo: () => void;
}) {
  const wanted = history.filter((h) => h.direction === "right").length;
  const skipped = history.length - wanted;
  const recent = history.slice(-8).reverse();

  return (
    <aside
      className="hidden w-64 shrink-0 self-start rounded-3xl border border-border bg-card p-4 text-left lg:block"
      aria-label="Twoje decyzje w tej sesji"
    >
      <h2 className="font-display text-base font-bold">Twoje decyzje</h2>

      {history.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Nic jeszcze nie zdecydowałeś. Każdą decyzję da się tu cofnąć.
        </p>
      ) : (
        <>
          <p className="mt-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Chcę odwiedzić: {wanted} · Pominięte: {skipped}
          </p>

          <ul className="mt-3 space-y-1">
            {recent.map(({ place, direction }, i) => {
              const meta = cuisineMeta(place.cuisine);
              const thumb = place.avatar_url ?? place.cover_image_url;
              return (
                <li
                  key={`${place.id}-${history.length - i}`}
                  className="flex items-center gap-2.5 rounded-xl px-1.5 py-1.5"
                >
                  <span
                    className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg border border-border"
                    style={thumb ? undefined : { backgroundColor: meta.color }}
                  >
                    {thumb ? (
                      <img src={thumb} alt="" aria-hidden="true" className="h-full w-full object-cover" />
                    ) : null}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{place.name}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {direction === "right" ? "Chcę odwiedzić" : "Pominięte"}
                    </span>
                  </span>

                  {direction === "right" ? <YummyFace size={20} /> : <NopeFace size={20} />}

                  {/* Only the newest decision is reversible - the deck's undo is a
                      stack, so offering the button on older rows would promise
                      something it cannot do. */}
                  {i === 0 && (
                    <button
                      type="button"
                      onClick={onUndo}
                      aria-label={`Cofnij: ${place.name}`}
                      title="Cofnij tę decyzję"
                      className="pz-hit grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground"
                    >
                      <Undo2 size={14} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          {history.length > recent.length && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              …i {history.length - recent.length} wcześniej
            </p>
          )}
        </>
      )}
    </aside>
  );
}
