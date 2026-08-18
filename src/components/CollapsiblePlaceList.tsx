import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { VisitedPlace } from "@/lib/visits-api";
import { PlaceListGrid } from "@/components/VisitStatus";
import { EmptyPlaceListState } from "@/components/EmptyPlaceList";
import { Skeleton } from "@/components/ui/skeleton";

type PlaceSort = "recent" | "alpha";

const ICONS_EXPANDED_MAX_REM = 18;
const LIST_EXPANDED_MAX_REM = 9.5;

interface CollapsiblePlaceListProps {
  icon: React.ReactNode;
  title: string;
  places: VisitedPlace[] | undefined;
  loading: boolean;
  emptyText: string;
  variant?: "list" | "icons";
  isMe?: boolean;
  emptyIcon?: React.ReactNode;
  emptyTitle?: string;
  emptyTip?: string;
  emptyCta?: { to: string; label: string };
  className?: string;
  titleClassName?: string;
}

export function CollapsiblePlaceList({
  icon,
  title,
  places,
  loading,
  emptyText,
  variant = "icons",
  isMe = false,
  emptyIcon,
  emptyTitle,
  emptyTip,
  emptyCta,
  className = "",
  titleClassName = "font-display text-2xl sm:text-3xl flex items-center gap-2.5 tracking-tight",
}: CollapsiblePlaceListProps) {
  const [expanded, setExpanded] = useState(false);
  const [sort, setSort] = useState<PlaceSort>("recent");
  const total = places?.length ?? 0;
  const isEmpty = !loading && total === 0;
  const gridRef = useRef<HTMLDivElement>(null);
  const [needsExpand, setNeedsExpand] = useState(false);
  const [collapsedH, setCollapsedH] = useState(0);
  const [expandedH, setExpandedH] = useState(0);

  const sorted = places
    ? [...places].sort((a, b) => {
        if (sort === "alpha") return a.name.localeCompare(b.name, "pl");
        const ta = a.added_at ? Date.parse(a.added_at) : 0;
        const tb = b.added_at ? Date.parse(b.added_at) : 0;
        return tb - ta;
      })
    : places;

  // Measure collapsed (2 rows for icons / 3 rows for list) and expanded heights.
  // ResizeObserver keeps the measurement in sync when viewport width changes.
  useEffect(() => {
    function measure() {
      const grid = gridRef.current;
      if (!grid || !places?.length) {
        setNeedsExpand(false);
        return;
      }
      const firstItem = grid.querySelector("li");
      const listEl = firstItem?.parentElement;
      const computed = listEl ? getComputedStyle(listEl) : getComputedStyle(grid);
      const gap = parseFloat(computed.rowGap || computed.gap || "0");
      const rows = variant === "icons" ? 2 : 3;
      const itemH = firstItem ? firstItem.getBoundingClientRect().height : 0;
      const collapsed = itemH ? itemH * rows + gap * (rows - 1) : 0;

      const maxRem = variant === "icons" ? ICONS_EXPANDED_MAX_REM : LIST_EXPANDED_MAX_REM;
      const maxPx = maxRem * 16;
      const fullH = grid.scrollHeight;
      setCollapsedH(collapsed);
      setExpandedH(Math.min(fullH, maxPx));
      setNeedsExpand(fullH > collapsed + 2);
    }

    measure();
    const ro = new ResizeObserver(measure);
    if (gridRef.current) ro.observe(gridRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [places, variant, sort]);

  const showGradient = !expanded && needsExpand;
  const containerHeight = expanded ? expandedH : collapsedH;

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h2 className={titleClassName}>
          {icon} {title} ({total})
        </h2>
        {expanded && total > 1 && (
          <div className="inline-flex rounded-full border border-border bg-card p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setSort("recent")}
              aria-pressed={sort === "recent"}
              className={`px-3 py-1.5 rounded-full transition ${sort === "recent" ? "bg-navy text-cream" : "text-muted-foreground hover:text-foreground"}`}
            >
              Ostatnio dodane
            </button>
            <button
              type="button"
              onClick={() => setSort("alpha")}
              aria-pressed={sort === "alpha"}
              className={`px-3 py-1.5 rounded-full transition ${sort === "alpha" ? "bg-navy text-cream" : "text-muted-foreground hover:text-foreground"}`}
            >
              Alfabetycznie
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <ListSkeleton variant={variant} />
      ) : isEmpty ? (
        <EmptyPlaceListState
          icon={emptyIcon || icon}
          title={emptyTitle || "Brak lokali"}
          tip={emptyTip || emptyText}
          cta={isMe ? emptyCta : undefined}
        />
      ) : (
        <div
          className="relative overflow-hidden rounded-xl"
          style={{
            height: containerHeight > 0 ? containerHeight : undefined,
            transition: "height 500ms cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <div
            ref={gridRef}
            className={`h-full ${expanded ? "overflow-y-auto" : "overflow-hidden"}`}
          >
            <PlaceListGrid places={sorted} emptyText={emptyText} variant={variant} />
          </div>
          {showGradient && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-background to-transparent rounded-b-xl" />
          )}
        </div>
      )}

      {(needsExpand || expanded) && !loading && !isEmpty && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:border-tomato hover:text-tomato transition"
          aria-expanded={expanded}
        >
          {expanded ? (
            <>
              <ChevronUp size={16} aria-hidden="true" /> Pokaż mniej
            </>
          ) : (
            <>
              <ChevronDown size={16} aria-hidden="true" /> Pokaż więcej
            </>
          )}
        </button>
      )}
    </div>
  );
}

function ListSkeleton({ variant }: { variant?: "list" | "icons" }) {
  if (variant === "icons") {
    return (
      <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-xl" />
        ))}
      </div>
    );
  }
  return (
    <div className="grid sm:grid-cols-2 gap-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-14 rounded-xl" />
      ))}
    </div>
  );
}
