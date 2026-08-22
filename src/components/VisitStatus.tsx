import { Link } from "@tanstack/react-router";
import { Bookmark, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useUser } from "@/lib/use-auth";
import {
  useMyVisitStatus,
  useToggleVisit,
  type VisitStatus,
  type VisitedPlace,
} from "@/lib/visits-api";
import { cuisineMeta } from "@/data/places";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

interface VisitStatusButtonProps {
  placeId: string;
  status: VisitStatus;
  variant?: "pill" | "icon";
  className?: string;
}

const META: Record<
  VisitStatus,
  {
    icon: typeof Bookmark;
    on: string;
    off: string;
    toastOn: string;
    toastOff: string;
    activeClass: string;
    fillIconOnActive: boolean;
  }
> = {
  want: {
    icon: Bookmark,
    on: "Chcę odwiedzić",
    off: "Chcę odwiedzić",
    toastOn: "Dodano do „Chcę odwiedzić”",
    toastOff: "Usunięto z „Chcę odwiedzić”",
    // Stays an outline (never a solid fill) even when active, per the KV mockup - // only "Byłem tutaj" and "Ulubione" get a filled active state.
    activeClass: "border-2 border-navy bg-navy/10 text-navy hover:bg-navy/15",
    fillIconOnActive: false,
  },
  visited: {
    icon: CheckCircle2,
    on: "Odwiedzone",
    off: "Byłem tutaj",
    toastOn: "Oznaczono jako odwiedzone",
    toastOff: "Cofnięto oznaczenie",
    activeClass: "bg-navy text-cream hover:bg-navy/90",
    fillIconOnActive: true,
  },
};

export function VisitStatusButton({
  placeId,
  status,
  variant = "pill",
  className = "",
}: VisitStatusButtonProps) {
  const { user } = useUser();
  const active = useMyVisitStatus(placeId, status);
  const toggle = useToggleVisit();
  const m = META[status];
  const Icon = m.icon;

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast.error("Zaloguj się, aby zapisywać listy lokali");
      return;
    }
    const next = !active;
    toggle.mutate(
      { placeId, status, on: next },
      {
        onSuccess: () => toast.success(next ? m.toastOn : m.toastOff),
        onError: (err) => toast.error((err as Error).message),
      },
    );
  }

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={toggle.isPending}
        aria-pressed={active}
        title={active ? m.on : m.off}
        className={`pz-hit inline-flex items-center justify-center rounded-full h-8 w-8 text-xs font-bold shadow-sm transition disabled:opacity-60 ${
          active ? m.activeClass : "bg-cream/90 text-navy hover:bg-cream"
        } ${className}`}
      >
        <Icon size={14} className={active && m.fillIconOnActive ? "fill-cream" : ""} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={toggle.isPending}
      aria-pressed={active}
      className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 font-semibold transition disabled:opacity-50 ${
        active ? m.activeClass : "border-2 border-navy text-navy hover:bg-navy hover:text-cream"
      } ${className}`}
    >
      {toggle.isPending ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        <Icon size={16} className={active && m.fillIconOnActive ? "fill-cream" : ""} />
      )}
      {active ? m.on : m.off}
    </button>
  );
}

interface PlaceListGridProps {
  places: VisitedPlace[] | undefined;
  emptyText: string;
}

export function PlaceListGrid({
  places,
  emptyText,
  variant = "list",
  className = "",
}: PlaceListGridProps & { variant?: "list" | "icons"; className?: string }) {
  if (!places || places.length === 0) {
    return (
      <p className="text-sm text-muted-foreground rounded-2xl border border-dashed border-border px-4 py-6 text-center">
        {emptyText}
      </p>
    );
  }
  if (variant === "icons") {
    return (
      <TooltipProvider delayDuration={200}>
        <ul className={`grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2 ${className}`}>
          {places.map((p) => {
            const meta = cuisineMeta(p.cuisine);
            return (
              <li key={p.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      to="/k/$id"
                      params={{ id: p.slug ?? p.id }}
                      aria-label={`${p.name} - ${p.cuisine}`}
                      className="block aspect-square rounded-xl overflow-hidden ring-1 ring-border bg-background hover:ring-2 hover:ring-tomato hover:-translate-y-0.5 transition-all"
                      style={{ backgroundColor: meta.color }}
                    >
                      {p.cover_image_url ? (
                        <img
                          src={p.cover_image_url}
                          alt={p.name}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="w-full h-full grid place-items-center text-xl">
                          {meta.emoji}
                        </span>
                      )}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {p.name} · {p.cuisine}
                  </TooltipContent>
                </Tooltip>
              </li>
            );
          })}
        </ul>
      </TooltipProvider>
    );
  }
  return (
    <ul className={`grid sm:grid-cols-2 gap-2 ${className}`}>
      {places.map((p) => {
        const meta = cuisineMeta(p.cuisine);
        return (
          <li key={p.id}>
            <Link
              to="/k/$id"
              params={{ id: p.slug ?? p.id }}
              className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2 h-14 hover:border-tomato transition"
            >
              <span
                className="w-10 h-10 rounded-lg overflow-hidden shrink-0 grid place-items-center text-lg"
                style={{ backgroundColor: meta.color }}
              >
                {p.cover_image_url ? (
                  <img src={p.cover_image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span>{meta.emoji}</span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold truncate">{p.name}</span>
                <span className="block text-xs text-muted-foreground truncate">
                  {p.cuisine} · {p.address}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

import { useEffect } from "react";
import { useMyVisitStatuses } from "@/lib/visits-api";

export function VisitEventListener() {
  const { user } = useUser();
  const toggle = useToggleVisit();
  const { data: statuses } = useMyVisitStatuses();
  useEffect(() => {
    function onEvent(e: Event) {
      const ev = e as CustomEvent<{ placeId: string; status: VisitStatus }>;
      const { placeId, status } = ev.detail;
      if (!user) {
        toast.error("Zaloguj się, aby zapisywać listy lokali");
        return;
      }
      const isOn = statuses?.[placeId]?.has(status) ?? false;
      const next = !isOn;
      toggle.mutate(
        { placeId, status, on: next },
        {
          onSuccess: () =>
            toast.success(
              status === "want"
                ? next
                  ? "Dodano do „Chcę odwiedzić”"
                  : "Usunięto z „Chcę odwiedzić”"
                : next
                  ? "Oznaczono jako odwiedzone"
                  : "Cofnięto oznaczenie",
            ),
          onError: (err) => toast.error((err as Error).message),
        },
      );
    }
    window.addEventListener("pz:toggle-visit", onEvent as EventListener);
    return () => window.removeEventListener("pz:toggle-visit", onEvent as EventListener);
  }, [user, toggle, statuses]);
  return null;
}
