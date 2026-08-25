import { useEffect, useState } from "react";
import { placeOpenState, type OpeningHours } from "@/lib/places-api";

/**
 * "Otwarte" on its own answers half the question - the useful half is
 * whether you'll make it before closing. So an open place shows its closing
 * time, and one closing within the hour switches to a countdown in the
 * accent colour.
 *
 * Renders nothing when the place has no opening_hours: a blank line is
 * better than implying "closed" for a place we simply have no data on.
 */
export function OpenStatus({
  hours,
  className = "",
}: {
  hours: OpeningHours | null | undefined;
  className?: string;
}) {
  // Recompute on a timer, not just on render: a card sitting on screen at
  // 21:59 would otherwise keep claiming the place is open past closing.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // `now` stays null through SSR and the first client render so both produce
  // identical markup - computing a time-dependent label during hydration is
  // a mismatch waiting to happen.
  if (!now) return null;

  const state = placeOpenState(hours, now);
  if (state.status === "unknown") return null;

  const { label, dot, text } =
    state.status === "closing-soon"
      ? {
          label:
            state.minutesToClose <= 1
              ? "Zamyka się"
              : `Zamyka za ${state.minutesToClose} min`,
          dot: "bg-tomato",
          text: "text-tomato",
        }
      : state.status === "open"
        ? {
            label: `Otwarte do ${state.closesAt}`,
            dot: "bg-ok",
            text: "text-ok",
          }
        : {
            label: state.opensAt ? `Zamknięte · od ${state.opensAt}` : "Zamknięte",
            dot: "bg-muted-foreground/50",
            text: "text-muted-foreground",
          };

  return (
    <span className={`inline-flex items-center gap-1.5 font-semibold ${text} ${className}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
      {label}
    </span>
  );
}

/** Places added within this window get the "Nowość" flag on their card. */
const NEW_FOR_DAYS = 30;

export function isNewPlace(createdAt: string | null | undefined, now: Date = new Date()): boolean {
  if (!createdAt) return false;
  const added = new Date(createdAt).getTime();
  if (Number.isNaN(added)) return false;
  return now.getTime() - added <= NEW_FOR_DAYS * 24 * 60 * 60 * 1000;
}
