import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Compass, Map, Layers, Bookmark, Users, User as UserIcon, Plus, Star, Store, Camera, X } from "lucide-react";
import { useMyProfile } from "@/lib/profile-api";
import { useMyFriendships } from "@/lib/friends-api";
import { useUser } from "@/lib/use-auth";
import { toast } from "sonner";

// Three tabs on each side of the center FAB, for visual balance. "Moje miejsca"
// and "Profil" are rendered explicitly on the right since "Profil" needs
// conditional auth logic and "Znajomi" carries a pending-request badge.
const leftTabs = [
  { to: "/", label: "Odkrywaj", icon: Compass, exact: true },
  { to: "/mapa", label: "Mapa", icon: Map, exact: false },
  { to: "/karty", label: "Karty", icon: Layers, exact: false },
] as const;

/** Mobile bottom tab bar with a central coral FAB. */
export function BottomTabBar() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const { data: profile } = useMyProfile();
  const { user } = useUser();
  const { data: friendships } = useMyFriendships();
  const pendingFriends = (friendships ?? []).filter(
    (f) => f.status === "pending" && f.addressee_id === user?.id,
  ).length;
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (to: string, exact: boolean) => (exact ? pathname === to : pathname.startsWith(to));

  // Six items either side of the FAB can't all carry full-width text labels on a
  // phone screen - only the active tab shows its label; the rest stay icon-only.
  const itemCls = (active: boolean) =>
    `flex min-h-[3.25rem] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold transition-colors ${
      active ? "text-tomato" : "text-muted-foreground"
    }`;

  return (
    <>
      {sheetOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Zamknij"
            onClick={() => setSheetOpen(false)}
            className="absolute inset-0 bg-navy/50 backdrop-blur-sm"
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-border bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-extrabold">Co robimy?</h2>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Zamknij"
                className="grid h-10 w-10 place-items-center rounded-full hover:bg-muted"
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid gap-2">
              <Link
                to="/mapa"
                onClick={() => {
                  setSheetOpen(false);
                  toast.success("Otwieram mapę", {
                    description: "Wybierz lokal z mapy, a potem dodaj ocenę na jego profilu.",
                  });
                }}
                className="flex items-center gap-3 rounded-2xl border border-border bg-background p-4 text-sm font-semibold active:scale-[0.99]"
              >
                <Star size={18} className="text-tomato" />
                <span className="min-w-0">
                  Znajdź knajpę i oceń
                  <span className="block text-xs font-normal text-muted-foreground">Wybierz lokal na mapie i dodaj recenzję</span>
                </span>
              </Link>
              <Link
                to="/wall"
                onClick={() => {
                  setSheetOpen(false);
                  toast.success("Przechodzę na Pożeralnię", {
                    description: profile?.username
                      ? "Dodaj wpis ze zdjęciem w formularzu na górze."
                      : "Zaloguj się, żeby wrzucić zdjęcie.",
                  });
                }}
                className="flex items-center gap-3 rounded-2xl border border-border bg-background p-4 text-sm font-semibold active:scale-[0.99]"
              >
                <Camera size={18} className="text-tomato" />
                <span className="min-w-0">
                  Wrzuć zdjęcie na Pożeralnię
                  <span className="block text-xs font-normal text-muted-foreground">Pokaż, co dziś poŻerasz</span>
                </span>
              </Link>
              <Link
                to="/"
                hash="zglos-lokal"
                onClick={() => {
                  setSheetOpen(false);
                  toast.success("Formularz zgłoszenia lokalu", {
                    description: "Przewijam do sekcji zgłoszeń na stronie głównej.",
                  });
                }}
                className="flex items-center gap-3 rounded-2xl border border-border bg-background p-4 text-sm font-semibold active:scale-[0.99]"
              >
                <Store size={18} className="text-tomato" />
                <span className="min-w-0">
                  Zgłoś nowy lokal
                  <span className="block text-xs font-normal text-muted-foreground">Brakuje knajpy? Dopisz ją</span>
                </span>
              </Link>
            </div>
          </div>
        </div>
      )}

      <nav
        aria-label="Nawigacja główna"
        className="pz-safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-md lg:hidden"
      >
        <div className="mx-auto flex max-w-md items-stretch">
          {leftTabs.map(({ to, label, icon: Icon, exact }) => {
            const active = isActive(to, exact);
            return (
              <Link key={to} to={to} className={itemCls(active)} aria-label={label}>
                <Icon size={20} />
                {active && <span className="hidden max-w-full truncate min-[360px]:inline">{label}</span>}
              </Link>
            );
          })}

          <div className="flex w-16 shrink-0 items-start justify-center">
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              aria-label="Dodaj"
              className="-mt-5 grid h-14 w-14 place-items-center rounded-full bg-tomato text-cream shadow-lg shadow-tomato/30 transition active:scale-95"
            >
              <Plus size={26} />
            </button>
          </div>

          <Link to="/friends" className={itemCls(isActive("/friends", false))} aria-label="Znajomi">
            <span className="relative">
              <Users size={20} />
              {pendingFriends > 0 && (
                <span className="absolute -right-2 -top-1.5 min-w-[15px] h-[15px] px-0.5 rounded-full bg-tomato text-cream text-[9px] font-bold grid place-items-center">
                  {pendingFriends > 9 ? "9+" : pendingFriends}
                </span>
              )}
            </span>
            {isActive("/friends", false) && (
              <span className="hidden max-w-full truncate min-[360px]:inline">Znajomi</span>
            )}
          </Link>

          <Link
            to="/moje-miejsca"
            className={itemCls(isActive("/moje-miejsca", false))}
            aria-label="Moje miejsca"
          >
            <Bookmark size={20} />
            {/* "Moje miejsca" overflowed its ~58px flex slot even on a
                414px-wide phone (confirmed live: scrollWidth 62 > clientWidth
                58) - truncated on every real device, not just narrow ones.
                "Miejsca" fits; aria-label above keeps the full name for
                screen readers. */}
            {isActive("/moje-miejsca", false) && (
              <span className="hidden max-w-full truncate min-[360px]:inline">Miejsca</span>
            )}
          </Link>

          {profile?.username ? (
            <Link
              to="/u/$username"
              params={{ username: profile.username }}
              className={itemCls(pathname.startsWith("/u/"))}
              aria-label="Profil"
            >
              <UserIcon size={20} />
              {pathname.startsWith("/u/") && (
                <span className="hidden max-w-full truncate min-[360px]:inline">Profil</span>
              )}
            </Link>
          ) : (
            <Link
              to="/auth"
              className={itemCls(pathname.startsWith("/auth"))}
              aria-label="Profil"
            >
              <UserIcon size={20} />
              {pathname.startsWith("/auth") && (
                <span className="hidden max-w-full truncate min-[360px]:inline">Profil</span>
              )}
            </Link>
          )}
        </div>
      </nav>
    </>
  );
}
