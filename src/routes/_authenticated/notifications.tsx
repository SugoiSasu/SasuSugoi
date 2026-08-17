import { BackButton } from "@/components/BackButton";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { ArrowLeft, Bell, CheckCheck, Loader2, UserPlus, UserCheck, Newspaper, Trophy } from "lucide-react";
import {
  useNotificationsInfinite,
  useMarkRead,
  NOTIFICATION_TYPES,
  NOTIFICATION_TYPE_LABELS,
  type Notification,
  type NotificationType,
} from "@/lib/notifications-api";
import { AsyncState } from "@/components/AsyncState";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";

const searchSchema = z.object({
  filter: fallback(
    z.enum(["all", ...NOTIFICATION_TYPES] as [string, ...string[]]),
    "all",
  ).default("all"),
});

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Powiadomienia — poŻeramy" }] }),
  validateSearch: zodValidator(searchSchema),
  component: NotificationsPage,
});

function iconFor(type: string) {
  switch (type) {
    case "friend_request": return <UserPlus size={16} className="text-tomato" />;
    case "friend_accepted": return <UserCheck size={16} className="text-tomato" />;
    case "place_post": return <Newspaper size={16} className="text-tomato" />;
    case "achievement": return <Trophy size={16} className="text-tomato" />;
    default: return <Bell size={16} className="text-tomato" />;
  }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("pl-PL", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

function NotificationsPage() {
  const { filter } = Route.useSearch();
  const navigate = Route.useNavigate();
  const current = filter as NotificationType | "all";

  const {
    data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage, refetch,
  } = useNotificationsInfinite(current);
  const markRead = useMarkRead();
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "400px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const items: Notification[] = data?.pages.flatMap((p) => p.items) ?? [];
  const unread = items.filter((n) => !n.read_at).length;

  const setFilter = (f: NotificationType | "all") => {
    navigate({ search: { filter: f } });
  };

  return (
    <main id="main-content" className="min-h-dvh bg-background">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <BackButton to="/" />
          {unread > 0 && (
            <button
              onClick={() => markRead.mutate("all")}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-tomato hover:underline min-h-11 px-2"
              aria-label={`Oznacz wszystkie ${unread} powiadomień jako przeczytane`}
            >
              <CheckCheck size={14} /> Oznacz wszystkie ({unread})
            </button>
          )}
        </div>

        <h1 className="text-3xl font-display font-bold mb-1">Powiadomienia</h1>
        <p className="text-sm text-muted-foreground mb-2" aria-live="polite">
          {unread > 0
            ? `${unread} nieprzeczytanych`
            : "Wszystkie aktywności z Twojego konta i znajomych."}
        </p>

        {/* Filter pills */}
        <div className="flex flex-wrap gap-2 my-6" role="tablist" aria-label="Filtruj powiadomienia">
          <FilterPill active={current === "all"} onClick={() => setFilter("all")}>
            Wszystkie
          </FilterPill>
          {NOTIFICATION_TYPES.map((t) => (
            <FilterPill key={t} active={current === t} onClick={() => setFilter(t)}>
              {NOTIFICATION_TYPE_LABELS[t] ?? t}
            </FilterPill>
          ))}
        </div>

        <AsyncState
          isLoading={isLoading}
          isError={isError}
          isEmpty={items.length === 0}
          isFetching={!isLoading && !isError && data?.pages[0] !== undefined && items.length > 0 && false}
          onRetry={() => refetch()}
          emptyIcon={Bell}
          emptyTitle="Cisza w eterze"
          emptyText={current === "all"
            ? "Nie masz jeszcze powiadomień. Wrócimy, gdy coś się wydarzy."
            : "Brak powiadomień w tej kategorii."}
          emptyAction={current !== "all" ? (
            <button
              onClick={() => setFilter("all")}
              className="chip bg-navy text-cream hover:bg-tomato transition"
            >
              Pokaż wszystkie
            </button>
          ) : undefined}
          skeletonRows={4}
        >
          <div className="space-y-4">
            {groupItems(items).map(({ label, rows }) => (
              <section key={label} aria-label={label}>
                <h2 className="px-1 mb-2 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                  {label}
                </h2>
                <ul className="bg-card border border-border rounded-2xl divide-y divide-border overflow-hidden">
                  {rows.map((n) => (
                    <li key={n.id}>
                      <Row n={n} onMarkRead={() => !n.read_at && markRead.mutate([n.id])} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </AsyncState>

        {items.length > 0 && (
          <div
            ref={sentinelRef}
            aria-hidden={!hasNextPage}
            className="mt-6 flex items-center justify-center"
            style={{ minHeight: hasNextPage ? 56 : 0 }}
          >
            {hasNextPage ? (
              <div
                className="inline-flex items-center gap-2 text-xs text-muted-foreground"
                aria-live="polite"
              >
                <Loader2 size={14} className="animate-spin" />
                {isFetchingNextPage ? "Wczytuję…" : "Przewiń, aby wczytać więcej"}
              </div>
            ) : (
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                To już wszystko
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function groupItems(items: Notification[]): { label: string; rows: Notification[] }[] {
  const today: Notification[] = [];
  const week: Notification[] = [];
  const older: Notification[] = [];
  const now = Date.now();
  const DAY = 86400_000;
  for (const n of items) {
    const age = now - new Date(n.created_at).getTime();
    if (age < DAY) today.push(n);
    else if (age < 7 * DAY) week.push(n);
    else older.push(n);
  }
  const groups: { label: string; rows: Notification[] }[] = [];
  if (today.length) groups.push({ label: "Dziś", rows: today });
  if (week.length) groups.push({ label: "W tym tygodniu", rows: week });
  if (older.length) groups.push({ label: "Wcześniej", rows: older });
  return groups;
}

function FilterPill({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
        active
          ? "bg-tomato text-cream border-tomato"
          : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-tomato/40"
      }`}
    >
      {children}
    </button>
  );
}

function Row({ n, onMarkRead }: { n: Notification; onMarkRead: () => void }) {
  const body = (
    <div className={`flex items-start gap-3 px-4 py-4 ${!n.read_at ? "bg-tomato/5" : ""}`}>
      <span className="mt-0.5 shrink-0 w-9 h-9 rounded-full bg-tomato/10 grid place-items-center">
        {iconFor(n.type)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{n.title}</div>
        {n.body && <div className="text-sm text-muted-foreground mt-0.5">{n.body}</div>}
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground mt-1">
          {fmtDate(n.created_at)}
        </div>
      </div>
      {!n.read_at && <span className="mt-1.5 w-2 h-2 rounded-full bg-tomato shrink-0" aria-label="Nieprzeczytane" />}
    </div>
  );
  if (n.link) {
    return (
      <Link to={n.link} onClick={onMarkRead} className="block hover:bg-background/60 transition">
        {body}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onMarkRead} className="block w-full text-left hover:bg-background/60 transition">
      {body}
    </button>
  );
}
