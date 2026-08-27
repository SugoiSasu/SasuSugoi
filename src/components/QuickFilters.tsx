import { Clock, Star, Sparkles, Heart } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Intent filters, as opposed to the cuisine chips below them which filter by
 * category. "What's open right now" and "what did I save" are a different
 * question from "what kind of food" - the two shouldn't share a control.
 *
 * A chip is only offered when it can actually return something (see
 * `available` in the homepage): a filter that can only ever produce an empty
 * state is worse than no filter at all.
 */
export type QuickFilter = "all" | "open" | "top" | "new" | "fav";

export const QUICK_FILTERS: {
  key: QuickFilter;
  label: string;
  icon: ReactNode;
}[] = [
  { key: "all", label: "Wszystkie", icon: null },
  { key: "open", label: "Otwarte teraz", icon: <Clock size={13} /> },
  { key: "top", label: "Ocena 4,5+", icon: <Star size={13} /> },
  { key: "new", label: "Nowe", icon: <Sparkles size={13} /> },
  { key: "fav", label: "Ulubione", icon: <Heart size={13} /> },
];

export function QuickFilters({
  value,
  onChange,
  available,
  counts,
}: {
  value: QuickFilter;
  onChange: (f: QuickFilter) => void;
  /** Keys worth offering at all, given the current data. "all" is implicit. */
  available: Set<QuickFilter>;
  /** How many places each filter would yield, for the chip badge. */
  counts: Partial<Record<QuickFilter, number>>;
}) {
  const shown = QUICK_FILTERS.filter((f) => f.key === "all" || available.has(f.key));
  // A lone "Wszystkie" chip filters nothing and just adds a row of chrome.
  if (shown.length <= 1) return null;

  return (
    <div
      role="group"
      aria-label="Szybkie filtry"
      className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
    >
      {shown.map((f) => {
        const active = f.key === value;
        const count = counts[f.key];
        return (
          <button
            key={f.key}
            type="button"
            onClick={() => onChange(f.key)}
            aria-pressed={active}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold transition active:scale-95 ${
              active
                ? "border-navy bg-navy text-cream"
                : "border-border bg-card text-foreground hover:border-accent"
            }`}
          >
            {f.icon}
            {f.label}
            {count !== undefined && f.key !== "all" && (
              <span className={active ? "text-cream/60" : "text-muted-foreground"}>{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
